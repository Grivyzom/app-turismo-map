import React from 'react';
import { Redirect } from 'expo-router';

// Redirige al mapa principal y abre el modal de inicio de sesión
export default function LoginRedirect() {
  return <Redirect href="/(home)?auth=login" />;
}
