import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from '../../src/context/AuthContext';

export default function BusinessLogout() {
  const { signOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    void signOut().then(() => {
      router.replace('/business/ingresar');
    });
  }, []);

  return null;
}
