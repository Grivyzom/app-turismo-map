import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY = 'auth_token';

// Para la web, podemos mantener acceso síncrono en caso de ser necesario
// pero la API principal será asíncrona para ser compatible con móvil.

export const saveAuthTokenAsync = async (
  token: string,
  remember: boolean = true,
): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      if (remember) {
        localStorage.setItem(AUTH_KEY, token);
        sessionStorage.removeItem(AUTH_KEY);
      } else {
        sessionStorage.setItem(AUTH_KEY, token);
        localStorage.removeItem(AUTH_KEY);
      }
    } catch (e) {
      console.warn('Storage is not available');
    }
  } else {
    try {
      await AsyncStorage.setItem(AUTH_KEY, token);
    } catch (e) {
      console.warn('AsyncStorage error:', e);
    }
  }
};

export const getAuthTokenAsync = async (): Promise<string | null> => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
    } catch (e) {
      return null;
    }
  } else {
    try {
      return await AsyncStorage.getItem(AUTH_KEY);
    } catch (e) {
      console.warn('AsyncStorage error:', e);
      return null;
    }
  }
};

export const clearAuthTokenAsync = async (): Promise<void> => {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_KEY);
    } catch (e) {}
  } else {
    try {
      await AsyncStorage.removeItem(AUTH_KEY);
    } catch (e) {
      console.warn('AsyncStorage error:', e);
    }
  }
};

// Se mantienen por compatibilidad, pero su uso no es recomendado para validaciones seguras
// ya que en móvil no podrán acceder al AsyncStorage de forma síncrona.
let memoryStorage: string | null = null;
export const saveAuthToken = (token: string, remember: boolean = true) => {
  saveAuthTokenAsync(token, remember); // fire and forget
  memoryStorage = token;
};
export const getAuthToken = (): string | null => {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
    } catch (e) {
      return null;
    }
  }
  return memoryStorage;
};
export const clearAuthToken = () => {
  clearAuthTokenAsync();
  memoryStorage = null;
};
