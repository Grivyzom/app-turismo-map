import React from 'react';
import { Redirect } from 'expo-router';

// Ya no existe como pantalla aislada: redirige al mapa principal y abre el modal de autenticación
export default function IngresarRedirect() {
  return <Redirect href="/(home)?auth=login" />;
}
