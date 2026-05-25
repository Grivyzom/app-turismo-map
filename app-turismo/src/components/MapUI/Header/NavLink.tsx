import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { NavLinkProps } from '../types';

const colors = {
  'primary-container': 'rgba(255, 255, 255, 0.15)', // Light translucent for active tab
  'on-primary-container': '#FFFFFF', // White text/icon for active
  'on-surface-variant': '#9CA3AF', // Light gray for inactive
  'surface-variant': '#e1e3e4',
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 4, // altura reducida
    borderRadius: 24,
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  active: {
    backgroundColor: colors['primary-container'],
  },
  inactive: {
    backgroundColor: 'transparent',
  },
  activeText: {
    color: colors['on-primary-container'],
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.05,
  },
  inactiveText: {
    color: colors['on-surface-variant'],
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.05,
  },
  iconOnly: {
    paddingHorizontal: 12,
  },
});

export const NavLink: React.FC<NavLinkProps> = ({ icon, label, active = false, onClick }) => {
  return (
    <TouchableOpacity
      onPress={onClick}
      activeOpacity={0.7}
      style={[styles.base, active ? styles.active : styles.inactive, !label && styles.iconOnly]}
    >
      <MaterialIcons
        name={icon as any}
        size={24}
        color={active ? colors['on-primary-container'] : colors['on-surface-variant']}
      />
      {label ? <Text style={active ? styles.activeText : styles.inactiveText}>{label}</Text> : null}
    </TouchableOpacity>
  );
};
