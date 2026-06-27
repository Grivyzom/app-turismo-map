import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { LinearGradient } from 'expo-linear-gradient';

export default function DevDashboardScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <MaterialIcons name="developer-mode" size={32} color="#F59E0B" />
          <Text style={styles.headerTitle}>God Mode Dashboard</Text>
          <Text style={styles.headerSubtitle}>Entorno de Pruebas & Herramientas Dev</Text>
        </View>

        <View style={styles.grid}>
          {/* Herramienta 1: Geo-Router y Mapa */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push('/dev/mapa')}
          >
            <LinearGradient
              colors={['rgba(52, 211, 153, 0.2)', 'rgba(52, 211, 153, 0.05)']}
              style={styles.cardGradient}
            >
              <MaterialIcons name="map" size={36} color="#34D399" />
              <Text style={styles.cardTitle}>Geo-Lab</Text>
              <Text style={styles.cardDesc}>
                Sandbox del mapa. Prueba el Geo-Router, simulador de eventos, herramienta de
                medición y editor de polígonos.
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Herramienta 2: Galería de Pines */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => router.push('/dev/gallery-manager')}
          >
            <LinearGradient
              colors={['rgba(139, 92, 246, 0.2)', 'rgba(139, 92, 246, 0.05)']}
              style={styles.cardGradient}
            >
              <MaterialIcons name="image-search" size={36} color="#8B5CF6" />
              <Text style={styles.cardTitle}>Pin Gallery</Text>
              <Text style={styles.cardDesc}>
                Sube y gestiona imágenes de referencia para categorías (Fauna, Bosques, Reservas,
                etc).
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Herramienta 3: Simulador de Tiempo (Mock) */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => alert('Pronto: Máquina del Tiempo')}
          >
            <LinearGradient
              colors={['rgba(245, 158, 11, 0.2)', 'rgba(245, 158, 11, 0.05)']}
              style={styles.cardGradient}
            >
              <MaterialIcons name="update" size={36} color="#F59E0B" />
              <Text style={styles.cardTitle}>Time Machine</Text>
              <Text style={styles.cardDesc}>
                Acelera el reloj interno para probar notificaciones programadas y eventos futuros.
              </Text>
            </LinearGradient>
          </TouchableOpacity>

          {/* Herramienta 4: Memory & Cache (Mock) */}
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => alert('Pronto: Inspector de Caché')}
          >
            <LinearGradient
              colors={['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.05)']}
              style={styles.cardGradient}
            >
              <MaterialIcons name="memory" size={36} color="#EF4444" />
              <Text style={styles.cardTitle}>Memory & Cache</Text>
              <Text style={styles.cardDesc}>
                Forza limpiezas de caché de tiles del mapa y estado global para depurar fugas de
                memoria.
              </Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.backHomeButton} onPress={() => router.push('/(home)/map')}>
          <MaterialIcons name="arrow-back" size={20} color="#FFF" />
          <Text style={styles.backHomeText}>Volver a la App Principal</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  scrollContent: {
    padding: 24,
    ...Platform.select({
      ios: { paddingTop: 60 },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
    marginTop: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFF',
    marginTop: 12,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
    marginTop: 4,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    justifyContent: 'space-between',
  },
  card: {
    width: '47%',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardGradient: {
    padding: 20,
    height: 180,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
    marginTop: 12,
    marginBottom: 8,
  },
  cardDesc: {
    fontSize: 11,
    color: '#D1D5DB',
    lineHeight: 16,
  },
  backHomeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 40,
    gap: 8,
  },
  backHomeText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
