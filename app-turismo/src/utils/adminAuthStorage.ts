import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ADMIN_AUTH_KEY = 'admin_auth_token';
const ADMIN_USER_KEY = 'admin_user_data';

export const saveAdminTokenAsync = async (
  token: string,
  adminData: any,
  remember: boolean = true,
): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      const dataStr = JSON.stringify(adminData);
      if (remember) {
        localStorage.setItem(ADMIN_AUTH_KEY, token);
        localStorage.setItem(ADMIN_USER_KEY, dataStr);
        sessionStorage.removeItem(ADMIN_AUTH_KEY);
        sessionStorage.removeItem(ADMIN_USER_KEY);
      } else {
        sessionStorage.setItem(ADMIN_AUTH_KEY, token);
        sessionStorage.setItem(ADMIN_USER_KEY, dataStr);
        localStorage.removeItem(ADMIN_AUTH_KEY);
        localStorage.removeItem(ADMIN_USER_KEY);
      }
    } catch (e) {
      console.warn('Storage is not available');
    }
  } else {
    try {
      await AsyncStorage.setItem(ADMIN_AUTH_KEY, token);
      await AsyncStorage.setItem(ADMIN_USER_KEY, JSON.stringify(adminData));
    } catch (e) {
      console.warn('AsyncStorage error:', e);
    }
  }
};

export const getAdminTokenAsync = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(ADMIN_AUTH_KEY) || sessionStorage.getItem(ADMIN_AUTH_KEY);
    } catch (e) {
      return null;
    }
  } else {
    try {
      return await AsyncStorage.getItem(ADMIN_AUTH_KEY);
    } catch (e) {
      console.warn('AsyncStorage error:', e);
      return null;
    }
  }
};

export const getAdminUserAsync = async (): Promise<any | null> => {
  if (Platform.OS === 'web') {
    try {
      const data = localStorage.getItem(ADMIN_USER_KEY) || sessionStorage.getItem(ADMIN_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  } else {
    try {
      const data = await AsyncStorage.getItem(ADMIN_USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }
};

export const clearAdminAuthAsync = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(ADMIN_AUTH_KEY);
      localStorage.removeItem(ADMIN_USER_KEY);
      sessionStorage.removeItem(ADMIN_AUTH_KEY);
      sessionStorage.removeItem(ADMIN_USER_KEY);
    } catch (e) {}
  } else {
    try {
      await AsyncStorage.removeItem(ADMIN_AUTH_KEY);
      await AsyncStorage.removeItem(ADMIN_USER_KEY);
    } catch (e) {
      console.warn('AsyncStorage error:', e);
    }
  }
};
