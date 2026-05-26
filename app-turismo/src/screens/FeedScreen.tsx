import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  Platform,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';

interface FeedItem {
  id: string;
  title: string;
  location: string;
  category: string;
  description: string;
  imageUrl?: string;
  timeAgo: string;
  likes: number;
  commentsCount: number;
  hasLiked?: boolean;
  alertType?: 'alert' | 'promo' | 'info' | 'crowd';
  reporterName: string;
}

const INITIAL_FEED_ITEMS: FeedItem[] = [
  {
    id: 'f1',
    title: 'Muestra Gastronómica Kunstmann',
    location: 'Torobayo, Valdivia',
    category: 'gastronomia',
    description: '¡El patio cervecero está a máxima capacidad! La fila para ingresar es de unos 15 minutos, pero la música en vivo está excelente y vale la pena la espera.',
    imageUrl: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&q=80&w=800',
    timeAgo: 'Hace 5 min',
    likes: 42,
    commentsCount: 8,
    alertType: 'crowd',
    reporterName: 'Carlos M.',
  },
  {
    id: 'f2',
    title: 'Sendero de Lotos en Parque Saval',
    location: 'Isla Teja, Valdivia',
    category: 'naturaleza',
    description: '⚠️ Sendero este despejado, pero la pasarela norte tiene lodo por las lluvias de anoche. Recomiendo calzado técnico.',
    imageUrl: 'https://images.unsplash.com/photo-1440342359743-84fcb8c21f21?auto=format&fit=crop&q=80&w=800',
    timeAgo: 'Hace 20 min',
    likes: 19,
    commentsCount: 3,
    alertType: 'alert',
    reporterName: 'Sofia R.',
  },
  {
    id: 'f3',
    title: 'Feria del Chocolate Artesanal',
    location: 'Plaza de la República',
    category: 'gastronomia',
    description: '🎟️ ¡Aviso! El puesto "Dulzuras del Sur" tiene 20% de descuento en bombones rellenos con frutos nativos presentando el check-in de la App.',
    timeAgo: 'Hace 45 min',
    likes: 56,
    commentsCount: 12,
    alertType: 'promo',
    reporterName: 'Municipalidad Valdivia',
  },
  {
    id: 'f4',
    title: 'Exposición Histórica van de Maele',
    location: 'Museo UACh',
    category: 'cultura',
    description: 'Hermosa curatoría colonial hoy. Poca afluencia de público, ideal para venir con calma a tomar fotografías.',
    imageUrl: 'https://images.unsplash.com/photo-1565552643952-443e20e88b8d?auto=format&fit=crop&q=80&w=800',
    timeAgo: 'Hace 1 hora',
    likes: 28,
    commentsCount: 2,
    alertType: 'info',
    reporterName: 'Juan P.',
  },
];

