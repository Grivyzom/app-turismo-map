import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Platform,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { audioRecorder } from '../../utils/audioRecorder';
import { processAudioSearch, ParsedSearch } from '../../utils/aiSearchParser';
import { useRealtimeSearch } from '../../utils/useRealtimeSearch';
import { addRecentSearch } from '../../utils/recentSearches';

interface SmartVoiceSearchProps {
  onSearchComplete: (result: ParsedSearch) => void;
  onPartialResult?: (text: string) => void;
  isEmbedded?: boolean;
}

export function SmartVoiceSearch({ onSearchComplete, onPartialResult, isEmbedded = false }: SmartVoiceSearchProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState('Escribe o dicta tu búsqueda...');

  // Hook para streaming en tiempo real (WebSockets + MediaRecorder)
  const {
    isRecording: isWsRecording,
    partialText,
    startRecording: startWsRecording,
    stopRecording: stopWsRecording,
  } = useRealtimeSearch();

  const [searchText, setSearchText] = useState('');

  // Efecto para emitir resultados parciales al padre y actualizar input
  useEffect(() => {
    if (isWsRecording && partialText) {
      setSearchText(partialText);
      if (onPartialResult) onPartialResult(partialText);
    }
  }, [partialText, isWsRecording, onPartialResult]);

  const [isNativeRecording, setIsNativeRecording] = useState(false);
  const isRecording = isWsRecording || isNativeRecording;

  // Animaciones
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isEmbedded) {
      Animated.spring(slideAnim, {
        toValue: 1,
        tension: 60,
        friction: 10,
        useNativeDriver: false,
      }).start();
    }
  }, [slideAnim, isEmbedded]);

  useEffect(() => {
    let pulseLoop: Animated.CompositeAnimation;
    if (isRecording) {
      pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.3,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
        ]),
      );
      pulseLoop.start();
    } else {
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: false,
      }).start();
    }

    return () => {
      if (pulseLoop) pulseLoop.stop();
    };
  }, [isRecording, pulseAnim]);

  const isProcessingResult = useRef(false);

  const handleMicPress = async () => {
    if (isProcessing) return;

    if (isRecording) {
      // Detener grabación
      if (Platform.OS === 'web') {
        stopWsRecording();
      } else {
        setIsNativeRecording(false);
        setIsProcessing(true);
        setStatusText('Procesando IA...');
        try {
          const uri = await audioRecorder.stopRecording();
          if (uri) {
            const result = await processAudioSearch(uri);
            await audioRecorder.clearAudioFile(uri);
            if (result.query) setSearchText(result.query);
            setStatusText('Puedes editar o buscar');
          }
        } catch (error) {
          console.error('Processing error', error);
          setStatusText('Error al procesar audio');
          setTimeout(() => setStatusText('Escribe o dicta tu búsqueda...'), 3000);
        } finally {
          setIsProcessing(false);
        }
      }
    } else {
      // Iniciar grabación
      setSearchText('');
      setStatusText('Te escucho...');
      isProcessingResult.current = false;

      if (Platform.OS === 'web') {
        startWsRecording((result) => {
          if (isProcessingResult.current) return;
          isProcessingResult.current = true;

          if (result.query) {
            setSearchText(result.query);
            setStatusText('Puedes editar o dar enter para buscar');
          } else {
            setStatusText('No se escuchó nada');
            setTimeout(() => setStatusText('Escribe o dicta tu búsqueda...'), 3000);
          }
          setIsProcessing(false);
        });
      } else {
        setIsNativeRecording(true);
        try {
          await audioRecorder.startRecording();
        } catch (error) {
          console.error('Failed to start recording', error);
          setIsNativeRecording(false);
          setStatusText('Error de micrófono');
          setTimeout(() => setStatusText('Escribe o dicta tu búsqueda...'), 3000);
        }
      }
    }
  };

  const handleSubmit = () => {
    if (searchText.trim()) {
      // Guardar de manera ultra ligera en AsyncStorage
      addRecentSearch(searchText);
      
      onSearchComplete({
        query: searchText,
        category: 'todos',
        originalText: searchText,
        isFinal: true,
      });
    }
  };

  const content = (
    <View style={isEmbedded ? styles.embeddedRow : styles.contentRow}>
      {!isEmbedded && (
        <Ionicons name="search" size={18} color="#9CA3AF" style={styles.searchIcon} />
      )}

      <View style={styles.textContainer}>
        <TextInput
          style={[
            styles.placeholderText,
            isRecording && styles.textRecording,
            isProcessing && styles.textProcessing,
            Platform.OS === 'web' && { outlineStyle: 'none' } as any,
          ]}
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={handleSubmit}
          placeholder={statusText}
          placeholderTextColor="#9CA3AF"
          editable={!isRecording && !isProcessing}
          returnKeyType="search"
        />
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleMicPress}
        style={styles.micButtonWrapper}
      >
        {isRecording && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
        <View style={[styles.micButton, isRecording && styles.micButtonRecording]}>
          {isProcessing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons
              name={isRecording ? 'mic' : 'mic-outline'}
              size={18}
              color={isRecording ? '#FFFFFF' : '#34D399'}
            />
          )}
        </View>
      </TouchableOpacity>
    </View>
  );

  if (isEmbedded) {
    return <View style={styles.embeddedContainer}>{content}</View>;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [
            {
              translateY: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [-30, 0],
              }),
            },
          ],
          opacity: slideAnim,
        },
      ]}
    >
      <View style={styles.glassPanel}>{content}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  embeddedContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingLeft: 4,
  },
  embeddedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flex: 1,
  },
  container: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 120 : 100,
    left: 20,
    right: 20,
    zIndex: 100,
    alignItems: 'center',
  },
  glassPanel: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: 'rgba(34, 34, 34, 0.55)',
    borderRadius: 50,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#1A4335',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.1,
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
      web: {
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        boxShadow: '0 12px 24px rgba(26, 67, 53, 0.1)',
      },
    }),
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  searchIcon: {
    marginLeft: 12,
    marginRight: 8,
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  placeholderText: {
    color: '#9CA3AF',
    fontSize: 15,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    fontWeight: '400',
  },
  textRecording: {
    color: '#EF4444',
    fontWeight: '600',
  },
  textProcessing: {
    color: '#34D399',
    fontWeight: '600',
  },
  micButtonWrapper: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
    zIndex: 2,
  },
  micButtonRecording: {
    backgroundColor: 'rgba(239, 68, 68, 0.8)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  pulseRing: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
    zIndex: 1,
  },
});

