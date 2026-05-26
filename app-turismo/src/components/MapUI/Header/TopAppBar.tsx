import React, { useEffect, useState } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { TopAppBarProps, TabType } from '../types';
import { NavLink } from './NavLink';
import { SmartVoiceSearch } from '../../ui/SmartVoiceSearch';
import { ParsedSearch } from '../../../utils/aiSearchParser';

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
    minHeight: 48,
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
        transition: 'background-color 0.3s ease',
      },
    }),
  },
  navContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flex: 1,
  },
  searchActiveContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    height: 40,
  },
  backButton: {
    padding: 8,
    marginRight: 4,
  }
});

export const TopAppBar: React.FC<TopAppBarProps & { onHoverIn?: () => void; onHoverOut?: () => void; onVoiceSearch?: (res: ParsedSearch) => void }> = (props) => {
  const { currentTab = 'map', onTabChange, onVoiceSearch } = props;
  const [activeTab, setActiveTab] = useState<TabType>(currentTab);
  const [isSearchActive, setIsSearchActive] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setActiveTab(currentTab);
    }, 0);
    return () => clearTimeout(timer);
  }, [currentTab]);

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if ((props as any).onHoverIn) (props as any).onHoverIn();
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if ((props as any).onHoverOut) (props as any).onHoverOut();
  };

  const tabs: { id: TabType; icon: string; label?: string }[] = [
    { id: 'map', icon: 'map', label: 'Inicio' },
    { id: 'forum', icon: 'forum', label: 'Foro' },
    { id: 'saved', icon: 'bookmark' },
    { id: 'settings', icon: 'settings' },
    { id: 'profile', icon: 'person' },
  ];

  return (
    <View
      style={[styles.container, isHovered && { backgroundColor: 'rgba(54, 54, 54, 0.75)' }] as any}
      //@ts-ignore
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {isSearchActive ? (
        <View style={styles.searchActiveContainer}>
          <TouchableOpacity onPress={() => setIsSearchActive(false)} style={styles.backButton}>
            <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <SmartVoiceSearch 
            isEmbedded={true} 
            onSearchComplete={(res) => {
              setIsSearchActive(false);
              if (onVoiceSearch) onVoiceSearch(res);
            }} 
          />
        </View>
      ) : (
        <View style={styles.navContainer}>
          <NavLink
            icon="search"
            active={false}
            onClick={() => setIsSearchActive(true)}
          />
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
      )}
    </View>
  );
};
