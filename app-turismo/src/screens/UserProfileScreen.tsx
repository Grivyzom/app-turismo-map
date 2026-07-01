import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Platform,
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';

import { API_URL } from '../config/api';
import { getCachedToken } from '../utils/tokenCache';
import { toast } from '../components/ui/ToastNotification';
import { getMyProfile, updateProfile, uploadAvatar, type MyProfile } from '../utils/profileApi';
import {
  buildTwoFactorOtpUri,
  getDefaultUserProfile,
  generateTwoFactorSecret,
  loadUserProfile,
  saveUserProfile,
  type NormalUserProfile,
} from '../utils/userProfileStorage';

interface Collection {
  id: number;
  name: string;
  itemCount: number;
  createdAt: string;
}

interface SavedLocation {
  id: number;
  collectionId: number;
  locationType: string;
  refId: string;
  latitude: number;
  longitude: number;
  title: string;
  notes: string;
}

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB

const AVATAR_COLORS = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#06B6D4'];

function AvatarPlaceholder({ name, size }: { name: string; size: number }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
  const color = AVATAR_COLORS[(name.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.38, fontWeight: '800' }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

const userTypeLabels: Record<NormalUserProfile['userType'], string> = {
  citizen: 'Turista',
  partner_owner: 'Entidad',
  guest: 'Invitado',
  admin: 'Administrador',
  partner_worker: 'Trabajador',
};

const formatDate = (isoDate: string) => {
  try {
    return new Intl.DateTimeFormat('es-CL', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
};

export default function UserProfileScreen() {
  const [profile, setProfile] = useState<NormalUserProfile>(getDefaultUserProfile());
  const [fullName, setFullName] = useState(profile.fullName);
  const [email, setEmail] = useState(profile.email);
  const [location, setLocation] = useState(profile.location);
  const [bio, setBio] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [securityNotice, setSecurityNotice] = useState('');
  const [activeTab, setActiveTab] = useState<'colecciones' | 'asistencias' | 'likes' | 'ratings'>(
    'colecciones',
  );
  const [isEditing, setIsEditing] = useState(false);

  // Backend profile state
  const [backendProfile, setBackendProfile] = useState<MyProfile | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(false);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [locations, setLocations] = useState<SavedLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(false);

  const metrics = {
    posts: 0,
    followers: backendProfile?.followerCount ?? 0,
    following: backendProfile?.followingCount ?? 0,
  };

  useEffect(() => {
    if (activeTab === 'colecciones' && !isEditing) {
      void fetchCollections();
    }
  }, [activeTab, isEditing]);

  const fetchCollections = async () => {
    setLoadingCollections(true);
    try {
      const token = await getCachedToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/v1/collections`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCollections(data);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron cargar las colecciones');
    } finally {
      setLoadingCollections(false);
    }
  };

  const fetchLocations = async (collection: Collection) => {
    setSelectedCollection(collection);
    setLoadingLocations(true);
    try {
      const token = await getCachedToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/v1/collections/${collection.id}/locations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLocations(data);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron cargar las ubicaciones');
    } finally {
      setLoadingLocations(false);
    }
  };

  const createCollection = async (name: string) => {
    try {
      const token = await getCachedToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/v1/collections`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name }),
      });

      if (response.ok) {
        const newCollection = await response.json();
        setCollections((prev) => [newCollection, ...prev]);
        toast.success({ title: `Colección "${name}" creada exitosamente` });
      } else {
        toast.error({ title: 'No se pudo crear la colección' });
      }
    } catch (error) {
      console.error(error);
      toast.error({ title: 'Error al crear la colección' });
    }
  };

  const deleteCollection = async (collectionId: number, collectionName: string) => {
    try {
      const token = await getCachedToken();
      if (!token) return;

      const response = await fetch(`${API_URL}/api/v1/collections/${collectionId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        setCollections((prev) => prev.filter((c) => c.id !== collectionId));
        setSelectedCollection(null);
        toast.success({ title: `Colección "${collectionName}" eliminada` });
      } else {
        toast.error({ title: 'No se pudo eliminar la colección' });
      }
    } catch (error) {
      console.error(error);
      toast.error({ title: 'Error al eliminar la colección' });
    }
  };

  const deleteLocation = async (locationId: number, locationTitle: string) => {
    try {
      const token = await getCachedToken();
      if (!token) return;

      const response = await fetch(
        `${API_URL}/api/v1/collections/${selectedCollection?.id}/locations/${locationId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      if (response.ok) {
        setLocations((prev) => prev.filter((l) => l.id !== locationId));
        toast.success({ title: `"${locationTitle}" removida de la colección` });
      } else {
        toast.error({ title: 'No se pudo eliminar la ubicación' });
      }
    } catch (error) {
      console.error(error);
      toast.error({ title: 'Error al eliminar la ubicación' });
    }
  };

  useEffect(() => {
    let isMounted = true;

    void loadUserProfile().then((storedProfile) => {
      if (!isMounted) return;
      const nextProfile = storedProfile ?? getDefaultUserProfile();
      setProfile(nextProfile);
      setFullName(nextProfile.fullName);
      setEmail(nextProfile.email);
      setLocation(nextProfile.location);
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    void getMyProfile().then((p) => {
      if (p) {
        setBackendProfile(p);
        setBio(p.bio ?? '');
        if (p.name) setFullName(p.name);
      }
    });
  }, []);

  const handlePickAvatar = async () => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/jpeg,image/png,image/webp,image/gif';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        if (file.size > MAX_AVATAR_BYTES) {
          toast.error({ title: 'La imagen supera el límite de 5 MB' });
          return;
        }
        const reader = new FileReader();
        reader.onload = async (ev) => {
          const dataUri = ev.target?.result as string;
          if (!dataUri) return;
          setUploadingAvatar(true);
          const uploadResult = await uploadAvatar(dataUri);
          setUploadingAvatar(false);
          if (uploadResult.ok) {
            setBackendProfile((prev) => (prev ? { ...prev, picture: uploadResult.url } : prev));
            toast.success({ title: 'Foto de perfil actualizada' });
          } else {
            toast.error({ title: uploadResult.error });
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para cambiar la foto.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.75,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    if (asset.fileSize !== undefined && asset.fileSize > MAX_AVATAR_BYTES) {
      Alert.alert('Imagen muy grande', 'La imagen supera el límite de 5 MB. Elegí una imagen más pequeña.');
      return;
    }

    setUploadingAvatar(true);
    const uploadResult = await uploadAvatar(asset.uri);
    setUploadingAvatar(false);

    if (uploadResult.ok) {
      setBackendProfile((prev) => (prev ? { ...prev, picture: uploadResult.url } : prev));
      toast.success({ title: 'Foto de perfil actualizada' });
    } else {
      toast.error({ title: uploadResult.error });
    }
  };

  const handleSaveProfile = async () => {
    try {
      const [, backendOk] = await Promise.all([
        saveUserProfile({ ...profile, fullName, email, location }),
        updateProfile({ name: fullName, bio }),
      ]);

      const nextProfile = await saveUserProfile({ ...profile, fullName, email, location });
      setProfile(nextProfile);
      setFullName(nextProfile.fullName);
      setEmail(nextProfile.email);
      setLocation(nextProfile.location);

      if (backendOk) {
        setBackendProfile((prev) => (prev ? { ...prev, name: fullName, bio } : prev));
        toast.success({ title: 'Perfil guardado exitosamente' });
      } else {
        toast.success({ title: 'Guardado localmente (sin conexión al servidor)' });
      }
    } catch (error) {
      console.error(error);
      toast.error({ title: 'Error al guardar el perfil' });
    }
  };

  const handleToggleTwoFactor = async () => {
    if (profile.twoFactorEnabled) {
      const nextProfile = await saveUserProfile({
        ...profile,
        fullName,
        email,
        location,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      });

      setProfile(nextProfile);
      setSecurityNotice('Verificación en dos pasos desactivada.');
      return;
    }

    const secret = await generateTwoFactorSecret();
    const nextProfile = await saveUserProfile({
      ...profile,
      fullName,
      email,
      location,
      twoFactorEnabled: true,
      twoFactorSecret: secret,
    });

    setProfile(nextProfile);
    setSecurityNotice(
      'Verificación en dos pasos activada. Agrega la clave en Google Authenticator.',
    );
  };

  const infoRows = [
    { label: 'Tipo de cuenta', value: userTypeLabels[profile.userType] },
    { label: 'Seguridad', value: profile.twoFactorEnabled ? '2 pasos activo' : 'Solo contraseña' },
    { label: 'Creado', value: formatDate(profile.createdAt) },
    { label: 'Actualizado', value: formatDate(profile.updatedAt) },
  ];

  const [twoFactorUri, setTwoFactorUri] = React.useState('');

  React.useEffect(() => {
    if (profile.twoFactorSecret) {
      void buildTwoFactorOtpUri(
        { email: email || profile.email, fullName: fullName || profile.fullName },
        profile.twoFactorSecret,
      ).then(setTwoFactorUri);
    } else {
      setTwoFactorUri('');
    }
  }, [profile.twoFactorSecret, email, fullName, profile.email, profile.fullName]);

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.profileHeaderContainer}>
        <View style={styles.topRow}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={() => void handlePickAvatar()}
            activeOpacity={0.85}
          >
            <View style={styles.avatarMain}>
              {backendProfile?.picture ? (
                <Image
                  source={{
                    uri: backendProfile.picture.startsWith('/static/')
                      ? `${API_URL}${backendProfile.picture}`
                      : backendProfile.picture,
                  }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                />
              ) : (
                <AvatarPlaceholder name={fullName || 'U'} size={80} />
              )}
            </View>
            <View style={styles.avatarCameraOverlay}>
              {uploadingAvatar ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <MaterialIcons name="photo-camera" size={14} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>

          <View style={styles.metricsRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.followers}</Text>
              <Text style={styles.metricLabel}>Seguidores</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.following}</Text>
              <Text style={styles.metricLabel}>Seguidos</Text>
            </View>
            <TouchableOpacity
              style={styles.metricItem}
              onPress={() => router.push('/(home)/user-search' as never)}
            >
              <MaterialIcons name="person-search" size={22} color="#6EE7B7" />
              <Text style={styles.metricLabel}>Buscar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.metricItem}
              onPress={() => router.push('/(home)/notifications' as never)}
            >
              <MaterialIcons name="notifications-none" size={22} color="#6EE7B7" />
              <Text style={styles.metricLabel}>Notificaciones</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.bioContainer}>
          <Text style={styles.bioName}>{profile.fullName}</Text>
          <View style={styles.typeBadge}>
            <Text style={styles.typeBadgeText}>{userTypeLabels[profile.userType]}</Text>
          </View>
          <Text style={styles.bioLocation}>
            <MaterialIcons name="location-on" size={14} color="#9CA3AF" />{' '}
            {profile.location || 'Sin ubicación'}
          </Text>
          {bio ? <Text style={styles.bioText}>{bio}</Text> : null}
        </View>

        <View style={styles.actionButtonsRow}>
          <TouchableOpacity
            style={[styles.actionButton, styles.primaryActionButton]}
            onPress={() => setIsEditing(!isEditing)}
          >
            <Text style={styles.actionButtonText}>
              {isEditing ? 'Ver Perfil' : 'Editar perfil'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.secondaryActionButton]}>
            <Text style={styles.actionButtonText}>Compartir perfil</Text>
          </TouchableOpacity>
        </View>
      </View>

      {!isEditing && (
        <>
          <View style={styles.tabBar}>
            <TouchableOpacity
              onPress={() => setActiveTab('colecciones')}
              style={[styles.tabItem, activeTab === 'colecciones' && styles.activeTabItem]}
            >
              <MaterialIcons
                name="bookmark-outline"
                size={24}
                color={activeTab === 'colecciones' ? '#6EE7B7' : '#9CA3AF'}
              />
              <Text style={[styles.tabText, activeTab === 'colecciones' && styles.activeTabText]}>
                Guardados
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('asistencias')}
              style={[styles.tabItem, activeTab === 'asistencias' && styles.activeTabItem]}
            >
              <MaterialIcons
                name="event-available"
                size={24}
                color={activeTab === 'asistencias' ? '#6EE7B7' : '#9CA3AF'}
              />
              <Text style={[styles.tabText, activeTab === 'asistencias' && styles.activeTabText]}>
                Asistencias
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('likes')}
              style={[styles.tabItem, activeTab === 'likes' && styles.activeTabItem]}
            >
              <MaterialIcons
                name="favorite-outline"
                size={24}
                color={activeTab === 'likes' ? '#6EE7B7' : '#9CA3AF'}
              />
              <Text style={[styles.tabText, activeTab === 'likes' && styles.activeTabText]}>
                Likes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setActiveTab('ratings')}
              style={[styles.tabItem, activeTab === 'ratings' && styles.activeTabItem]}
            >
              <MaterialIcons
                name="star-outline"
                size={24}
                color={activeTab === 'ratings' ? '#6EE7B7' : '#9CA3AF'}
              />
              <Text style={[styles.tabText, activeTab === 'ratings' && styles.activeTabText]}>
                Ratings
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.tabContentContainer}>
            {activeTab === 'colecciones' && (
              <View style={styles.collectionsTabContainer}>
                {selectedCollection ? (
                  <View>
                    <TouchableOpacity
                      onPress={() => setSelectedCollection(null)}
                      style={styles.backButtonInline}
                    >
                      <MaterialIcons name="arrow-back" size={20} color="#6EE7B7" />
                      <Text style={styles.backButtonInlineText}>Volver a mis colecciones</Text>
                    </TouchableOpacity>

                    <Text style={styles.collectionDetailTitle}>{selectedCollection.name}</Text>

                    {loadingLocations ? (
                      <ActivityIndicator
                        size="small"
                        color="#6EE7B7"
                        style={{ marginVertical: 20 }}
                      />
                    ) : locations.length > 0 ? (
                      locations.map((item) => (
                        <View key={item.id} style={styles.locationRowWrapper}>
                          <TouchableOpacity
                            style={styles.locationCardInline}
                            onPress={() =>
                              router.push(`/?lat=${item.latitude}&lng=${item.longitude}`)
                            }
                          >
                            <View style={styles.locationIconInline}>
                              <MaterialIcons
                                name={item.locationType === 'event' ? 'event' : 'place'}
                                size={22}
                                color="#6EE7B7"
                              />
                            </View>
                            <View style={styles.locationInfoInline}>
                              <Text style={styles.locationTitleInline}>{item.title}</Text>
                              {item.notes ? (
                                <Text style={styles.locationNotesInline} numberOfLines={1}>
                                  {item.notes}
                                </Text>
                              ) : null}
                            </View>
                            <MaterialIcons name="navigation" size={20} color="#6EE7B7" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Eliminar ubicación',
                                `¿Remover "${item.title}" de esta colección?`,
                                [
                                  { text: 'Cancelar', style: 'cancel' },
                                  {
                                    text: 'Remover',
                                    style: 'destructive',
                                    onPress: () => void deleteLocation(item.id, item.title),
                                  },
                                ],
                              );
                            }}
                            style={styles.deleteLocationButton}
                          >
                            <MaterialIcons name="delete" size={16} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.emptyTabText}>No hay ubicaciones guardadas aquí.</Text>
                    )}
                  </View>
                ) : (
                  <View>
                    <View style={styles.tabSectionHeader}>
                      <Text style={styles.tabSectionTitle}>Mis Colecciones</Text>
                      <View style={styles.tabHeaderActions}>
                        <TouchableOpacity onPress={() => void fetchCollections()}>
                          <MaterialIcons name="refresh" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            Alert.prompt(
                              'Nueva colección',
                              'Nombre de la colección:',
                              [
                                { text: 'Cancelar', onPress: () => {}, style: 'cancel' },
                                {
                                  text: 'Crear',
                                  onPress: (name) => {
                                    if (name?.trim()) {
                                      void createCollection(name);
                                    }
                                  },
                                },
                              ],
                              'plain-text',
                            );
                          }}
                          style={{ marginLeft: 12 }}
                        >
                          <MaterialIcons name="add-circle-outline" size={20} color="#6EE7B7" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {loadingCollections ? (
                      <ActivityIndicator
                        size="small"
                        color="#6EE7B7"
                        style={{ marginVertical: 20 }}
                      />
                    ) : collections.length > 0 ? (
                      collections.map((item) => (
                        <View key={item.id} style={styles.collectionRowWrapper}>
                          <TouchableOpacity
                            style={styles.collectionCardInline}
                            onPress={() => void fetchLocations(item)}
                          >
                            <View style={styles.collectionIconInline}>
                              <MaterialIcons name="folder" size={24} color="#6EE7B7" />
                            </View>
                            <View style={styles.collectionInfoInline}>
                              <Text style={styles.collectionNameInline}>{item.name}</Text>
                              <Text style={styles.collectionCountInline}>
                                {item.itemCount || 0} lugares guardados
                              </Text>
                            </View>
                            <MaterialIcons name="chevron-right" size={24} color="#4B5563" />
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => {
                              Alert.alert(
                                'Eliminar colección',
                                `¿Estás seguro? Se eliminarán todos los lugares en "${item.name}".`,
                                [
                                  { text: 'Cancelar', style: 'cancel' },
                                  {
                                    text: 'Eliminar',
                                    style: 'destructive',
                                    onPress: () => void deleteCollection(item.id, item.name),
                                  },
                                ],
                              );
                            }}
                            style={styles.deleteCollectionButton}
                          >
                            <MaterialIcons name="delete" size={18} color="#EF4444" />
                          </TouchableOpacity>
                        </View>
                      ))
                    ) : (
                      <View style={styles.placeholderContent}>
                        <MaterialIcons name="collections-bookmark" size={48} color="#374151" />
                        <Text style={styles.placeholderTitle}>Tus Colecciones</Text>
                        <Text style={styles.placeholderSubtitle}>
                          Organiza tus lugares favoritos en carpetas personalizadas.
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}
            {activeTab === 'asistencias' && (
              <View style={styles.placeholderContent}>
                <MaterialIcons name="event" size={48} color="#374151" />
                <Text style={styles.placeholderTitle}>Sin asistencias aún</Text>
                <Text style={styles.placeholderSubtitle}>
                  Los eventos a los que confirmes asistencia aparecerán aquí.
                </Text>
              </View>
            )}
            {activeTab === 'likes' && (
              <View style={styles.placeholderContent}>
                <MaterialIcons name="favorite" size={48} color="#374151" />
                <Text style={styles.placeholderTitle}>Lugares que te gustan</Text>
                <Text style={styles.placeholderSubtitle}>
                  Dale like a lugares para guardarlos rápidamente en esta lista.
                </Text>
              </View>
            )}
            {activeTab === 'ratings' && (
              <View style={styles.placeholderContent}>
                <MaterialIcons name="rate-review" size={48} color="#374151" />
                <Text style={styles.placeholderTitle}>Tus Valoraciones</Text>
                <Text style={styles.placeholderSubtitle}>
                  Aquí verás los comentarios y estrellas que has dejado en el mapa.
                </Text>
              </View>
            )}
          </View>
        </>
      )}

      {isEditing && (
        <>
          <View style={styles.infoCard}>
            <Text style={styles.cardTitle}>Editar información base</Text>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Nombre</Text>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                placeholder="Tu nombre"
                placeholderTextColor="#6B7280"
                style={styles.textInput}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Correo</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="tu@email.com"
                placeholderTextColor="#6B7280"
                autoCapitalize="none"
                keyboardType="email-address"
                style={styles.textInput}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Ubicación</Text>
              <TextInput
                value={location}
                onChangeText={setLocation}
                placeholder="Ciudad o región"
                placeholderTextColor="#6B7280"
                style={styles.textInput}
              />
            </View>

            <View style={styles.fieldBlock}>
              <Text style={styles.fieldLabel}>Bio</Text>
              <TextInput
                value={bio}
                onChangeText={(t) => setBio(t.slice(0, 160))}
                placeholder="Cuéntanos sobre vos..."
                placeholderTextColor="#6B7280"
                style={[styles.textInput, { height: 72, textAlignVertical: 'top' }]}
                multiline
                numberOfLines={3}
                maxLength={160}
              />
              <Text style={{ color: '#6B7280', fontSize: 11, textAlign: 'right', marginTop: 2 }}>
                {bio.length}/160
              </Text>
            </View>

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => void handleSaveProfile()}
              style={styles.saveButton}
            >
              <Text style={styles.saveButtonText}>Guardar cambios</Text>
            </TouchableOpacity>

            {infoRows.map((row) => (
              <View key={row.label} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{row.label}</Text>
                <Text style={styles.infoValue}>{row.value}</Text>
              </View>
            ))}

            <Text style={styles.note}>
              {isLoading
                ? 'Cargando datos...'
                : 'Los datos base se toman de tu sesión y quedan visibles aquí.'}
            </Text>
          </View>

          <View style={styles.securityCard}>
            <View style={styles.iconHeader}>
              <View>
                <Text style={styles.cardTitle}>Google Authenticator</Text>
                <Text style={styles.iconSubtitle}>
                  Protege tu cuenta con un código de 6 dígitos que cambia cada 30 segundos.
                </Text>
              </View>

              <TouchableOpacity
                activeOpacity={0.9}
                onPress={() => void handleToggleTwoFactor()}
                style={[styles.securityToggle, profile.twoFactorEnabled && styles.securityToggleOn]}
              >
                <Text style={styles.securityToggleText}>
                  {profile.twoFactorEnabled ? 'Desactivar' : 'Activar'}
                </Text>
              </TouchableOpacity>
            </View>

            {profile.twoFactorEnabled ? (
              <View style={styles.securityBody}>
                <Text style={styles.securityLabel}>Clave manual para Google Authenticator</Text>
                <View style={styles.secretBox}>
                  <Text selectable style={styles.secretText}>
                    {profile.twoFactorSecret || 'No disponible'}
                  </Text>
                </View>

                <Text style={styles.securityLabel}>URI otpauth</Text>
                <View style={styles.secretBox}>
                  <Text selectable style={styles.secretText}>
                    {twoFactorUri || 'No disponible'}
                  </Text>
                </View>

                <Text style={styles.footerNote}>
                  Abre Google Authenticator, elige ingresar una clave manual y usa la clave de
                  arriba. Luego tu login pedirá este código.
                </Text>
              </View>
            ) : (
              <Text style={styles.footerNote}>
                Actívalo para exigir un código adicional cada vez que alguien intente iniciar
                sesión.
              </Text>
            )}

            {securityNotice ? <Text style={styles.securityNotice}>{securityNotice}</Text> : null}
          </View>
        </>
      )}
    </ScrollView>
  );
}

