import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { MobileTab } from '../MobileAppContext';

export type NavItem = { key: MobileTab; label: string; render: (color: string) => React.ReactNode };

/** Secciones del dock (teléfono) y del rail (escritorio). La Guía se dibuja aparte, destacada. */
export const NAV_ITEMS: NavItem[] = [
  {
    key: 'inicio',
    label: 'Inicio',
    render: (c) => <Ionicons name="home-outline" size={22} color={c} />,
  },
  {
    key: 'mapa',
    label: 'Mapa',
    render: (c) => <Ionicons name="map-outline" size={22} color={c} />,
  },
  { key: 'guia', label: 'Guía', render: () => null },
  {
    key: 'rutas',
    label: 'Rutas',
    render: (c) => <MaterialIcons name="route" size={22} color={c} />,
  },
  {
    key: 'perfil',
    label: 'Perfil',
    render: (c) => <Ionicons name="person-outline" size={22} color={c} />,
  },
];
