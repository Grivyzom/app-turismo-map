import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  ScrollView,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router, useLocalSearchParams } from 'expo-router';

import { API_URL } from '../config/api';
import {
  getPublicProfile,
  followUser,
  unfollowUser,
  type PublicUserProfile,
} from '../utils/profileApi';
import { toast } from '../components/ui/ToastNotification';

export default function PublicUserProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = Number(id);

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [followLoading, setFollowLoading] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void getPublicProfile(userId).then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, [userId]);

  const handleToggleFollow = async () => {
    if (!profile) return;
    setFollowLoading(true);
    const wasFollowing = profile.isFollowing;

    setProfile((prev) =>
      prev
        ? {
            ...prev,
            isFollowing: !wasFollowing,
            followerCount: wasFollowing ? prev.followerCount - 1 : prev.followerCount + 1,
          }
        : prev,
    );

    const ok = wasFollowing ? await unfollowUser(profile.id) : await followUser(profile.id);

    if (!ok) {
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              isFollowing: wasFollowing,
              followerCount: wasFollowing ? prev.followerCount + 1 : prev.followerCount - 1,
            }
          : prev,
      );
      toast.error({ title: 'No se pudo completar la acción' });
    }
    setFollowLoading(false);
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#6EE7B7" />
      </View>
    );
  }

  if (!profile) {
    return (
      <View style={[styles.container, styles.centered]}>
        <MaterialIcons name="person-off" size={48} color="#374151" />
        <Text style={styles.errorText}>Usuario no encontrado</Text>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtnCenter}>
          <Text style={styles.backBtnText}>Volver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const pictureUri = profile.picture
    ? profile.picture.startsWith('/static/')
      ? `${API_URL}${profile.picture}`
      : profile.picture
    : null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#6EE7B7" />
        </TouchableOpacity>
      </View>

      <View style={styles.profileSection}>
        <View style={styles.avatarWrapper}>
          {pictureUri ? (
            <Image source={{ uri: pictureUri }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <MaterialIcons name="person" size={56} color="#6EE7B7" />
            </View>
          )}
        </View>

        <Text style={styles.name}>{profile.name}</Text>

        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

        <View style={styles.countersRow}>
          <View style={styles.counterItem}>
            <Text style={styles.counterValue}>{profile.followerCount}</Text>
            <Text style={styles.counterLabel}>Seguidores</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.counterItem}>
            <Text style={styles.counterValue}>{profile.followingCount}</Text>
            <Text style={styles.counterLabel}>Siguiendo</Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.followButton, profile.isFollowing && styles.followingButton]}
          onPress={() => void handleToggleFollow()}
          disabled={followLoading}
          activeOpacity={0.85}
        >
          {followLoading ? (
            <ActivityIndicator size="small" color={profile.isFollowing ? '#9CA3AF' : '#081018'} />
          ) : (
            <>
              <MaterialIcons
                name={profile.isFollowing ? 'person-remove' : 'person-add'}
                size={18}
                color={profile.isFollowing ? '#9CA3AF' : '#081018'}
              />
              <Text
                style={[styles.followButtonText, profile.isFollowing && styles.followingButtonText]}
              >
                {profile.isFollowing ? 'Dejar de seguir' : 'Seguir'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.identityNote}>
        <MaterialIcons name="info-outline" size={16} color="#6B7280" />
        <Text style={styles.identityNoteText}>
          Este es el perfil público de un ciudadano. Solo se muestra información de identidad.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  content: {
    paddingBottom: 48,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  header: {
    paddingTop: 48,
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backBtn: {
    padding: 4,
    alignSelf: 'flex-start',
  },
  profileSection: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 12,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    borderColor: 'rgba(110,231,183,0.4)',
    overflow: 'hidden',
    backgroundColor: '#1F2937',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: {
    color: '#F9FAFB',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  bio: {
    color: '#D1D5DB',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 280,
  },
  countersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 4,
  },
  counterItem: {
    alignItems: 'center',
    gap: 2,
  },
  counterValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '800',
  },
  counterLabel: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#6EE7B7',
    marginTop: 8,
  },
  followingButton: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  followButtonText: {
    color: '#081018',
    fontSize: 15,
    fontWeight: '700',
  },
  followingButtonText: {
    color: '#9CA3AF',
  },
  identityNote: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 24,
    marginTop: 32,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  identityNoteText: {
    flex: 1,
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
  },
  errorText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  backBtnCenter: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: 'rgba(110,231,183,0.1)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.3)',
  },
  backBtnText: {
    color: '#6EE7B7',
    fontWeight: '700',
  },
});
