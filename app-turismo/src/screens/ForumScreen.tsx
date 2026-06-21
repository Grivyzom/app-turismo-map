import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

interface ForumThread {
  id: string;
  question: string;
  category: string;
  zone: string;
  repliesCount: number;
  votes: number;
  hasVoted?: boolean;
  authorName: string;
  timeAgo: string;
  tags: string[];
}

const INITIAL_THREADS: ForumThread[] = [
  {
    id: 't1',
    question: '¿Saben si cobran entrada hoy en el Parque Saval por el festival de la cerveza?',
    category: 'naturaleza',
    zone: 'Isla Teja, Valdivia',
    repliesCount: 5,
    votes: 14,
    authorName: 'Andrés G.',
    timeAgo: 'Hace 10 min',
    tags: ['Parque Saval', 'Entradas', 'Kunstmann'],
  },
  {
    id: 't2',
    question: '¿Cómo está el viento para cruzar en transbordador a Corral hoy por la tarde?',
    category: 'cultura',
    zone: 'Niebla / Corral',
    repliesCount: 3,
    votes: 9,
    authorName: 'Sofia R.',
    timeAgo: 'Hace 45 min',
    tags: ['Navegación', 'Clima', 'Niebla'],
  },
  {
    id: 't3',
    question: '¿Alguna picada o recomendación de almuerzo vegetariano cerca de la costanera?',
    category: 'gastronomia',
    zone: 'Centro Histórico',
    repliesCount: 8,
    votes: 22,
    authorName: 'Valentina P.',
    timeAgo: 'Hace 2 horas',
    tags: ['Almuerzo', 'Vegetariano', 'Costanera'],
  },
  {
    id: 't4',
    question: '¿Hasta qué hora están abiertos los museos de la UACh el domingo por la tarde?',
    category: 'cultura',
    zone: 'Isla Teja',
    repliesCount: 2,
    votes: 6,
    authorName: 'Carlos M.',
    timeAgo: 'Hace 4 horas',
    tags: ['Museos', 'Horarios', 'Domingo'],
  },
];

