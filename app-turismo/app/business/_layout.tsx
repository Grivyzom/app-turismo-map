import { Stack } from 'expo-router';

export default function BusinessLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ingresar" options={{ title: 'Portal Empresarial' }} />
      <Stack.Screen name="login" options={{ title: 'Business Login' }} />
      <Stack.Screen name="register" options={{ title: 'Business Register' }} />
      <Stack.Screen name="dashboard" options={{ title: 'Business Dashboard' }} />
      <Stack.Screen name="geolocalizar" options={{ title: 'Geolocalizar Empresa' }} />
      <Stack.Screen name="create-event" options={{ title: 'Crear Evento' }} />
      <Stack.Screen name="logout" options={{ title: 'Business Logout' }} />
    </Stack>
  );
}
