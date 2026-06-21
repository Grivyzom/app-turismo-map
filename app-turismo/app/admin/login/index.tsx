import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Clipboard,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { saveAdminTokenAsync } from '../../../src/utils/adminAuthStorage';

export default function AdminLoginScreen() {
  const router = useRouter();

  // Paso 1: Credenciales
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Paso 2: 2FA
  const [step, setStep] = useState<1 | 2>(1);
  const [challengeId, setChallengeId] = useState('');
  const [totpSetupUri, setTotpSetupUri] = useState('');
  const [totpSetupKey, setTotpSetupKey] = useState('');
  const [totpCode, setTotpCode] = useState('');

  // Carga y Errores
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Copiar código de configuración al portapapeles
  const handleCopyKey = () => {
    Clipboard.setString(totpSetupKey);
    Alert.alert('Copiado', 'La clave de configuración se ha copiado al portapapeles.');
  };

  // Paso 1: Login inicial (Email + Password)
  const handleLoginSubmit = async () => {
    if (!email || !password) {
      setErrorMessage('Por favor introduce tu email y contraseña.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(`${backendUrl}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || 'Error al autenticar.');
        setIsLoading(false);
        return;
      }

      // Restringir acceso en frontend si la cuenta de administrador no tiene un rol válido
      if (data.admin && data.admin.role !== 'superadmin' && data.admin.role !== 'admin') {
        setErrorMessage('Tu rol no tiene permisos para acceder a esta consola.');
        setIsLoading(false);
        return;
      }

      if (data.requires2fa) {
        setChallengeId(data.challengeId);
        if (data.totpSetupUri && data.totpSetupKey) {
          setTotpSetupUri(data.totpSetupUri);
          setTotpSetupKey(data.totpSetupKey);
        }
        setStep(2);
      } else {
        if (data.token) {
          await saveAdminTokenAsync(data.token, data.admin);
          router.replace('/admin/dashboard/');
        } else {
          setErrorMessage('Error de seguridad. Contacte al superadministrador.');
        }
      }
    } catch (error) {
      console.error('Error de login:', error);
      setErrorMessage('No se pudo establecer conexión con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // Paso 2: Verificación de 2FA
  const handleVerify2FASubmit = async () => {
    if (!totpCode || totpCode.length !== 6) {
      setErrorMessage('Por favor ingresa un código de 6 dígitos válido.');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const response = await fetch(`${backendUrl}/admin/auth/verify-2fa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          totpCode: totpCode.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMessage(data.message || 'Código de autenticación incorrecto.');
        setIsLoading(false);
        return;
      }

      // Validar rol del admin en el paso de verificación también
      if (data.admin && data.admin.role !== 'superadmin' && data.admin.role !== 'admin') {
        setErrorMessage('Tu rol no tiene permisos de acceso.');
        setIsLoading(false);
        return;
      }

      if (data.token) {
        setSuccessMessage('¡Autenticación exitosa! Redirigiendo...');
        await saveAdminTokenAsync(data.token, data.admin);

        setTimeout(() => {
          router.replace('/admin/dashboard/');
        }, 1000);
      } else {
        setErrorMessage('Error al recibir credenciales de sesión.');
      }
    } catch (error) {
      console.error('Error de 2FA:', error);
      setErrorMessage('Error al verificar el código de seguridad.');
    } finally {
      setIsLoading(false);
    }
  };

  const qrImageUrl = totpSetupUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpSetupUri)}`
    : '';

  return (
    <View style={styles.container}>
      {/* Círculos decorativos de fondo */}
      <View style={[styles.bgCircle, styles.circle1]} />
      <View style={[styles.bgCircle, styles.circle2]} />

      <View style={styles.cardContainer}>
        {/* Encabezado */}
        <View style={styles.header}>
          <View style={styles.logoIcon}>
            <MaterialIcons name="security" size={32} color="#fff" />
          </View>
          <Text style={styles.title}>Panel de Control</Text>
          <Text style={styles.subtitle}>Portal de Administración Seguro</Text>
        </View>

        {errorMessage ? (
          <View style={styles.errorAlert}>
            <MaterialIcons name="error-outline" size={20} color="#ff4a4a" />
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {successMessage ? (
          <View style={styles.successAlert}>
            <MaterialIcons name="check-circle-outline" size={20} color="#4ade80" />
            <Text style={styles.successText}>{successMessage}</Text>
          </View>
        ) : null}

        {step === 1 ? (
          /* PASO 1: FORMULARIO DE ACCESO */
          <View style={styles.form}>
            <Text style={styles.label}>Correo Electrónico</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="email" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="admin@turismomap.com"
                placeholderTextColor="#9ca3af"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
                editable={!isLoading}
              />
            </View>

            <Text style={styles.label}>Contraseña</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="lock" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="••••••••••••"
                placeholderTextColor="#9ca3af"
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                value={password}
                onChangeText={setPassword}
                editable={!isLoading}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
              >
                <MaterialIcons
                  name={showPassword ? 'visibility-off' : 'visibility'}
                  size={20}
                  color="#9ca3af"
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleLoginSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Verificar Credenciales</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          /* PASO 2: VERIFICACIÓN 2FA */
          <View style={styles.form}>
            {totpSetupUri ? (
              /* Configuración inicial (Primer Login) */
              <View style={styles.setupContainer}>
                <Text style={styles.setupTitle}>Configura tu Segundo Factor (2FA)</Text>
                <Text style={styles.setupDesc}>
                  Escanea este código QR con tu aplicación de autenticación o introduce la clave
                  secreta manualmente:
                </Text>

                {qrImageUrl ? (
                  <View style={styles.qrWrapper}>
                    <Image source={{ uri: qrImageUrl }} style={styles.qrCode} />
                  </View>
                ) : null}

                <View style={styles.keyContainer}>
                  <Text style={styles.keyLabel}>Clave Secreta:</Text>
                  <View style={styles.keyRow}>
                    <Text style={styles.keyText} numberOfLines={1}>
                      {totpSetupKey}
                    </Text>
                    <TouchableOpacity onPress={handleCopyKey} style={styles.copyBtn}>
                      <MaterialIcons name="content-copy" size={16} color="#3b82f6" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ) : (
              /* Logins posteriores */
              <View style={styles.setupContainer}>
                <View style={styles.shieldIcon}>
                  <MaterialIcons name="phonelink-lock" size={48} color="#3b82f6" />
                </View>
                <Text style={styles.setupTitle}>Verificación Requerida</Text>
                <Text style={styles.setupDesc}>
                  Por favor, ingresa el código temporal de 6 dígitos que se muestra en tu aplicación
                  de autenticación.
                </Text>
              </View>
            )}

            <Text style={styles.label}>Código de Seguridad</Text>
            <View style={styles.inputContainer}>
              <MaterialIcons name="pin" size={20} color="#9ca3af" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, styles.totpInput]}
                placeholder="000 000"
                placeholderTextColor="#9ca3af"
                keyboardType="number-pad"
                maxLength={6}
                value={totpCode}
                onChangeText={setTotpCode}
                editable={!isLoading}
              />
            </View>

            <TouchableOpacity
              style={styles.button}
              onPress={handleVerify2FASubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Confirmar y Entrar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => {
                setStep(1);
                setTotpCode('');
                setTotpSetupUri('');
                setTotpSetupKey('');
                setErrorMessage('');
              }}
              disabled={isLoading}
            >
              <Text style={styles.backBtnText}>Volver a credenciales</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Este sistema registra todos los intentos de acceso y las actividades asociadas a la
            dirección IP por motivos de auditoría y seguridad.
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#090d16',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  bgCircle: {
    position: 'absolute',
    borderRadius: 999,
    opacity: 0.15,
  },
  circle1: {
    width: 300,
    height: 300,
    backgroundColor: '#3b82f6',
    top: -50,
    right: -50,
  },
  circle2: {
    width: 250,
    height: 250,
    backgroundColor: '#8b5cf6',
    bottom: -50,
    left: -50,
  },
  cardContainer: {
    width: '100%',
    maxWidth: 450,
    backgroundColor: 'rgba(17, 24, 39, 0.75)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    padding: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    ...Platform.select({
      web: {
        backdropFilter: 'blur(20px)',
      },
    }),
  },
  header: {
    alignItems: 'center',
    marginBottom: 25,
  },
  logoIcon: {
    width: 60,
    height: 60,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
  },
  form: {
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#e5e7eb',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    marginBottom: 20,
    paddingHorizontal: 15,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 48,
    color: '#ffffff',
    fontSize: 15,
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      },
    }),
  },
  eyeIcon: {
    padding: 5,
  },
  totpInput: {
    textAlign: 'center',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 8,
  },
  button: {
    height: 50,
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  errorAlert: {
    flexDirection: 'row',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  successAlert: {
    flexDirection: 'row',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.2)',
    padding: 12,
    marginBottom: 20,
    alignItems: 'center',
  },
  successText: {
    color: '#4ade80',
    fontSize: 13,
    marginLeft: 8,
    flex: 1,
  },
  setupContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  setupTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  setupDesc: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 15,
  },
  qrWrapper: {
    padding: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 15,
  },
  qrCode: {
    width: 160,
    height: 160,
  },
  keyContainer: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  keyLabel: {
    fontSize: 11,
    color: '#9ca3af',
    marginBottom: 4,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  keyText: {
    color: '#3b82f6',
    fontWeight: 'bold',
    fontSize: 13,
    flex: 1,
  },
  copyBtn: {
    padding: 5,
  },
  shieldIcon: {
    marginBottom: 15,
  },
  backBtn: {
    marginTop: 15,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#9ca3af',
    fontSize: 14,
  },
  footer: {
    marginTop: 25,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 15,
  },
  footerText: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 15,
  },
});
