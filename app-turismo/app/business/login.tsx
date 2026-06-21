import { Redirect } from 'expo-router';

// Redirige a la vista unificada del portal empresarial
export default function BusinessLoginRedirect() {
  return <Redirect href="/business/ingresar" />;
}
