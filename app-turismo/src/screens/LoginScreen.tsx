import React, { useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
// Si utilizas expo/vector-icons o react-native-vector-icons
import { MaterialIcons } from '@expo/vector-icons';

type LoginScreenProps = {
  onLogin: () => void;
  onGoToRegister: () => void;
};

export default function LoginScreen({ onLogin, onGoToRegister }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={StyleSheet.absoluteFill} className="bg-[#f5f4fb]" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={styles.card}
          className="w-full rounded-[1.75rem] border border-black/5 bg-white px-6 py-10 sm:px-10 sm:py-12"
        >
          <View className="items-center">
            <Text className="text-[34px] font-extrabold tracking-tight text-[#2e2b5f]">
              Inicia sesión
            </Text>
          </View>

          <View className="mt-8">
            <TouchableOpacity
              style={styles.socialButton}
              className="h-12 w-full flex-row items-center justify-center rounded-xl border border-black/10 bg-white active:opacity-90"
              onPress={() => {}}
            >
              <Image
                source={require('../img/icons/Google_Favicon.svg')}
                style={{ width: 24, height: 24 }}
                resizeMode="contain"
              />
            </TouchableOpacity>
          </View>

          <View className="my-8 flex-row items-center">
            <View className="h-px flex-1 bg-black/10" />
            <Text className="mx-3 text-sm font-medium text-[#5f5a86]">o</Text>
            <View className="h-px flex-1 bg-black/10" />
          </View>

          <View className="gap-4">
            <View>
              <Text className="mb-2 text-[13px] text-[#5f6774]">Dirección de email</Text>
              <View className="flex-row items-center rounded-lg border border-[#cbccd0] bg-white px-4 py-3">
                <TextInput
                  className="flex-1 text-base text-[#23262f]"
                  placeholder=""
                  placeholderTextColor="#7b8291"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

            <View>
              <Text className="mb-2 text-[13px] text-[#5f6774]">Contraseña</Text>
              <View className="flex-row items-center rounded-lg border border-[#cbccd0] bg-white px-4 py-3">
                <TextInput
                  className="flex-1 text-base text-[#23262f]"
                  placeholder=""
                  placeholderTextColor="#7b8291"
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  accessibilityRole="button"
                  accessibilityLabel={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  <MaterialIcons
                    name={showPassword ? 'visibility-off' : 'visibility'}
                    size={22}
                    color="#5f6774"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity className="self-start" onPress={() => {}}>
              <Text className="text-[14px] font-bold text-[#5636f3]">
                ¿Olvidaste tu contraseña?
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.primaryButton}
              className="mt-2 h-12 rounded-lg bg-[#6a44ff] active:opacity-90"
              onPress={onLogin}
            >
              <View className="h-full items-center justify-center">
                <Text className="text-[15px] font-bold text-white">Inicia sesión</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View className="mt-8 items-center gap-4">
            <Text className="text-[14px] font-bold text-[#5636f3]">
              ¿No puedes acceder a tu cuenta?
            </Text>

            <View className="flex-row flex-wrap items-center justify-center">
              <Text className="text-[14px] text-[#4b4f63]">¿No tienes una cuenta? </Text>
              <TouchableOpacity onPress={onGoToRegister}>
                <Text className="text-[14px] font-bold text-[#5636f3]">Regístrate</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f8',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    boxShadow: '0px 10px 40px rgba(0, 0, 0, 0.04)',
    elevation: 3,
  },
  socialButton: {
    boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
  },
  primaryButton: {
    boxShadow: '0px 4px 12px rgba(106, 68, 255, 0.25)',
  },
});
