import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

const GREEN = '#1a4335';
const GREEN_LIGHT = '#e8f5e9';

export default function DelimitarZonasScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Delimitar Zonas</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <MaterialIcons name="layers" size={32} color={GREEN} />
          <Text style={styles.infoTitle}>Zonas de Interés</Text>
          <Text style={styles.infoText}>
            Esta herramienta te permite delimitar áreas específicas en el mapa, como sectores comerciales, centros urbanos o zonas de eventos.
          </Text>
        </View>

        <View style={styles.featureCard}>
          <Text style={styles.featureTitle}>¿Cómo funciona?</Text>
          <View style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
            <Text style={styles.stepText}>Identifica el área que deseas resaltar en el mapa.</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
            <Text style={styles.stepText}>Define los puntos del polígono que delimitan la zona.</Text>
          </View>
          <View style={styles.step}>
            <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
            <Text style={styles.stepText}>Asigna un nombre y color distintivo para que los usuarios lo identifiquen.</Text>
          </View>
        </View>

        <TouchableOpacity 
          style={styles.mainBtn}
          onPress={() => alert('La herramienta de dibujo de polígonos estará disponible en la próxima actualización.')}
        >
          <Text style={styles.mainBtnText}>Comenzar a Dibujar</Text>
          <MaterialIcons name="gesture" size={20} color="#ffffff" />
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Nota: Los polígonos se renderizan de forma nativa usando WebGL para una máxima fluidez y escalado perfecto.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    backgroundColor: GREEN,
    paddingTop: Platform.OS === 'web' ? 20 : 56,
    paddingBottom: 20,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    gap: 20,
  },
  infoCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    gap: 12,
    ...Platform.select({
      web: { boxShadow: '0 4px 16px rgba(0,0,0,0.05)' },
      default: { elevation: 2 },
    }),
  } as any,
  infoTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: GREEN,
  },
  infoText: {
    textAlign: 'center',
    color: '#4b5563',
    lineHeight: 20,
  },
  featureCard: {
    backgroundColor: GREEN_LIGHT,
    borderRadius: 24,
    padding: 24,
    gap: 16,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: GREEN,
    marginBottom: 4,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: GREEN,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
    color: '#1f2937',
    fontSize: 14,
  },
  mainBtn: {
    backgroundColor: GREEN,
    borderRadius: 16,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 10,
  },
  mainBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  footerNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 10,
    lineHeight: 18,
  },
});