export default function FeedScreen() {
  const [feedItems, setFeedItems] = useState<FeedItem[]>(INITIAL_FEED_ITEMS);
  const [newReportText, setNewReportText] = useState('');
  const [selectedAlertType, setSelectedAlertType] = useState<'alert' | 'promo' | 'info' | 'crowd' | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getAlertIcon = (type?: string) => {
    switch (type) {
      case 'alert':
        return { name: 'warning', color: '#FBBF24' }; // Yellow
      case 'promo':
        return { name: 'local-offer', color: '#10B981' }; // Green
      case 'crowd':
        return { name: 'people', color: '#EF4444' }; // Red
      default:
        return { name: 'info', color: '#3B82F6' }; // Blue
    }
  };

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'gastronomia':
        return '#EF4444';
      case 'naturaleza':
        return '#10B981';
      case 'cultura':
        return '#8B5CF6';
      case 'musica':
        return '#EC4899';
      default:
        return '#3B82F6';
    }
  };

  const handleLike = (id: string) => {
    setFeedItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            likes: item.hasLiked ? item.likes - 1 : item.likes + 1,
            hasLiked: !item.hasLiked,
          };
        }
        return item;
      })
    );
  };

  const handlePostReport = () => {
    if (!newReportText.trim()) return;
    setIsSubmitting(true);

    setTimeout(() => {
      const newItem: FeedItem = {
        id: `f-${Date.now()}`,
        title: selectedAlertType === 'alert' ? 'Alerta Comunitaria' : selectedAlertType === 'promo' ? 'Promoción Local' : 'Reporte de la Comunidad',
        location: 'Ubicación Actual',
        category: 'todos',
        description: newReportText,
        timeAgo: 'Ahora',
        likes: 0,
        commentsCount: 0,
        alertType: selectedAlertType || 'info',
        reporterName: 'Tú (Turista)',
      };

      setFeedItems([newItem, ...feedItems]);
      setNewReportText('');
      setSelectedAlertType(undefined);
      setIsSubmitting(false);
    }, 800);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* CABECERA */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <Text style={styles.kicker}>VIVENCIAS Y PANORAMAS</Text>
        <Text style={styles.title}>El Pulso de la Ciudad</Text>
        <Text style={styles.subtitle}>
          Entérate de lo que está pasando en vivo. Comparte alertas rápidas sobre tus visitas.
        </Text>
      </View>

      {/* CREAR ALERTA RÁPIDA (Estilo Waze) */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📢 Reporte al Instante</Text>
        <Text style={styles.cardSubtitle}>Comparte las condiciones del lugar donde te encuentras ahora mismo.</Text>

        <TextInput
          style={styles.textInput}
          placeholder="¿Cómo está el lugar? Fila, clima, promociones, alertas..."
          placeholderTextColor="#6B7280"
          value={newReportText}
          onChangeText={setNewReportText}
          multiline
          maxLength={200}
        />

        {/* SELECTOR DE ALERTA RÁPIDA */}
        <View style={styles.alertSelectorRow}>
          {(['alert', 'promo', 'crowd', 'info'] as const).map((type) => {
            const icon = getAlertIcon(type);
            const isSelected = selectedAlertType === type;
            const label = type === 'alert' ? 'Peligro' : type === 'promo' ? 'Promo' : type === 'crowd' ? 'Lleno' : 'Info';

            return (
              <TouchableOpacity
                key={type}
                activeOpacity={0.8}
                onPress={() => setSelectedAlertType(isSelected ? undefined : type)}
                style={[
                  styles.alertChip,
                  isSelected && { borderColor: icon.color, backgroundColor: 'rgba(255,255,255,0.06)' },
                ]}
              >
                <MaterialIcons name={icon.name} size={18} color={icon.color} />
                <Text style={[styles.alertChipText, isSelected && { color: icon.color }]}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePostReport}
          style={[styles.postButton, !newReportText.trim() && styles.disabledPostButton]}
          disabled={!newReportText.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#040914" />
          ) : (
            <>
              <MaterialIcons name="send" size={16} color="#040914" style={{ marginRight: 6 }} />
              <Text style={styles.postButtonText}>Reportar ahora</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* FEED DE TARJETAS */}
      <View style={{ gap: 20 }}>
        {feedItems.map((item) => {
          const alertInfo = item.alertType ? getAlertIcon(item.alertType) : null;
          const catColor = getCategoryColor(item.category);

          return (
            <View key={item.id} style={styles.feedCard}>
              {/* Imagen (si tiene) */}
              {item.imageUrl && (
                <View style={styles.cardImageContainer}>
                  <Image source={{ uri: item.imageUrl }} style={styles.cardImage} />
                  <View style={styles.imageOverlay} />
                  <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
                    <Text style={styles.categoryBadgeText}>{item.category.toUpperCase()}</Text>
                  </View>
                </View>
              )}

              <View style={styles.feedCardContent}>
                {/* Cabecera de la Tarjeta */}
                <View style={styles.cardHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardItemTitle}>{item.title}</Text>
                    <View style={styles.metaRow}>
                      <Ionicons name="location-outline" size={12} color="#9CA3AF" />
                      <Text style={styles.metaText}>{item.location}</Text>
                    </View>
                  </View>

                  {/* Icono de Alerta Rápida */}
                  {alertInfo && (
                    <View style={[styles.alertBadge, { borderColor: alertInfo.color }]}>
                      <MaterialIcons name={alertInfo.name} size={14} color={alertInfo.color} />
                      <Text style={[styles.alertBadgeText, { color: alertInfo.color }]}>
                        {item.alertType?.toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Descripción / Contenido */}
                <Text style={styles.cardDescription}>{item.description}</Text>

                {/* Divisor */}
                <View style={styles.divider} />

                {/* Footer de la Tarjeta */}
                <View style={styles.cardFooter}>
                  {/* Reportero */}
                  <View style={styles.reporterRow}>
                    <View style={styles.avatarTiny}>
                      <Ionicons name="person" size={12} color="#EAFBF1" />
                    </View>
                    <Text style={styles.reporterName}>{item.reporterName}</Text>
                    <Text style={styles.timeAgo}>• {item.timeAgo}</Text>
                  </View>

                  {/* Interacciones */}
                  <View style={styles.interactionsRow}>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => handleLike(item.id)}
                      style={styles.actionIconButton}
                    >
                      <Ionicons
                        name={item.hasLiked ? 'heart' : 'heart-outline'}
                        size={16}
                        color={item.hasLiked ? '#EF4444' : '#9CA3AF'}
                      />
                      <Text style={[styles.actionIconText, item.hasLiked && { color: '#EF4444' }]}>
                        {item.likes}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity activeOpacity={0.7} style={styles.actionIconButton}>
                      <Ionicons name="chatbubble-outline" size={15} color="#9CA3AF" />
                      <Text style={styles.actionIconText}>{item.commentsCount}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 32,
    paddingBottom: 90,
    gap: 24,
    backgroundColor: '#040914',
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  heroGlow: {
    position: 'absolute',
    top: -50,
    left: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: 'rgba(239, 68, 68, 0.12)', // Hot Coral Glow
  },
  kicker: {
    color: '#FCA5A5',
    textTransform: 'uppercase',
    letterSpacing: 2,
    fontSize: 10,
    fontWeight: '800',
  },
  title: {
    color: '#F5FAF7',
    fontSize: 26,
    fontWeight: '900',
    marginTop: 4,
  },
  subtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  card: {
    marginHorizontal: 16,
    borderRadius: 24,
    padding: 20,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '800',
  },
  cardSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  textInput: {
    minHeight: 64,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#F8FAFC',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    fontSize: 14,
    textAlignVertical: 'top',
  },
  alertSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  alertChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  alertChipText: {
    color: '#CBD5E0',
    fontSize: 11,
    fontWeight: '600',
    marginLeft: 4,
  },
  postButton: {
    minHeight: 44,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#34D399', // Emerald/green
    marginTop: 16,
  },
  disabledPostButton: {
    backgroundColor: '#1E293B',
    opacity: 0.5,
  },
  postButtonText: {
    color: '#040914',
    fontSize: 13,
    fontWeight: '800',
  },
  feedCard: {
    marginHorizontal: 16,
    borderRadius: 24,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    overflow: 'hidden',
  },
  cardImageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  feedCardContent: {
    padding: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardItemTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  metaText: {
    color: '#9CA3AF',
    fontSize: 11,
  },
  alertBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 3,
  },
  alertBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  cardDescription: {
    color: '#CBD5E0',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 10,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 12,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reporterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarTiny: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#34D399',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reporterName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  timeAgo: {
    color: '#6B7280',
    fontSize: 11,
  },
  interactionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionIconButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIconText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
});
