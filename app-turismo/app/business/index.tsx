import React from 'react';
import { Redirect } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';

// Redirige al portal de ingreso empresarial o al dashboard
export default function BusinessIndex() {
  const { isAuthenticated, userType } = useAuth();

  if (isAuthenticated && (userType === 'partner_owner' || userType === 'partner_worker')) {
    return <Redirect href="/business/dashboard" />;
  }

  return <Redirect href="/business/ingresar" />;
}
