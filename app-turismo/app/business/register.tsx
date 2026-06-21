import { Redirect } from 'expo-router';

// Redirige a la vista unificada del portal empresarial
export default function BusinessRegisterRedirect() {
  return <Redirect href="/business/ingresar" />;
}