const glassShadow = Platform.select({
  ios: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
  },
  android: {
    elevation: 8,
  },
  web: {
    boxShadow: '0 12px 32px rgba(0,0,0,0.5)',
  },
});

const styles = StyleSheet.create({
  container: {
    paddingTop: 32,
    paddingBottom: 90,
    backgroundColor: 'transparent',
  },
  // New Header Styles
  profileHeaderContainer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    backgroundColor: 'rgba(16, 24, 39, 0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  avatarContainer: {
    width: 86,
    height: 86,
    borderRadius: 43,
    padding: 3,
    backgroundColor: 'rgba(52, 211, 153, 0.3)',
  },
  avatarMain: {
    flex: 1,
    borderRadius: 40,
    backgroundColor: '#1F2937',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#0F172A',
    overflow: 'hidden',
  },
  avatarCameraOverlay: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(0,0,0,0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(110,231,183,0.4)',
  },
  metricsRow: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginLeft: 20,
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  metricLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  bioContainer: {
    gap: 4,
    marginBottom: 20,
  },
  bioName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  typeBadgeText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  bioLocation: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 2,
  },
  bioText: {
    color: '#D1D5DB',
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  actionButtonsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 38,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  primaryActionButton: {
    backgroundColor: 'rgba(110, 231, 183, 0.1)',
    borderColor: 'rgba(110, 231, 183, 0.3)',
  },
  secondaryActionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionButtonText: {
    color: '#F9FAFB',
    fontSize: 14,
    fontWeight: '700',
  },

  // Tabs Styles
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(16, 24, 39, 0.2)',
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    gap: 4,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTabItem: {
    borderBottomColor: '#6EE7B7',
  },
  tabText: {
    color: '#9CA3AF',
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  activeTabText: {
    color: '#6EE7B7',
  },

  // Tab Content Styles
  tabContentContainer: {
    padding: 24,
    minHeight: 300,
  },
  placeholderContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 40,
    gap: 12,
  },
  placeholderTitle: {
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  placeholderSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  contentActionButton: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#6EE7B7',
  },
  contentActionButtonText: {
    color: '#0F172A',
    fontSize: 14,
    fontWeight: '800',
  },

  // Integrated Collections Styles
  collectionsTabContainer: {
    flex: 1,
  },
  tabSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  tabSectionTitle: {
    color: '#F9FAFB',
    fontSize: 16,
    fontWeight: '700',
  },
  tabHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  collectionRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  collectionCardInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  deleteCollectionButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  collectionIconInline: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(110, 231, 183, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  collectionInfoInline: {
    flex: 1,
    marginLeft: 12,
  },
  collectionNameInline: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  collectionCountInline: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  backButtonInline: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 4,
  },
  backButtonInlineText: {
    color: '#6EE7B7',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  collectionDetailTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
  },
  locationRowWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  locationCardInline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  deleteLocationButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  locationIconInline: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(110, 231, 183, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationInfoInline: {
    flex: 1,
    marginLeft: 12,
  },
  locationTitleInline: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  locationNotesInline: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
  emptyTabText: {
    color: '#6B7280',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },

  // Original Card Styles (used in Edit mode)
  infoCard: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
    ...glassShadow,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  textInput: {
    minHeight: 52,
    borderRadius: 16,
    paddingHorizontal: 16,
    color: '#F8FAFC',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    fontSize: 15,
  },
  saveButton: {
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6EE7B7',
    marginTop: 8,
    ...Platform.select({
      ios: {
        shadowColor: '#6EE7B7',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 6,
      },
      web: {
        boxShadow: '0 6px 16px rgba(110, 231, 183, 0.3)',
      },
    }),
  },
  saveButtonText: {
    color: '#040914',
    fontSize: 16,
    fontWeight: '800',
  },
  iconCard: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 20,
    ...glassShadow,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  infoLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  infoValue: {
    color: '#9EE6C3',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: '48%',
  },
  note: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  iconHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  iconCounter: {
    color: '#9EE6C3',
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    backgroundColor: 'rgba(158, 230, 195, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 4,
  },
  iconChip: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconChipSelected: {
    backgroundColor: '#6EE7B7',
    borderColor: '#6EE7B7',
    ...Platform.select({
      ios: {
        shadowColor: '#6EE7B7',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 12px rgba(110, 231, 183, 0.4)',
      },
    }),
  },
  footerNote: {
    color: '#94A3B8',
    fontSize: 13,
    lineHeight: 20,
  },
  securityCard: {
    marginHorizontal: 16,
    marginTop: 24,
    borderRadius: 24,
    padding: 24,
    backgroundColor: 'rgba(16, 24, 39, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 16,
    ...glassShadow,
  },
  securityToggle: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  securityToggleOn: {
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
    borderColor: 'rgba(52, 211, 153, 0.38)',
  },
  securityToggleText: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '800',
  },
  securityBody: {
    gap: 12,
    marginTop: 8,
  },
  securityLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '700',
    marginLeft: 4,
  },
  secretBox: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secretText: {
    color: '#D6E1DA',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  securityNotice: {
    color: '#6EE7B7',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(110, 231, 183, 0.1)',
    borderRadius: 12,
    overflow: 'hidden',
  },
});
