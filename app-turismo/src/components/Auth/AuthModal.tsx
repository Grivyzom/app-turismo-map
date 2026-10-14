import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  Platform,
  Animated,
  useWindowDimensions,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { useAuth, AuthModalMode } from '../../context/AuthContext';
import { ClerkAuthCard } from './ClerkAuthCard';
import { NAVBAR_CLEARANCE } from '../../utils/layout';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  onClose: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AuthModalErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: any): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Error inesperado al inicializar la autenticación.',
    };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error('[AuthModal] Error caught in AuthModalErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorBoxContainer}>
          <Ionicons name="alert-circle-outline" size={44} color="#EF4444" />
          <Text style={styles.errorBoxTitle}>Error de autenticación</Text>
          <Text style={styles.errorBoxMessage}>{this.state.errorMessage}</Text>
          <View style={styles.errorBoxActionRow}>
            <TouchableOpacity
              style={styles.errorBoxRetryButton}
              onPress={() => this.setState({ hasError: false, errorMessage: '' })}
            >
              <Text style={styles.errorBoxRetryText}>Reintentar</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.errorBoxCloseButton}
              onPress={this.props.onClose}
            >
              <Text style={styles.errorBoxCloseText}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
    return this.props.children;
  }
}

interface AuthModalProps {
  visible?: boolean;
  onClose?: () => void;
  initialMode?: AuthModalMode;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  visible: propVisible,
  onClose: propOnClose,
  initialMode,
}) => {
  const { isAuthModalOpen, authModalMode, closeAuthModal, setAuthModalMode, isAuthenticated } = useAuth();
  const isVisible = propVisible !== undefined ? propVisible : isAuthModalOpen;
  const handleClose = propOnClose || closeAuthModal;

  const { height } = useWindowDimensions();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (initialMode) {
      setAuthModalMode(initialMode);
    }
  }, [initialMode, setAuthModalMode]);

  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 280,
          friction: 24,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.95,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isVisible, fadeAnim, scaleAnim]);

  // Listener para cerrar con tecla Escape en Web
  useEffect(() => {
    if (Platform.OS === 'web' && isVisible) {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleClose();
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [isVisible, handleClose]);

  if (!isVisible || (isAuthenticated && propVisible === undefined)) return null;

  const isRegister = authModalMode === 'register';

  return (
    <Animated.View
      style={[
        styles.overlay,
        {
          opacity: fadeAnim as any,
        },
      ]}
      pointerEvents="auto"
    >
      {/* Fondo Blur para Native */}
      {Platform.OS !== 'web' && (
        <BlurView intensity={75} tint="dark" style={StyleSheet.absoluteFill} />
      )}

      {/* Capa de cierre al tocar el fondo fuera de la tarjeta */}
      <Pressable style={styles.backdropDismiss} onPress={handleClose} />

      {/* Contenedor flotante centrado de Clerk */}
      <Animated.View
        style={[
          styles.modalCardWrapper,
          {
            maxHeight: Math.min(height - NAVBAR_CLEARANCE - 40, 780),
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* Botón flotante para cerrar */}
        <TouchableOpacity
          style={styles.floatingCloseButton}
          onPress={handleClose}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Cerrar modal de autenticación"
        >
          <Ionicons name="close" size={20} color="#F3F4F6" />
        </TouchableOpacity>

        {/* Componente oficial de autenticación con Clerk aislado con ErrorBoundary */}
        <AuthModalErrorBoundary onClose={handleClose}>
          <ClerkAuthCard
            isRegister={isRegister}
            onToggleMode={(mode: AuthModalMode) => setAuthModalMode(mode)}
            onClose={handleClose}
          />
        </AuthModalErrorBoundary>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 5500, // Debajo de topBarWrapper (6000) para que el navbar superior NUNCA se ponga borroso
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: NAVBAR_CLEARANCE,
    paddingBottom: 24,
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(5, 8, 16, 0.65)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      } as any,
      default: {
        backgroundColor: 'rgba(5, 8, 16, 0.75)',
      },
    }),
  },
  backdropDismiss: {
    ...StyleSheet.absoluteFill,
  },
  modalCardWrapper: {
    width: '100%',
    maxWidth: 440,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    zIndex: 5501,
  },
  floatingCloseButton: {
    position: 'absolute',
    top: -12,
    right: -12,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#1F2937',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5510,
    ...Platform.select({
      web: {
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
        cursor: 'pointer',
      } as any,
      default: {
        elevation: 6,
      },
    }),
  },
  errorBoxContainer: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 24,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorBoxTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 12,
    marginBottom: 6,
    textAlign: 'center',
  },
  errorBoxMessage: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
  errorBoxActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  errorBoxRetryButton: {
    backgroundColor: '#10B981',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  errorBoxRetryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorBoxCloseButton: {
    backgroundColor: '#374151',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  errorBoxCloseText: {
    color: '#F3F4F6',
    fontSize: 14,
    fontWeight: '600',
  },
});

