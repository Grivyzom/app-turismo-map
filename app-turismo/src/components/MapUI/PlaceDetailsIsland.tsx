import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Animated, Platform, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { TurismoEvent } from '../Map/types';
import { BP_DESKTOP } from '../../../app/(home)/index';

interface PlaceDetailsIslandProps {
  selectedEvent: TurismoEvent | null;
  slideAnim: Animated.Value;
  onClose: () => void;
  isDesktop: boolean;
}

export function PlaceDetailsIsland({ selectedEvent, slideAnim, onClose, isDesktop }: PlaceDetailsIslandProps) {
  if (!selectedEvent) return null;

  const isGastronomia = selectedEvent.category.toLowerCase() === 'gastronomia' || selectedEvent.category.toLowerCase() === 'restaurant';
  const islandTitle = isGastronomia ? 'Menú' : 'Detalles adicionales';

  return (
    <Animated.View
      style={[
        styles.islandContainer,
        !isDesktop && styles.islandContainerMobile,
        {
          transform: [
            {
              translateX: slideAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [400, 0], // Slide from right
              }),
            },
          ],
          opacity: slideAnim,
        },
      ]}
      onStartShouldSetResponder={() => true}
      onTouchStart={(e) => e.stopPropagation()}
      // @ts-ignore
      onWheel={(e) => e.stopPropagation()}
      // @ts-ignore
      onPointerDown={(e) => e.stopPropagation()}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 70 : 100} tint="dark" style={StyleSheet.absoluteFillObject} />
      <View style={StyleSheet.absoluteFillObject} style={[{ backgroundColor: 'rgba(15, 23, 42, 0.7)' }, StyleSheet.absoluteFillObject]} />

      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name={isGastronomia ? "restaurant-outline" : "information-circle-outline"} size={22} color="#38BDF8" style={{ marginRight: 8 }} />
          <Text style={styles.title}>{islandTitle}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <Ionicons name="close" size={24} color="#9CA3AF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.contentScroll} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        
        {isGastronomia ? (
          <>
            {/* Gastronomy Mock Menu */}
            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>Platos Principales</Text>
              
              <View style={styles.menuItem}>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>Lomo a lo Pobre</Text>
                  <Text style={styles.menuItemDesc}>Exquisito corte de res acompañado de papas fritas, cebolla caramelizada y huevo frito.</Text>
                </View>
                <Text style={styles.menuItemPrice}>$12.500</Text>
              </View>

              <View style={styles.menuItem}>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>Ceviche Valdiviano</Text>
                  <Text style={styles.menuItemDesc}>Salmón fresco con toques de limón de pica, cilantro y cebolla morada.</Text>
                </View>
                <Text style={styles.menuItemPrice}>$9.900</Text>
              </View>

              <Text style={styles.sectionTitle}>Para Compartir</Text>
              <View style={styles.menuItem}>
                <View style={styles.menuItemTextContainer}>
                  <Text style={styles.menuItemTitle}>Tabla Sureña</Text>
                  <Text style={styles.menuItemDesc}>Mix de carnes ahumadas, quesos locales y sopaipillas sureñas.</Text>
                </View>
                <Text style={styles.menuItemPrice}>$18.500</Text>
              </View>
            </View>
          </>
        ) : (
          <>
            {/* General Details Mock */}
            <View style={styles.menuSection}>
              <Text style={styles.sectionTitle}>Información Extra</Text>
              <Text style={styles.generalText}>
                Este lugar es uno de los puntos más atractivos de la ciudad. Contamos con guías y mapas disponibles en el ingreso.
              </Text>
              
              <View style={styles.infoRow}>
                <Ionicons name="wifi-outline" size={18} color="#9CA3AF" />
                <Text style={styles.infoText}>Wifi Gratis Disponible</Text>
              </View>
              <View style={styles.infoRow}>
                <Ionicons name="car-outline" size={18} color="#9CA3AF" />
                <Text style={styles.infoText}>Estacionamiento cercano</Text>
              </View>
            </View>
          </>
        )}

      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  islandContainer: {
    position: 'absolute',
    right: 24,
    top: 90,
    bottom: 24,
    width: 380,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 15,
  },
  islandContainerMobile: {
    top: 130, // Debajo de la barra superior y categorías
    bottom: 'auto',
    maxHeight: '45%', // Deja espacio inferior para el modal (Bottom Sheet)
    left: 16,
    right: 16,
    width: 'auto',
    borderRadius: 24, // Esquinas completamente redondeadas para efecto de isla
    zIndex: 150, // Permite que el modal inferior (zIndex 200) se superponga si es necesario
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  closeBtn: {
    padding: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 16,
    paddingBottom: 40,
  },
  menuSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
    marginTop: 8,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  menuItemTextContainer: {
    flex: 1,
    paddingRight: 16,
  },
  menuItemTitle: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  menuItemDesc: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 18,
  },
  menuItemPrice: {
    color: '#10B981', // Verde esmeralda premium
    fontSize: 15,
    fontWeight: '700',
  },
  generalText: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 22,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    padding: 12,
    borderRadius: 12,
  },
  infoText: {
    color: '#E2E8F0',
    fontSize: 14,
    marginLeft: 12,
    fontWeight: '500',
  },
});
