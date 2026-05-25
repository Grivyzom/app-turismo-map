import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import {
  buildTwoFactorOtpUri,
  PROFILE_ICON_OPTIONS,
  getDefaultUserProfile,
  generateTwoFactorSecret,
  loadUserProfile,
  saveUserProfile,
  type NormalUserProfile,
  type UserProfileIconName,
} from '../utils/userProfileStorage';

const userTypeLabels: Record<NormalUserProfile['userType'], string> = {
  citizen: 'Turista',
  partner_owner: 'Entidad',
  guest: 'Invitado',
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
  const [isLoading, setIsLoading] = useState(true);
  const [securityNotice, setSecurityNotice] = useState('');

  useEffect(() => {
    let isMounted = true;

    void loadUserProfile().then((storedProfile) => {
      if (!isMounted) {
        return;
      }

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

  const handleSelectIcon = async (avatarIcon: UserProfileIconName) => {
    const nextProfile = await saveUserProfile({
      ...profile,
      fullName,
      email,
      location,
      avatarIcon,
    });
    setProfile(nextProfile);
  };

  const handleSaveProfile = async () => {
    const nextProfile = await saveUserProfile({
      ...profile,
      fullName,
      email,
      location,
    });

    setProfile(nextProfile);
    setFullName(nextProfile.fullName);
    setEmail(nextProfile.email);
    setLocation(nextProfile.location);
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

    const secret = generateTwoFactorSecret();
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

  const twoFactorUri = profile.twoFactorSecret
    ? buildTwoFactorOtpUri(
        { email: email || profile.email, fullName: fullName || profile.fullName },
        profile.twoFactorSecret,
      )
    : '';

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.heroCard}>
        <View style={styles.heroGlowLeft} />
        <View style={styles.heroGlowRight} />

        <View style={styles.headerRow}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.kicker}>Mi perfil</Text>
            <Text style={styles.title}>Tu información base</Text>
            <Text style={styles.subtitle}>
              Desde aquí ves tu cuenta normal y cambias tu icono de perfil.
            </Text>
          </View>

          <View style={styles.badgeColumn}>
            <View style={styles.badgePrimary}>
              <Text style={styles.badgeText}>Cuenta normal</Text>
            </View>
            <View style={styles.badgeSecondary}>
              <Text style={styles.badgeText}>{userTypeLabels[profile.userType]}</Text>
            </View>
          </View>
        </View>

        <View style={styles.identityRow}>
          <View style={styles.avatarFrame}>
            <View style={styles.avatarCore}>
              <MaterialIcons name={profile.avatarIcon} size={44} color="#EAFBF1" />
            </View>
          </View>

          <View style={styles.identityTextBlock}>
            <Text style={styles.profileName}>{profile.fullName}</Text>
            <Text style={styles.profileEmail}>{profile.email || 'Sin correo registrado'}</Text>
            <Text style={styles.profileLocation}>
              {profile.location || 'Sin ubicación definida'}
            </Text>
          </View>
        </View>
      </View>

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

      <View style={styles.iconCard}>
        <View style={styles.iconHeader}>
          <View>
            <Text style={styles.cardTitle}>Icono de perfil</Text>
            <Text style={styles.iconSubtitle}>
              Toca una opción para cambiar el icono que te representa.
            </Text>
          </View>
          <Text style={styles.iconCounter}>{profile.avatarIcon}</Text>
        </View>

        <View style={styles.iconGrid}>
          {PROFILE_ICON_OPTIONS.map((iconName) => {
            const selected = profile.avatarIcon === iconName;

            return (
              <TouchableOpacity
                key={iconName}
                activeOpacity={0.9}
                onPress={() => void handleSelectIcon(iconName)}
                style={[styles.iconChip, selected && styles.iconChipSelected]}
              >
                <MaterialIcons name={iconName} size={24} color={selected ? '#081018' : '#D8E6DE'} />
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.footerNote}>
          El cambio se guarda automáticamente en tu dispositivo.
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
              Abre Google Authenticator, elige ingresar una clave manual y usa la clave de arriba.
              Luego tu login pedirá este código.
            </Text>
          </View>
        ) : (
          <Text style={styles.footerNote}>
            Actívalo para exigir un código adicional cada vez que alguien intente iniciar sesión.
          </Text>
        )}

        {securityNotice ? <Text style={styles.securityNotice}>{securityNotice}</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 14,
    backgroundColor: '#0B0F19',
  },
  heroCard: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 28,
    padding: 18,
    backgroundColor: '#101827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroGlowLeft: {
    position: 'absolute',
    top: -40,
    left: -40,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(52, 211, 153, 0.14)',
  },
  heroGlowRight: {
    position: 'absolute',
    bottom: -50,
    right: -50,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
  },
  headerRow: {
    position: 'relative',
    zIndex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerTextBlock: {
    flex: 1,
    gap: 4,
  },
  kicker: {
    color: '#6EE7B7',
    textTransform: 'uppercase',
    letterSpacing: 1.6,
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    color: '#F5FAF7',
    fontSize: 28,
    lineHeight: 32,
    fontWeight: '900',
    marginTop: 2,
  },
  subtitle: {
    color: '#B6C5D4',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  badgeColumn: {
    alignItems: 'flex-end',
    gap: 8,
  },
  badgePrimary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.35)',
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  badgeSecondary: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.30)',
    backgroundColor: 'rgba(14, 165, 233, 0.15)',
  },
  badgeText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
  identityRow: {
    position: 'relative',
    zIndex: 1,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  avatarFrame: {
    width: 94,
    height: 94,
    borderRadius: 28,
    padding: 2,
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  avatarCore: {
    flex: 1,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22C55E',
  },
  identityTextBlock: {
    flex: 1,
    gap: 4,
  },
  profileName: {
    color: '#FFFFFF',
    fontSize: 23,
    fontWeight: '800',
  },
  profileEmail: {
    color: '#C7D2FE',
    fontSize: 14,
    fontWeight: '600',
  },
  profileLocation: {
    color: '#9CA3AF',
    fontSize: 13,
  },
  infoCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  fieldBlock: {
    gap: 8,
  },
  fieldLabel: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  textInput: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 14,
    color: '#F8FAFC',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  saveButton: {
    minHeight: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6EE7B7',
  },
  saveButtonText: {
    color: '#081018',
    fontSize: 14,
    fontWeight: '800',
  },
  iconCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 16,
  },
  cardTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
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
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    maxWidth: '48%',
  },
  note: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  iconHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconSubtitle: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  iconCounter: {
    color: '#9EE6C3',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  iconChip: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  iconChipSelected: {
    backgroundColor: '#6EE7B7',
    borderColor: '#6EE7B7',
  },
  footerNote: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  securityCard: {
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 14,
  },
  securityToggle: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  securityToggleOn: {
    backgroundColor: 'rgba(52, 211, 153, 0.18)',
    borderColor: 'rgba(52, 211, 153, 0.38)',
  },
  securityToggleText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '800',
  },
  securityBody: {
    gap: 10,
  },
  securityLabel: {
    color: '#E5E7EB',
    fontSize: 13,
    fontWeight: '700',
  },
  secretBox: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  secretText: {
    color: '#D6E1DA',
    fontSize: 12,
    lineHeight: 18,
  },
  securityNotice: {
    color: '#6EE7B7',
    fontSize: 12,
    fontWeight: '700',
  },
});
