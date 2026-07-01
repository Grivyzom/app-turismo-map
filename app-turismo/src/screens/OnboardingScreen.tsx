import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Animated,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Descubre Valdivia',
    description: 'Encuentra los mejores eventos, panoramas y secretos locales en un solo mapa interactivo.',
    icon: 'map',
    color: '#6a44ff',
  },
  {
    id: '2',
    title: 'Notificaciones Inteligentes',
    description: 'Te avisaremos en tiempo real cuando haya invitaciones o lugares nuevos cerca de ti.',
    icon: 'notifications-active',
    color: '#ff446a',
  },
  {
    id: '3',
    title: 'Conecta y Comparte',
    description: '¿Eres Turista o Residente? Adapta tu perfil y recibe recomendaciones personalizadas.',
    icon: 'people-alt',
    color: '#3B82F6',
  },
];

type OnboardingProps = {
  onFinish: () => void;
};

export default function OnboardingScreen({ onFinish }: OnboardingProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollToNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      onFinish();
    }
  };

  return (
    <View style={styles.container}>
      <View style={StyleSheet.absoluteFill} className="bg-[#f5f6f8]" />
      
      <View style={{ flex: 3 }}>
        <FlatList
          data={SLIDES}
          renderItem={({ item }) => (
            <View style={{ width, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
              <View 
                style={[styles.iconContainer, { backgroundColor: `${item.color}15` }]} 
                className="mb-8 items-center justify-center rounded-full"
              >
                <MaterialIcons name={item.icon as any} size={80} color={item.color} />
              </View>
              <Text className="text-[28px] font-extrabold text-center text-[#2e2b5f] mb-4">
                {item.title}
              </Text>
              <Text className="text-[16px] text-center text-[#4b4f63] leading-6 px-4">
                {item.description}
              </Text>
            </View>
          )}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          ref={slidesRef}
        />
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20, justifyContent: 'space-between', paddingBottom: 40 }}>
        {/* Paginador (Puntitos) */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 20, 10],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i.toString()}
                style={[styles.dot, { width: dotWidth, opacity }]}
              />
            );
          })}
        </View>

        {/* Botón Continuar */}
        <TouchableOpacity
          onPress={scrollToNext}
          style={styles.primaryButton}
          className="h-14 w-full rounded-xl bg-[#6a44ff] items-center justify-center active:opacity-90 mt-6"
        >
          <Text className="text-[16px] font-bold text-white">
            {currentIndex === SLIDES.length - 1 ? 'Empezar ahora' : 'Siguiente'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  iconContainer: {
    width: 160,
    height: 160,
  },
  dot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6a44ff',
    marginHorizontal: 4,
  },
  primaryButton: {
    boxShadow: '0px 4px 12px rgba(106, 68, 255, 0.25)',
  },
});
