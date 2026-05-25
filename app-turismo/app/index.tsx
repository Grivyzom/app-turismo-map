import { useEffect } from 'react';
import { useRouter } from 'expo-router';

import { getAuthToken } from '../src/utils/authStorage';

export default function RootIndex() {
  const router = useRouter();

  useEffect(() => {
    // Verificar si hay una sesión activa
    const token = getAuthToken();
    if (token) {
      router.replace('/(home)');
    } else {
      router.replace('/login');
    }
  }, []);

  return null;
}
