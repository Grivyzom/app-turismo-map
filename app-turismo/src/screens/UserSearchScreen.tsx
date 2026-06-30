import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';

import { API_URL } from '../config/api';
import { searchUsers, followUser, unfollowUser, type UserSearchResult } from '../utils/profileApi';
import { toast } from '../components/ui/ToastNotification';

export default function UserSearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setResults([]);
      return;
    }

    debounceRef.current = setTimeout(() => {
      setLoading(true);
      void searchUsers(query.trim()).then((data) => {
        setResults(data);
        setLoading(false);
      });
    }, 400);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleToggleFollow = async (item: UserSearchResult) => {
    const wasFollowing = item.isFollowing;
    setResults((prev) =>
      prev.map((u) =>
        u.id === item.id
          ? {
              ...u,
              isFollowing: !wasFollowing,
              followerCount: wasFollowing ? u.followerCount - 1 : u.followerCount + 1,
            }
          : u,
      ),
    );

    const ok = wasFollowing ? await unfollowUser(item.id) : await followUser(item.id);
    if (!ok) {
      setResults((prev) =>
        prev.map((u) =>
          u.id === item.id
            ? {
                ...u,
                isFollowing: wasFollowing,
                followerCount: wasFollowing ? u.followerCount + 1 : u.followerCount - 1,
              }
            : u,
        ),
      );
      toast.error({ title: 'No se pudo completar la acción' });
    }
  };

  const renderItem = ({ item }: { item: UserSearchResult }) => (
    <View style={styles.resultRow}>
      <TouchableOpacity
        style={styles.userInfo}
        onPress={() => router.push(`/(home)/user/${item.id}` as never)}
        activeOpacity={0.8}
      >
        <View style={styles.avatarCircle}>
          {item.picture ? (
            <Image
              source={{
                uri: item.picture.startsWith('/static/')
                  ? `${API_URL}${item.picture}`
                  : item.picture,
              }}
              style={styles.avatarImage}
            />
          ) : (
            <MaterialIcons name="person" size={28} color="#6EE7B7" />
          )}
        </View>
        <View style={styles.userMeta}>
          <Text style={styles.userName}>{item.name}</Text>
          <Text style={styles.userFollowers}>
            {item.followerCount} {item.followerCount === 1 ? 'seguidor' : 'seguidores'}
          </Text>
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.followBtn, item.isFollowing && styles.followingBtn]}
        onPress={() => void handleToggleFollow(item)}
        activeOpacity={0.85}
      >
        <Text style={[styles.followBtnText, item.isFollowing && styles.followingBtnText]}>
          {item.isFollowing ? 'Siguiendo' : 'Seguir'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#6EE7B7" />
        </TouchableOpacity>
        <Text style={styles.title}>Buscar personas</Text>
      </View>

      <View style={styles.searchBox}>
        <MaterialIcons name="search" size={20} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar por nombre..."
          placeholderTextColor="#6B7280"
          style={styles.searchInput}
          autoFocus
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <MaterialIcons name="close" size={18} color="#9CA3AF" />
          </TouchableOpacity>
        )}
      </View>

      {loading && <ActivityIndicator size="small" color="#6EE7B7" style={{ marginTop: 24 }} />}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <View style={styles.empty}>
          <MaterialIcons name="person-search" size={48} color="#374151" />
          <Text style={styles.emptyText}>Sin resultados para "{query}"</Text>
        </View>
      )}

      {!loading && query.trim().length < 2 && (
        <View style={styles.empty}>
          <MaterialIcons name="people" size={48} color="#374151" />
          <Text style={styles.emptyText}>Escribí al menos 2 caracteres para buscar</Text>
        </View>
      )}

      <FlatList
        data={results}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
    paddingTop: 48,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '800',
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 10,
    marginHorizontal: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: '#F9FAFB',
    fontSize: 15,
  },
  list: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  userInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.2)',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userMeta: {
    gap: 2,
  },
  userName: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '700',
  },
  userFollowers: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  followBtn: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.35)',
  },
  followingBtn: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderColor: 'rgba(255,255,255,0.12)',
  },
  followBtnText: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '700',
  },
  followingBtnText: {
    color: '#9CA3AF',
  },
  empty: {
    alignItems: 'center',
    marginTop: 48,
    gap: 12,
  },
  emptyText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
  },
});
