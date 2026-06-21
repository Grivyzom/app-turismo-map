import { Redirect } from 'expo-router';

// Redirige a la vista unificada de autenticación
export default function LoginRedirect() {
  return <Redirect href="/ingresar" />;
}
