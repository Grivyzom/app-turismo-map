import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHostedAuth } from '@clerk/expo/hosted-auth';
import { useRouter } from 'expo-router';

interface ClerkAuthCardProps {
  isRegister: boolean;
  onToggleMode?: (mode: 'login' | 'register') => void;
  onClose?: () => void;
}

export const ClerkAuthCard: React.FC<ClerkAuthCardProps> = ({ isRegister, onToggleMode }) => {
  const { startHostedAuth } = useHostedAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleAuth = async () => {
    try {
      setIsLoading(true);
      setError('');
      const res = await startHostedAuth({ mode: isRegister ? 'sign-up' : 'sign-in' });
      if (res?.createdSessionId) {
        router.replace('/(home)');
      }
    } catch (e: any) {
      console.warn('[Clerk] Native auth error:', e);
      setError('No se pudo completar la autenticación con Clerk.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View style={{ width: '100%', alignItems: 'center', padding: 24, gap: 16 }}>
      <TouchableOpacity
        onPress={handleAuth}
        disabled={isLoading}
        activeOpacity={0.85}
        style={{
          width: '100%',
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 10,
          paddingVertical: 14,
          paddingHorizontal: 20,
          borderRadius: 14,
          backgroundColor: '#6c47ff',
          shadowColor: '#6c47ff',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 8,
          elevation: 4,
        }}
      >
        {isLoading ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <>
            <Ionicons name="shield-checkmark" size={20} color="#ffffff" />
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
              {isRegister ? 'Crear cuenta con Clerk' : 'Iniciar sesión con Clerk'}
            </Text>
          </>
        )}
      </TouchableOpacity>
      {error ? (
        <Text style={{ color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</Text>
      ) : null}
    </View>
  );
};
