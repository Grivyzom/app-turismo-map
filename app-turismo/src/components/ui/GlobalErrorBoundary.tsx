import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReload = () => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.location.reload();
    } else {
      this.setState({ hasError: false, error: null });
    }
  };

  public render() {
    if (this.state.hasError) {
      const isChunkError = this.state.error?.name === 'ChunkLoadError' || 
                          this.state.error?.message?.includes('Loading chunk') ||
                          this.state.error?.message?.includes('AsyncRequireError');

      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <Text style={styles.title}>
              {isChunkError ? 'Error de conexión' : 'Algo salió mal'}
            </Text>
            <Text style={styles.message}>
              {isChunkError 
                ? 'No pudimos cargar una parte de la aplicación. Esto puede deberse a una conexión inestable o a una actualización reciente.'
                : 'Ocurrió un error inesperado al mostrar esta pantalla.'}
            </Text>
            
            <TouchableOpacity style={styles.button} onPress={this.handleReload}>
              <Text style={styles.buttonText}>
                {Platform.OS === 'web' ? 'Recargar aplicación' : 'Reintentar'}
              </Text>
            </TouchableOpacity>

            {__DEV__ && (
              <Text style={styles.debugText}>
                {this.state.error?.toString()}
              </Text>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#161B22',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#30363D',
    alignItems: 'center',
  },
  title: {
    color: '#F0F6FC',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: '#8B949E',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#238636',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  debugText: {
    color: '#F85149',
    fontSize: 10,
    marginTop: 20,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  }
});
