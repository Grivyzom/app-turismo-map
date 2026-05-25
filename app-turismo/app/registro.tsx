import React, { useState } from 'react';
import {
  ImageBackground,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  Modal,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { useEffect } from 'react';

import { saveAuthToken } from '../src/utils/authStorage';
import { saveUserProfile } from '../src/utils/userProfileStorage';

const COUNTRIES = [
  { name: 'Chile', flag: '🇨🇱' },
  { name: 'Argentina', flag: '🇦🇷' },
  { name: 'Brasil', flag: '🇧🇷' },
  { name: 'España', flag: '🇪🇸' },
  { name: 'Estados Unidos', flag: '🇺🇸' },
  { name: 'Colombia', flag: '🇨🇴' },
  { name: 'Perú', flag: '🇵🇪' },
  { name: 'Uruguay', flag: '🇺🇾' },
  { name: 'Paraguay', flag: '🇵🇾' },
  { name: 'Bolivia', flag: '🇧🇴' },
  { name: 'Ecuador', flag: '🇪🇨' },
  { name: 'Venezuela', flag: '🇻🇪' },
  { name: 'México', flag: '🇲🇽' },
  { name: 'Otro', flag: '🌐' },
];

const CHILE_REGIONS = [
  'Región Metropolitana de Santiago',
  'Región de Los Ríos',
  'Región de Los Lagos',
  'Región de Valparaíso',
  'Región del Biobío',
  'Región de La Araucanía',
  'Región de Coquimbo',
  'Región de Antofagasta',
  "Región de O'Higgins",
  'Región del Maule',
  'Región de Ñuble',
  'Región de Tarapacá',
  'Región de Atacama',
  'Región de Arica y Parinacota',
  'Región de Aysén',
  'Región de Magallanes',
];

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectingRegion, setSelectingRegion] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredCountries = COUNTRIES.filter((country) =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const filteredRegions = CHILE_REGIONS.filter((region) =>
    region.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleRegister = () => {
    void (async () => {
      saveAuthToken('dummy-user-session', true);

      await saveUserProfile({
        fullName: fullName.trim() || 'Usuario normal',
        email: email.trim(),
        location: location.trim() || 'Sin ubicación definida',
        avatarIcon: 'person',
        userType: 'citizen',
      });

      router.replace('/(home)');
    })();
  };

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      offlineAccess: true,
    });
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      const idToken = response.data?.idToken;

      if (idToken) {
        console.log('Token obtenido (Registro):', idToken);
        saveAuthToken(idToken, true);

        await saveUserProfile({
          fullName: fullName.trim() || 'Usuario de Google',
          email: email.trim(),
          location: location.trim() || 'Sin ubicación definida',
          avatarIcon: 'person',
          userType: 'citizen',
        });

        router.replace('/(home)');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('Usuario canceló el registro con Google');
      } else {
        console.error('Error en Google Sign-In', error);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ImageBackground
        source={{
          uri: 'https://images.unsplash.com/photo-1518182170546-076616fdfaaf?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80',
        }}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      >
        <View style={StyleSheet.absoluteFill} className="bg-[#f8f9fa]/75" />
      </ImageBackground>

      <View style={StyleSheet.absoluteFill} className="pointer-events-none">
        <View className="absolute -top-24 -left-24 w-[40vw] h-[40vw] rounded-full bg-[#c0ecd8]/20 blur-[100px]" />
        <View className="absolute bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-[#94cdf5]/20 blur-[120px]" />
      </View>

      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingVertical: 0 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.card}
          className="w-full flex-1 sm:flex-none sm:max-w-md self-center mx-0 sm:mx-5 bg-[#f8f9fa] sm:bg-white/85 sm:backdrop-blur-xl border-0 sm:border sm:border-[#c1c8c3]/30 sm:rounded-xl px-8 py-12 sm:p-8 gap-8 justify-center"
        >
          <View className="text-center mb-0">
            <Text className="text-[32px] leading-10 tracking-tight font-bold text-[#002d20] mb-2">
              Explora Valdivia
            </Text>
            <Text className="text-base leading-6 text-[#414844]">Crea tu cuenta para comenzar</Text>
          </View>

          <TouchableOpacity
            style={styles.softButton}
            className="w-full bg-[#f3f4f5] border border-[#c1c8c3]/40 rounded-full py-3.5 px-5 flex-row items-center justify-center gap-3 active:opacity-90"
            onPress={handleGoogleLogin}
          >
            <View className="w-5 h-5 items-center justify-center rounded-full bg-[#4285F4]">
              <Text className="text-[10px] font-bold text-white">G</Text>
            </View>
            <Text className="text-base font-semibold text-[#191c1d]">Continuar con Google</Text>
          </TouchableOpacity>

          <View className="flex-row items-center gap-3 w-full">
            <View className="h-px bg-[#c1c8c3]/40 flex-1" />
            <Text className="text-sm text-[#717974]">o</Text>
            <View className="h-px bg-[#c1c8c3]/40 flex-1" />
          </View>

          <View className="gap-4">
            <View className="relative">
              <View className="absolute left-4 top-0 bottom-0 justify-center z-10 pointer-events-none">
                <MaterialIcons name="person" size={20} color="#717974" />
              </View>
              <TextInput
                className="w-full bg-[#f3f4f5] border border-[#c1c8c3]/50 rounded-full px-5 py-3.5 pl-12 text-base text-[#191c1d]"
                placeholder="Nombre Completo"
                placeholderTextColor="#717974"
                value={fullName}
                onChangeText={setFullName}
              />
            </View>

            <View className="relative">
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setSelectingRegion(false);
                  setShowLocationModal(true);
                }}
                className="w-full bg-[#f3f4f5] border border-[#c1c8c3]/50 rounded-full px-5 py-3.5 pl-12 pr-12 flex-row items-center active:opacity-90"
              >
                <View className="absolute left-4 top-0 bottom-0 justify-center">
                  <MaterialIcons name="public" size={20} color="#717974" />
                </View>
                <Text
                  className={`flex-1 text-base ${location ? 'text-[#191c1d]' : 'text-[#717974]'}`}
                >
                  {location || '¿De dónde vienes?'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={24} color="#717974" />
              </TouchableOpacity>
            </View>

            <View className="relative">
              <View className="absolute left-4 top-0 bottom-0 justify-center z-10 pointer-events-none">
                <MaterialIcons name="mail" size={20} color="#717974" />
              </View>
              <TextInput
                className="w-full bg-[#f3f4f5] border border-[#c1c8c3]/50 rounded-full px-5 py-3.5 pl-12 text-base text-[#191c1d]"
                placeholder="Correo Electrónico"
                placeholderTextColor="#717974"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            <View className="relative">
              <View className="absolute left-4 top-0 bottom-0 justify-center z-10 pointer-events-none">
                <MaterialIcons name="lock" size={20} color="#717974" />
              </View>
              <TextInput
                className="w-full bg-[#f3f4f5] border border-[#c1c8c3]/50 rounded-full px-5 py-3.5 pl-12 pr-12 text-base text-[#191c1d]"
                placeholder="Contraseña"
                placeholderTextColor="#717974"
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
              />
              <TouchableOpacity
                className="absolute right-4 top-0 bottom-0 justify-center"
                onPress={() => setShowPassword(!showPassword)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color="#717974"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              className="w-full mt-2 bg-[#1a4335] rounded-full py-4 active:opacity-90"
              onPress={handleRegister}
            >
              <View className="flex-row items-center justify-center gap-2">
                <Text className="text-center text-sm font-semibold tracking-wide text-[#85af9d]">
                  Registrarse
                </Text>
                <MaterialIcons name="arrow-forward" size={18} color="#85af9d" />
              </View>
            </TouchableOpacity>
          </View>

          <View className="flex-row items-center justify-center space-x-4 my-0">
            <View className="flex-1 h-px bg-[#c1c8c3]/30" />
            <Text className="text-sm text-[#414844]">o</Text>
            <View className="flex-1 h-px bg-[#c1c8c3]/30" />
          </View>

          <View className="flex-row justify-center">
            <Text className="text-sm text-[#414844]">¿Ya tienes cuenta? </Text>
            <TouchableOpacity onPress={() => router.push('/login')}>
              <Text className="text-sm text-[#002d20] font-bold">Inicia Sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={showLocationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowLocationModal(false);
          setSelectingRegion(false);
        }}
      >
        <View style={styles.modalBackdrop} className="flex-1 justify-center items-center p-4">
          <TouchableOpacity
            className="absolute inset-0 w-full h-full"
            activeOpacity={1}
            onPress={() => {
              setShowLocationModal(false);
              setSelectingRegion(false);
            }}
          />

          <View
            style={styles.modalContent}
            className="w-full sm:max-w-md bg-[#222222]/85 backdrop-blur-xl rounded-[30px] h-[75%] sm:h-[65%] px-6 pt-5 pb-6 border border-white/10"
          >
            <View className="w-12 h-1 bg-white/20 rounded-full self-center mb-5 sm:hidden" />

            <View className="flex-row items-center justify-between mb-4 w-full">
              {selectingRegion ? (
                <TouchableOpacity
                  onPress={() => {
                    setSelectingRegion(false);
                    setSearchQuery('');
                  }}
                  className="p-2 -ml-2 rounded-full active:bg-white/10"
                >
                  <MaterialIcons name="arrow-back" size={22} color="#ffffff" />
                </TouchableOpacity>
              ) : (
                <View className="w-9" />
              )}

              <Text className="text-lg font-bold text-white text-center flex-1">
                {selectingRegion ? 'Selecciona tu Región' : '¿De dónde vienes?'}
              </Text>

              <TouchableOpacity
                onPress={() => {
                  setShowLocationModal(false);
                  setSelectingRegion(false);
                  setSearchQuery('');
                }}
                className="p-2 -mr-2 rounded-full active:bg-white/10"
              >
                <MaterialIcons name="close" size={22} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>

            <View className="relative mb-4">
              <View className="absolute left-4 top-0 bottom-0 justify-center z-10 pointer-events-none">
                <MaterialIcons name="search" size={20} color="rgba(255,255,255,0.5)" />
              </View>
              <TextInput
                className="w-full bg-white/10 border border-white/20 rounded-full px-5 py-3 pl-11 text-base text-white"
                placeholder={selectingRegion ? 'Buscar región...' : 'Buscar país...'}
                placeholderTextColor="rgba(255,255,255,0.5)"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCorrect={false}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSearchQuery('')}
                  className="absolute right-4 top-0 bottom-0 justify-center z-10"
                >
                  <MaterialIcons name="cancel" size={18} color="rgba(255,255,255,0.5)" />
                </TouchableOpacity>
              )}
            </View>

            <View className="flex-1">
              {selectingRegion ? (
                <FlatList
                  data={filteredRegions}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        setLocation(`🇨🇱 Chile, ${item}`);
                        setShowLocationModal(false);
                        setSelectingRegion(false);
                        setSearchQuery('');
                      }}
                      className="flex-row items-center py-3.5 px-4 border-b border-white/10 active:bg-white/10 rounded-xl"
                    >
                      <Text className="text-lg mr-3">📍</Text>
                      <Text className="text-base font-medium text-white flex-1">{item}</Text>
                      <MaterialIcons name="chevron-right" size={20} color="rgba(255,255,255,0.3)" />
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View className="py-8 items-center">
                      <Text className="text-sm text-white/50">No se encontraron regiones</Text>
                    </View>
                  }
                />
              ) : (
                <FlatList
                  data={filteredCountries}
                  keyExtractor={(item) => item.name}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      onPress={() => {
                        if (item.name === 'Chile') {
                          setSelectingRegion(true);
                          setSearchQuery('');
                        } else {
                          setLocation(`${item.flag} ${item.name}`);
                          setShowLocationModal(false);
                          setSearchQuery('');
                        }
                      }}
                      className="flex-row items-center py-3.5 px-4 border-b border-white/10 active:bg-white/10 rounded-xl"
                    >
                      <Text className="text-2xl mr-3">{item.flag}</Text>
                      <Text className="text-base font-medium text-white flex-1">{item.name}</Text>
                      {item.name === 'Chile' ? (
                        <View className="flex-row items-center gap-1">
                          <Text className="text-xs font-semibold text-[#34D399] bg-[#34D399]/20 px-2 py-0.5 rounded-full">
                            Elegir región
                          </Text>
                          <MaterialIcons
                            name="chevron-right"
                            size={20}
                            color="rgba(255,255,255,0.3)"
                          />
                        </View>
                      ) : (
                        <MaterialIcons
                          name="chevron-right"
                          size={20}
                          color="rgba(255,255,255,0.3)"
                        />
                      )}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={
                    <View className="py-8 items-center">
                      <Text className="text-sm text-white/50">No se encontraron países</Text>
                    </View>
                  }
                />
              )}
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  card: {
    boxShadow: '0px 18px 40px rgba(26, 67, 53, 0.10)',
  },
  softButton: {
    boxShadow: '0px 8px 18px rgba(17, 24, 39, 0.08)',
  },
  primaryButton: {
    boxShadow: '0px 12px 28px rgba(26, 67, 53, 0.18)',
  },
  modalBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      web: {
        boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
      },
    }),
  },
});
