import React from 'react';
import { Redirect } from 'expo-router';

// Redirige al mapa principal y abre el modal de registro
export default function RegistroRedirect() {
  return <Redirect href="/(home)?auth=register" />;
}
