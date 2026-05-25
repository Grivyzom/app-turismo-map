import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ComponentProps } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { OTP } from 'otplib';

export type UserProfileIconName = ComponentProps<typeof MaterialIcons>['name'];

export type NormalUserProfile = {
  fullName: string;
  email: string;
  location: string;
  avatarIcon: UserProfileIconName;
  userType: 'citizen' | 'partner_owner' | 'guest';
  twoFactorEnabled: boolean;
  twoFactorSecret: string | null;
  createdAt: string;
  updatedAt: string;
};

const USER_PROFILE_STORAGE_KEY = 'app-turismo.normal-user-profile';
const twoFactorOtp = new OTP({ strategy: 'totp' });

export const PROFILE_ICON_OPTIONS: UserProfileIconName[] = [
  'person',
  'face',
  'account-circle',
  'explore',
  'map',
  'location-on',
  'beach-access',
  'hiking',
  'bookmark',
  'favorite',
  'photo-camera',
  'verified-user',
];

const getNowIso = () => new Date().toISOString();

export const getDefaultUserProfile = (): NormalUserProfile => ({
  fullName: 'Usuario normal',
  email: '',
  location: 'Sin ubicación definida',
  avatarIcon: 'person',
  userType: 'guest',
  twoFactorEnabled: false,
  twoFactorSecret: null,
  createdAt: getNowIso(),
  updatedAt: getNowIso(),
});

const isValidProfileIcon = (value: string | null | undefined): value is UserProfileIconName => {
  return !!value && PROFILE_ICON_OPTIONS.includes(value as UserProfileIconName);
};

const normalizeUserProfile = (
  profile: Partial<NormalUserProfile> | null | undefined,
  options?: { touchUpdatedAt?: boolean },
): NormalUserProfile => {
  const baseProfile = getDefaultUserProfile();

  return {
    ...baseProfile,
    ...profile,
    fullName: profile?.fullName?.trim() ? profile.fullName.trim() : baseProfile.fullName,
    email: profile?.email?.trim() ? profile.email.trim() : baseProfile.email,
    location: profile?.location?.trim() ? profile.location.trim() : baseProfile.location,
    avatarIcon: isValidProfileIcon(profile?.avatarIcon)
      ? profile.avatarIcon
      : baseProfile.avatarIcon,
    userType: profile?.userType ?? baseProfile.userType,
    createdAt: profile?.createdAt ?? baseProfile.createdAt,
    twoFactorEnabled: profile?.twoFactorEnabled ?? baseProfile.twoFactorEnabled,
    twoFactorSecret: profile?.twoFactorSecret ?? baseProfile.twoFactorSecret,
    updatedAt: options?.touchUpdatedAt
      ? getNowIso()
      : (profile?.updatedAt ?? baseProfile.updatedAt),
  };
};

export const loadUserProfile = async (): Promise<NormalUserProfile | null> => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const storedValue = window.localStorage.getItem(USER_PROFILE_STORAGE_KEY);
      return storedValue ? normalizeUserProfile(JSON.parse(storedValue)) : null;
    }

    const storedValue = await AsyncStorage.getItem(USER_PROFILE_STORAGE_KEY);
    return storedValue ? normalizeUserProfile(JSON.parse(storedValue)) : null;
  } catch {
    return null;
  }
};

export const saveUserProfile = async (
  profile: Partial<NormalUserProfile>,
): Promise<NormalUserProfile> => {
  const currentProfile = await loadUserProfile();
  const nextProfile = normalizeUserProfile(
    {
      ...currentProfile,
      ...profile,
      createdAt: currentProfile?.createdAt ?? profile.createdAt,
    },
    { touchUpdatedAt: true },
  );

  try {
    const serializedProfile = JSON.stringify(nextProfile);

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.setItem(USER_PROFILE_STORAGE_KEY, serializedProfile);
    } else {
      await AsyncStorage.setItem(USER_PROFILE_STORAGE_KEY, serializedProfile);
    }
  } catch {
    // Si el storage falla, la pantalla sigue funcionando con estado local.
  }

  return nextProfile;
};

export const generateTwoFactorSecret = (): string => {
  return twoFactorOtp.generateSecret();
};

export const buildTwoFactorOtpUri = (
  profile: Pick<NormalUserProfile, 'email' | 'fullName'>,
  secret: string,
): string => {
  const identifier = profile.email.trim() || profile.fullName.trim() || 'usuario';
  return twoFactorOtp.generateURI({
    issuer: 'App Turismo',
    label: identifier,
    secret,
  });
};

export const verifyTwoFactorCode = async (secret: string, token: string): Promise<boolean> => {
  const normalizedToken = token.replace(/\s+/g, '').trim();
  if (!normalizedToken || !secret) {
    return false;
  }

  const verificationResult = await twoFactorOtp.verify({
    secret,
    token: normalizedToken,
  });

  return typeof verificationResult === 'boolean'
    ? verificationResult
    : Boolean(verificationResult.valid);
};

export const clearUserProfile = async (): Promise<void> => {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.localStorage.removeItem(USER_PROFILE_STORAGE_KEY);
      return;
    }

    await AsyncStorage.removeItem(USER_PROFILE_STORAGE_KEY);
  } catch {
    // Ignore storage errors on logout.
  }
};
