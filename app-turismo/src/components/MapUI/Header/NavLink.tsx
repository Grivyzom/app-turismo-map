import React, { memo } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform, useWindowDimensions } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import { NavLinkProps } from '../types';

const colors = {
  'primary-container': '#2E2E2E', // Obsidian active tab pane background
  'on-primary-container': '#FFFFFF', // White text/icon for active
  'on-surface-variant': '#A3A3A3', // Obsidian text-muted gray
  'accent-color': '#7F6DF2', // Obsidian signature purple
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16, // Pill shape for navigation tabs
    borderWidth: 1,
    borderColor: 'transparent',
    ...Platform.select({
      web: {
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
      },
    }),
  },
  active: {
    backgroundColor: colors['primary-container'],
    borderColor: '#3E3E3E',
  },
  inactive: {
    backgroundColor: 'transparent',
  },
  activeText: {
    color: colors['on-primary-container'],
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  inactiveText: {
    color: colors['on-surface-variant'],
    fontSize: 13,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  iconOnly: {
    paddingHorizontal: 8,
  },
});

const NavLinkComponent: React.FC<NavLinkProps & { onHover?: () => void }> = ({
  icon,
  label,
  active = false,
  onClick,
  onHover,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const { width } = useWindowDimensions();
  const isSmallScreen = width < 600;

  return (
    <TouchableOpacity
      onPress={onClick}
      activeOpacity={0.7}
      //@ts-ignore
      onMouseEnter={() => {
        setIsHovered(true);
        if (onHover) onHover();
      }}
      onMouseLeave={() => setIsHovered(false)}
      style={[
        styles.base,
        active ? styles.active : styles.inactive,
        (!label || isSmallScreen) && styles.iconOnly,
        isSmallScreen && { paddingHorizontal: 8 },
        isHovered &&
          !active &&
          ({ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: '#2E2E2E' } as any),
      ]}
    >
      <MaterialIcons
        name={icon as any}
        size={isSmallScreen ? 18 : 20} // Compact, sharp icons
        color={active ? colors['accent-color'] : colors['on-surface-variant']}
      />
      {label && !isSmallScreen ? (
        <Text style={active ? styles.activeText : styles.inactiveText}>{label}</Text>
      ) : null}
    </TouchableOpacity>
  );
};

NavLinkComponent.displayName = 'NavLink';
export const NavLink = memo(NavLinkComponent);
