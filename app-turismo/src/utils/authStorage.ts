import { Platform } from 'react-native';

let memoryStorage: string | null = null;

export const saveAuthToken = (token: string, remember: boolean = true) => {
  if (Platform.OS === 'web') {
    try {
      if (remember) {
        localStorage.setItem('auth_token', token);
        sessionStorage.removeItem('auth_token');
      } else {
        sessionStorage.setItem('auth_token', token);
        localStorage.removeItem('auth_token');
      }
    } catch (e) {
      console.warn('Storage is not available');
    }
  } else {
    memoryStorage = token;
  }
};

export const getAuthToken = (): string | null => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    } catch (e) {
      return null;
    }
  }
  return memoryStorage;
};

export const clearAuthToken = () => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem('auth_token');
      sessionStorage.removeItem('auth_token');
    } catch (e) {}
  } else {
    memoryStorage = null;
  }
};