export default function ForumScreen() {
  const [threads, setThreads] = useState<ForumThread[]>(INITIAL_THREADS);
  const [newQuestionText, setNewQuestionText] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('todos');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getCategoryColor = (cat: string) => {
    switch (cat.toLowerCase()) {
      case 'gastronomia':
        return '#EF4444'; // Red
      case 'naturaleza':
        return '#10B981'; // Green
      case 'cultura':
        return '#8B5CF6'; // Purple
      default:
        return '#3B82F6'; // Blue
    }
  };

  const handleVote = (id: string) => {
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id === id) {
          return {
            ...thread,
            votes: thread.hasVoted ? thread.votes - 1 : thread.votes + 1,
            hasVoted: !thread.hasVoted,
          };
        }
        return thread;
      }),
    );
  };

  const handlePostQuestion = () => {
    if (!newQuestionText.trim()) return;
    setIsSubmitting(true);

    setTimeout(() => {
      const newThread: ForumThread = {
        id: `t-${Date.now()}`,
        question: newQuestionText,
        category: selectedCategory === 'todos' ? 'cultura' : selectedCategory,
        zone: 'Cerca de mí',
        repliesCount: 0,
        votes: 0,
        authorName: 'Tú (Explorador)',
        timeAgo: 'Ahora',
        tags: ['Pregunta', 'Comunidad'],
      };

      setThreads([newThread, ...threads]);
      setNewQuestionText('');
      setIsSubmitting(false);
    }, 800);
  };

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      {/* CABECERA */}
      <View style={styles.heroCard}>
        <View style={styles.heroGlow} />
        <Text style={styles.kicker}>CONSULTAS Y DATO LOCAL</Text>
        <Text style={styles.title}>Inteligencia Colectiva</Text>
        <Text style={styles.subtitle}>
          Resuelve dudas al instante con aportes directos de otros turistas y vecinos de la zona.
        </Text>
      </View>

      {/* PUBLICADOR DE PREGUNTAS */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Haz una Consulta</Text>
        <Text style={styles.cardSubtitle}>
          Pregunta sobre accesos, precios, clima o recomendaciones.
        </Text>

        <TextInput
          style={styles.textInput}
          placeholder="¿Qué te gustaría saber sobre los panoramas de hoy?"
          placeholderTextColor="#6B7280"
          value={newQuestionText}
          onChangeText={setNewQuestionText}
          multiline
          maxLength={150}
        />

        {/* SELECTOR CATEGORÍA PREGUNTA */}
        <View style={styles.categorySelectorRow}>
          {(['todos', 'gastronomia', 'cultura', 'naturaleza'] as const).map((cat) => {
            const isSelected = selectedCategory === cat;
            const catColor = cat === 'todos' ? '#3B82F6' : getCategoryColor(cat);
            const label = cat.charAt(0).toUpperCase() + cat.slice(1);

            return (
              <TouchableOpacity
                key={cat}
                activeOpacity={0.8}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryChip,
                  isSelected && { borderColor: catColor, backgroundColor: `${catColor}15` },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: catColor }]} />
                <Text style={[styles.categoryChipText, isSelected && { color: catColor }]}>
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePostQuestion}
          style={[styles.postButton, !newQuestionText.trim() && styles.disabledPostButton]}
          disabled={!newQuestionText.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#040914" />
          ) : (
            <>
              <MaterialIcons
                name="add-comment"
                size={16}
                color="#040914"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.postButtonText}>Publicar duda</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* LISTADO DE PREGUNTAS / HILOS */}
      <View style={{ gap: 16 }}>
        {threads.map((thread) => {
          const catColor = getCategoryColor(thread.category);

          return (
            <View key={thread.id} style={styles.threadCard}>
              <View style={styles.threadHeader}>
                <View style={styles.authorRow}>
                  <View style={styles.avatarTiny}>
                    <Ionicons name="person" size={10} color="#EAFBF1" />
                  </View>
                  <Text style={styles.authorName}>{thread.authorName}</Text>
                  <Text style={styles.timeAgo}>• {thread.timeAgo}</Text>
                </View>
                <View
                  style={[
                    styles.zoneBadge,
                    { backgroundColor: `${catColor}15`, borderColor: `${catColor}35` },
                  ]}
                >
                  <Text style={[styles.zoneBadgeText, { color: catColor }]}>{thread.zone}</Text>
                </View>
              </View>

              <Text style={styles.threadQuestion}>{thread.question}</Text>

              {/* Tags */}
              <View style={styles.tagsContainer}>
                {thread.tags.map((tag) => (
                  <View key={tag} style={styles.tagBadge}>
                    <Text style={styles.tagText}>#{tag}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.divider} />

              <View style={styles.threadFooter}>
                {/* Votar utilidad de la pregunta */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => handleVote(thread.id)}
                  style={[styles.voteButton, thread.hasVoted && styles.voteButtonActive]}
                >
                  <Ionicons
                    name="arrow-up"
                    size={14}
                    color={thread.hasVoted ? '#34D399' : '#9CA3AF'}
                  />
                  <Text style={[styles.voteText, thread.hasVoted && { color: '#34D399' }]}>
                    {thread.votes} {thread.votes === 1 ? 'Voto' : 'Votos'}
                  </Text>
                </TouchableOpacity>

                {/* Comentarios/Respuestas */}
                <TouchableOpacity activeOpacity={0.8} style={styles.repliesButton}>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color="#6EE7B7" />
                  <Text style={styles.repliesText}>{thread.repliesCount} Respuestas</Text>
                </TouchableOpacity>
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
    backgroundColor: 'transparent',
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
    backgroundColor: 'rgba(139, 92, 246, 0.12)', // Purple glow
  },
  kicker: {
    color: '#C4B5FD',
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
  categorySelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  categoryChipText: {
    color: '#CBD5E0',
    fontSize: 11,
    fontWeight: '600',
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
  threadCard: {
    marginHorizontal: 16,
    borderRadius: 20,
    padding: 16,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  threadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  avatarTiny: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  timeAgo: {
    color: '#6B7280',
    fontSize: 11,
  },
  zoneBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
  },
  zoneBadgeText: {
    fontSize: 9,
    fontWeight: '700',
  },
  threadQuestion: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tagText: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    marginVertical: 12,
  },
  threadFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  voteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  voteButtonActive: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderColor: 'rgba(52, 211, 153, 0.35)',
  },
  voteText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '600',
  },
  repliesButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repliesText: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '700',
  },
});
