import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';

import { TopAppBarProps, TabType } from '../types';

import { NavLink } from './NavLink';

const colors = {
  surface: '#1A1F2E', // Matching the dark theme of the app for the floating bar
  'primary-container': '#34D399',
  'on-primary-container': '#FFFFFF',
  'on-surface-variant': '#A0AEC0',
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(34, 34, 34, 0.55)', // oscuro carbon con más transparencia (medio transparente)
    paddingVertical: 4, // altura más delgada
    paddingHorizontal: 12,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 30, // bordes redondeados
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
      },
      android: {
        elevation: 8,
      },
      web: {
        maxWidth: 600,
        marginHorizontal: 'auto',
        boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.3)',
        backdropFilter: 'blur(10px)', // Glassmorphism para web
      },
    }),
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
});

export const TopAppBar: React.FC<TopAppBarProps> = ({ currentTab = 'map', onTabChange }) => {
  const [activeTab, setActiveTab] = useState<TabType>(currentTab);

  useEffect(() => {
    setActiveTab(currentTab);
  }, [currentTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const tabs: { id: TabType; icon: string; label?: string }[] = [
    { id: 'map', icon: 'map', label: 'Inicio' },
    { id: 'forum', icon: 'forum', label: 'Foro' },
    { id: 'saved', icon: 'bookmark' },
    { id: 'settings', icon: 'settings' },
    { id: 'profile', icon: 'person' },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.navContainer}>
        {tabs.map((tab) => (
          <NavLink
            key={tab.id}
            icon={tab.icon}
            label={tab.label}
            active={activeTab === tab.id}
            onClick={() => handleTabChange(tab.id)}
          />
        ))}
      </View>
    </View>
  );
};
