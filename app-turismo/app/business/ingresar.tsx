import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { useAuth } from '../../src/context/AuthContext';
import { saveUserProfile } from '../../src/utils/userProfileStorage';

// ─── Máquina de estados ───────────────────────────────────────────────────────
const VISTAS = {
  LOGIN: 'login',
  REGISTER: 'register',
  RECOVERY: 'recovery',
} as const;
type Vista = (typeof VISTAS)[keyof typeof VISTAS];

// ─── Constantes de diseño (B2B / Corporate) ──────────────────────────────────
const ACCENT = '#2563eb';
const ACCENT_DARK = '#1d4ed8';
const NAVY = '#0f172a';
const BG_IMAGE =
  'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=2070&auto=format&fit=crop';

// ─── Campo reutilizable ───────────────────────────────────────────────────────
const Field = ({
  field,
  placeholder,
  value,
  onChangeText,
  icon,
  keyboardType = 'default',
  autoCapitalize = 'none',
  secure = false,
  rightElement,
  focusedField,
  setFocusedField,
}: {
  field: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  icon: React.ReactNode;
  keyboardType?: any;
  autoCapitalize?: any;
  secure?: boolean;
  rightElement?: React.ReactNode;
  focusedField: string | null;
  setFocusedField: (field: string | null) => void;
}) => (
  <View style={styles.fieldWrap}>
    <View style={styles.fieldIcon}>{icon}</View>
    <TextInput
      placeholder={placeholder}
      placeholderTextColor="#94a3b8"
      keyboardType={keyboardType}
      autoCapitalize={autoCapitalize}
      secureTextEntry={secure}
      value={value}
      onChangeText={onChangeText}
      onFocus={() => setFocusedField(field)}
      onBlur={() => setFocusedField(null)}
      style={[
        styles.input,
        {
          borderColor: focusedField === field ? ACCENT : '#cbd5e1',
          borderWidth: 1,
        },
      ]}
    />
    {rightElement}
  </View>
);

// ─── Helpers para Web ────────────────────────────────────────────────────────
const showAlert = (title: string, message: string) => {
  if (Platform.OS === 'web') {
    alert(`${title}: ${message}`);
  } else {
    Alert.alert(title, message);
  }
};

const getBackendUrl = () => {
  const url = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (!url || url === 'undefined') {
    return 'http://localhost:8081';
  }
  return url;
};

// ─── Componente principal ─────────────────────────────────────────────────────
export default function BusinessIngresarScreen() {
  const { signIn } = useAuth();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  // ── SSR guard ──
  const [isMounted, setIsMounted] = useState(false);

  // ── Estado de la vista ──
  const [vista, setVista] = useState<Vista>(VISTAS.LOGIN);

  // ── Campos comunes ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [formError, setFormError] = useState('');

  // ── Campos de registro ──
  const [businessName, setBusinessName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [phone, setPhone] = useState('');
  const [registerEntityType, setRegisterEntityType] = useState<'corporate' | 'sme' | 'independent'>('corporate');

  // ── Estado general ──
  const [isLoading, setIsLoading] = useState(false);

  // Durante la hidratación, usamos un valor fijo (false) para que coincida con el SSR de Expo.
  // Una vez montado (useEffect), el valor se actualizará al tamaño real de la pantalla.
  const [isMobile, setIsMobile] = useState(false);

  const isLogin = vista === VISTAS.LOGIN;
  const isRegister = vista === VISTAS.REGISTER;
  const isRecovery = vista === VISTAS.RECOVERY;

  useEffect(() => {
    setIsMounted(true);
    setIsMobile(width <= 480);
  }, [width]);

  // ─── Login ────────────────────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email || !password) {
      const missing = [];
      if (!email) missing.push('correo corporativo');
      if (!password) missing.push('contraseña');
      const faltanStr = missing.length > 1 ? 'Faltan' : 'Falta';
      setFormError(`Error: Por favor completa todos los campos obligatorios. (${faltanStr}: ${missing.join(' y ')})`);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        if (
          data.user.userType !== 'partner_owner' &&
          data.user.userType !== 'partner_worker' &&
          data.user.userType !== 'admin'
        ) {
          setFormError('Acceso denegado: Esta cuenta no tiene permisos de empresa.');
          return;
        }
        await saveUserProfile({
          fullName: data.user.company?.businessName ?? data.user.name,
          email: data.user.email,
          location: 'Empresa',
          avatarIcon: 'business',
          userType: data.user.userType,
          entityType: data.user.company?.entityType,
          companyRole: data.user.company?.role,
        });
        await signIn(data.token, true, '/business/dashboard');
      } else {
        setFormError(`Acceso denegado: ${data.message || 'Credenciales incorrectas'}`);
      }
    } catch (err) {
      console.error('Login error:', err);
      setFormError('Error de conexión: No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Registro ─────────────────────────────────────────────────────────────────
  const handleRegister = async () => {
    const isBusiness = registerEntityType === 'corporate' || registerEntityType === 'sme';
    if (!email || !password || !managerName || (isBusiness && !businessName)) {
      const missing = [];
      if (isBusiness && !businessName) missing.push('nombre de la empresa');
      if (!managerName) missing.push('nombre del encargado');
      if (!email) missing.push('correo corporativo');
      if (!password) missing.push('contraseña');
      const faltanStr = missing.length > 1 ? 'Faltan' : 'Falta';
      setFormError(`Error: Por favor completa todos los campos obligatorios. (${faltanStr}: ${missing.join(', ')})`);
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${getBackendUrl()}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
          name: managerName,
          businessName: (registerEntityType === 'corporate' || registerEntityType === 'sme') ? businessName : undefined,
          userType: 'partner_owner',
          phone,
          entityType: registerEntityType,
        }),
      });
      const data = await res.json();

      if (res.ok && data.success) {
        await saveUserProfile({
          fullName: data.user.company?.businessName ?? data.user.name,
          email: data.user.email,
          location: 'Empresa',
          avatarIcon: 'business',
          userType: data.user.userType ?? 'partner_owner',
          entityType: data.user.company?.entityType ?? registerEntityType,
          companyRole: data.user.company?.role ?? 'owner',
        });
        await signIn(data.token, true, '/business/dashboard');
      } else {
        setFormError(`Error de registro: ${data.message || 'No se pudo crear la cuenta de empresa'}`);
      }
    } catch (err) {
      console.error('Register error:', err);
      setFormError('Error de conexión: No se pudo conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Recuperación ─────────────────────────────────────────────────────────────
  const handleRecovery = () => {
    if (!email) {
      setFormError('Error: Por favor completa todos los campos obligatorios. (Falta: correo corporativo)');
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      showAlert(
        'Enlace enviado',
        'Se ha enviado un enlace de recuperación a tu correo corporativo.',
      );
      setVista(VISTAS.LOGIN);
    }, 1000);
  };

  const handleSubmit = () => {
    if (isRegister) return handleRegister();
    if (isRecovery) return handleRecovery();
    return handleLogin();
  };

  const switchVista = () => {
    setPassword('');
    setFocusedField(null);
    setFormError('');
    setVista(isLogin ? VISTAS.REGISTER : VISTAS.LOGIN);
  };

  // ─── Textos dinámicos ─────────────────────────────────────────────────────────
  const title = isRegister
    ? 'Registrar Empresa'
    : isRecovery
      ? 'Recuperar Acceso'
      : 'Portal Administrativo';
  const subtitle = isRegister
    ? 'Crea la cuenta corporativa de tu negocio'
    : isRecovery
      ? 'Ingresa tu correo corporativo para recibir el enlace de restauración'
      : 'Acceso a la plataforma multi-producto empresarial';
  const submitText = isRegister
    ? 'Registrar Empresa'
    : isRecovery
      ? 'Enviar enlace'
      : 'Acceder al sistema';
  const footerQuestion = isLogin ? '¿No tienes cuenta de empresa?' : '¿Ya tienes cuenta?';
  const footerAction = isLogin ? 'Regístrate aquí' : 'Inicia sesión';

  // ─── SSR guard ───────────────────────────────────────────────────────────────
  if (!isMounted) {
    return (
      <View
        style={[
          StyleSheet.absoluteFill,
          { backgroundColor: NAVY, justifyContent: 'center', alignItems: 'center' },
        ]}
      >
        <ActivityIndicator size="large" color={ACCENT} />
      </View>
    );
  }

  // ─── Tarjeta ─────────────────────────────────────────────────────────────────
  const card = (
    <View style={[styles.card, !isMobile && styles.cardDesktop]}>
      {/* Badge corporativo */}
      <View style={styles.badge}>
        <Ionicons name="shield-half-outline" size={22} color={ACCENT} />
      </View>

      {/* Header */}
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardSubtitle}>{subtitle}</Text>
      </View>

      {/* Formulario */}
      <View style={styles.form}>
        {/* === REGISTRO === */}
        {isRegister && (
          <>
            <View style={styles.entityTypeToggle}>
              <TouchableOpacity
                style={[
                  styles.entityTypeBtn,
                  registerEntityType === 'corporate' && styles.entityTypeBtnActive,
                ]}
                onPress={() => { setRegisterEntityType('corporate'); setFormError(''); }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="business" size={16} color={registerEntityType === 'corporate' ? '#ffffff' : NAVY} />
                <Text style={[styles.entityTypeText, registerEntityType === 'corporate' && styles.entityTypeTextActive]}>
                  Empresa
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.entityTypeBtn,
                  registerEntityType === 'sme' && styles.entityTypeBtnActive,
                ]}
                onPress={() => { setRegisterEntityType('sme'); setFormError(''); }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="storefront" size={16} color={registerEntityType === 'sme' ? '#ffffff' : NAVY} />
                <Text style={[styles.entityTypeText, registerEntityType === 'sme' && styles.entityTypeTextActive]}>
                  PYME
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.entityTypeBtn,
                  registerEntityType === 'independent' && styles.entityTypeBtnActive,
                ]}
                onPress={() => { setRegisterEntityType('independent'); setFormError(''); }}
                activeOpacity={0.8}
              >
                <MaterialIcons name="person-outline" size={16} color={registerEntityType === 'independent' ? '#ffffff' : NAVY} />
                <Text style={[styles.entityTypeText, registerEntityType === 'independent' && styles.entityTypeTextActive]}>
                  Independiente
                </Text>
              </TouchableOpacity>
            </View>
            
            {(registerEntityType === 'corporate' || registerEntityType === 'sme') && (
              <Field
                field="businessName"
                placeholder={registerEntityType === 'sme' ? "Nombre de la PYME *" : "Nombre de la empresa *"}
                value={businessName}
                onChangeText={(v) => { setBusinessName(v); setFormError(''); }}
                icon={<MaterialIcons name={registerEntityType === 'sme' ? "storefront" : "store"} size={16} color="#94a3b8" />}
                autoCapitalize="words"
                focusedField={focusedField}
                setFocusedField={setFocusedField}
              />
            )}
            <Field
              field="managerName"
              placeholder={registerEntityType === 'independent' ? "Nombre o marca personal *" : "Nombre del representante *"}
              value={managerName}
              onChangeText={(v) => { setManagerName(v); setFormError(''); }}
              icon={<MaterialIcons name="person" size={16} color="#94a3b8" />}
              autoCapitalize="words"
              focusedField={focusedField}
              setFocusedField={setFocusedField}
            />
          </>
        )}

        {/* === EMAIL (todos los estados) === */}
        <Field
          field="email"
          placeholder="correo@empresa.com"
          value={email}
          onChangeText={(v) => { setEmail(v); setFormError(''); }}
          icon={<Ionicons name="mail-outline" size={16} color="#94a3b8" />}
          keyboardType="email-address"
          focusedField={focusedField}
          setFocusedField={setFocusedField}
        />

        {/* === TELÉFONO (solo registro) === */}
        {isRegister && (
          <Field
            field="phone"
            placeholder="Teléfono de contacto"
            value={phone}
            onChangeText={(v) => { setPhone(v); setFormError(''); }}
            icon={<MaterialIcons name="phone" size={16} color="#94a3b8" />}
            keyboardType="phone-pad"
            focusedField={focusedField}
            setFocusedField={setFocusedField}
          />
        )}

        {/* === CONTRASEÑA (login y registro) === */}
        {!isRecovery && (
          <View style={styles.fieldWrap}>
            <View style={styles.fieldIcon}>
              <Ionicons name="lock-closed-outline" size={16} color="#94a3b8" />
            </View>
            <TextInput
              placeholder="Contraseña"
              placeholderTextColor="#94a3b8"
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={(v) => { setPassword(v); setFormError(''); }}
              onFocus={() => setFocusedField('password')}
              onBlur={() => setFocusedField(null)}
              style={[
                styles.input,
                {
                  borderColor: focusedField === 'password' ? ACCENT : '#cbd5e1',
                  borderWidth: 1,
                  paddingRight: 44,
                },
              ]}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color="#64748b"
              />
            </TouchableOpacity>
          </View>
        )}

        {/* === OLVIDÉ CONTRASEÑA (solo login) === */}
        {isLogin && (
          <TouchableOpacity onPress={() => setVista(VISTAS.RECOVERY)} style={styles.forgotWrap}>
            <Text style={styles.forgotText}>¿Olvidaste tu contraseña? Recupérala aquí</Text>
          </TouchableOpacity>
        )}

        {/* Error del formulario */}
        {formError ? (
          <View style={styles.errorWrap}>
            <Ionicons name="alert-circle-outline" size={16} color="#ef4444" />
            <Text style={styles.errorText}>{formError}</Text>
          </View>
        ) : null}

        {/* === BOTÓN PRINCIPAL === */}
        <TouchableOpacity
          onPress={handleSubmit}
          style={[styles.btnSubmit, { backgroundColor: ACCENT }]}
          disabled={isLoading}
          activeOpacity={0.88}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Text style={styles.btnSubmitText}>{submitText}</Text>
              {isLogin && <Ionicons name="arrow-forward" size={18} color="#ffffff" />}
              {isRegister && <MaterialIcons name="arrow-forward" size={18} color="#ffffff" />}
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Footer */}
      <View style={styles.cardFooter}>
        {!isRecovery ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 4 }}>
            <Text style={styles.footerText}>{footerQuestion}</Text>
            <TouchableOpacity onPress={switchVista}>
              <Text style={[styles.footerLink, { color: ACCENT }]}>{footerAction}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={() => setVista(VISTAS.LOGIN)}>
            <Text style={[styles.footerLink, { color: ACCENT, textAlign: 'center' }]}>
              ← Volver al inicio de sesión
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => router.replace('/')} style={{ marginTop: 12 }}>
          <Text style={[styles.footerText, { textAlign: 'center' }]}>Volver al inicio</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // ─── Layout ───────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      {!isMobile ? (
        <ImageBackground source={{ uri: BG_IMAGE }} style={styles.bg} resizeMode="cover">
          <View
            style={[
              styles.overlay,
              Platform.OS === 'web' && ({ backdropFilter: 'blur(4px)' } as any),
            ]}
          >
            <ScrollView
              contentContainerStyle={styles.scrollDesktop}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {card}
            </ScrollView>
          </View>
        </ImageBackground>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollMobile, { paddingTop: Math.max(insets.top, 24) }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {card}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: NAVY,
  },
  bg: {
    flex: 1,
    width: '100%',
    minHeight: '100%' as unknown as number,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
  },
  scrollDesktop: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scrollMobile: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  // ── Card ──
  card: {
    backgroundColor: '#ffffff',
    width: '100%',
    borderRadius: 0,
    padding: 32,
    ...Platform.select({
      web: { boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)' },
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 24,
      },
      android: { elevation: 16 },
    }),
  },
  cardDesktop: {
    maxWidth: 420,
    borderRadius: 12,
  },
  // ── Badge ──
  badge: {
    width: 48,
    height: 48,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  // ── Header ──
  cardHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 4,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    textAlign: 'center',
    maxWidth: 300,
  },
  // ── Form ──
  form: {
    gap: 14,
  },
  fieldWrap: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIcon: {
    position: 'absolute',
    left: 14,
    zIndex: 10,
  },
  input: {
    flex: 1,
    height: 44,
    paddingLeft: 42,
    paddingRight: 16,
    borderRadius: 8,
    fontSize: 14,
    color: NAVY,
    backgroundColor: '#f8fafc',
    ...Platform.select({
      web: { outlineStyle: 'none' },
    }),
  } as any,
  eyeBtn: {
    position: 'absolute',
    right: 12,
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  forgotWrap: {
    marginTop: -2,
  },
  forgotText: {
    fontSize: 13,
    color: ACCENT,
    fontWeight: '600',
  },
  // ── Submit ──
  btnSubmit: {
    height: 44,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    ...Platform.select({
      web: {
        boxShadow: `0 4px 6px -1px rgba(37,99,235,0.2), 0 2px 4px -1px rgba(37,99,235,0.1)`,
        cursor: 'pointer',
        transition: 'background 0.2s, transform 0.1s',
      },
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  } as any,
  btnSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  // ── Toggle Type ──
  entityTypeToggle: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    padding: 4,
    marginBottom: 4,
  },
  entityTypeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 6,
  },
  entityTypeBtnActive: {
    backgroundColor: ACCENT,
    ...Platform.select({
      web: { boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 },
      android: { elevation: 2 },
    }),
  },
  entityTypeText: {
    fontSize: 13,
    fontWeight: '600',
    color: NAVY,
  },
  entityTypeTextActive: {
    color: '#ffffff',
  },
  // ── Footer ──
  cardFooter: {
    marginTop: 24,
  },
  footerText: {
    fontSize: 13,
    color: '#64748b',
  },
  footerLink: {
    fontSize: 13,
    fontWeight: '600',
  },
  errorWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  errorText: {
    fontSize: 13,
    color: '#ef4444',
    flex: 1,
    lineHeight: 18,
  },
});
