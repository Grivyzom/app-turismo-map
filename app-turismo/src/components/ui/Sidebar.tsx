import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import Ionicons from '@expo/vector-icons/Ionicons';

interface SidebarProps {
  onNavigate?: (section: string) => void;
  onNotificationsClick?: () => void;
  onSuggestionsClick?: () => void;
  onProfileClick?: () => void;
}

type SidebarSection = 'feed' | 'eventos' | 'guardados' | 'recientes' | 'sugerencias';

const SIDEBAR_WIDTH = 280;
const SIDEBAR_WIDTH_COLLAPSED = 80;

export function Sidebar({
  onNavigate,
  onNotificationsClick,
  onSuggestionsClick,
  onProfileClick,
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeSection, setActiveSection] = useState<SidebarSection>('feed');

  const screenWidth = Dimensions.get('window').width;
  const isMobile = screenWidth < 768;
  const effectiveCollapsed = isMobile ? true : isCollapsed;

  const sidebarWidth = effectiveCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH;

  const menuItems: {
    id: SidebarSection;
    label: string;
    icon: string;
    badge?: number;
  }[] = [
    { id: 'feed', label: 'Feed', icon: 'home' },
    { id: 'eventos', label: 'Eventos', icon: 'event' },
    { id: 'guardados', label: 'Guardados', icon: 'bookmark' },
    { id: 'recientes', label: 'Historial', icon: 'history' },
    { id: 'sugerencias', label: 'Sugerencias', icon: 'lightbulb' },
  ];

  const handleMenuItemClick = (id: SidebarSection) => {
    setActiveSection(id);
    onNavigate?.(id);
  };

  return (
    <View style={[styles.sidebar, { width: sidebarWidth }]}>
      {/* TOP SECTION */}
      <View style={styles.topSection}>
        {/* Collapse/Expand + Notifications Row */}
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={styles.collapseButton}
            onPress={() => setIsCollapsed(!effectiveCollapsed)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <MaterialIcons
              name={effectiveCollapsed ? 'chevron-right' : 'chevron-left'}
              size={20}
              color="#9CA3AF"
            />
          </TouchableOpacity>

          {!effectiveCollapsed && (
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={onNotificationsClick}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons name="notifications" size={18} color="#F59E0B" />
              <View style={styles.notificationBadge}>
                <Text style={styles.notificationBadgeText}>3</Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        {/* Menu Items */}
        <ScrollView
          style={styles.menuScroll}
          showsVerticalScrollIndicator={false}
          scrollEnabled={!effectiveCollapsed}
        >
          <View style={styles.menuItems}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.menuItem,
                  activeSection === item.id && styles.activeMenuItem,
                  effectiveCollapsed && styles.menuItemCollapsed,
                ]}
                onPress={() => handleMenuItemClick(item.id)}
                hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
              >
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={activeSection === item.id ? '#34D399' : '#9CA3AF'}
                />
                {!effectiveCollapsed && (
                  <>
                    <Text
                      style={[
                        styles.menuLabel,
                        activeSection === item.id && styles.activeMenuLabel,
                      ]}
                    >
                      {item.label}
                    </Text>
                    {item.badge && (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    )}
                  </>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* BOTTOM SECTION */}
      <View style={styles.bottomSection}>
        {/* Divider */}
        <View style={styles.divider} />

        {/* Suggestions Button */}
        <TouchableOpacity
          style={[styles.bottomButton, effectiveCollapsed && styles.bottomButtonCollapsed]}
          onPress={onSuggestionsClick}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="lightbulb" size={18} color="#BAE6FD" />
          {!effectiveCollapsed && <Text style={styles.bottomButtonLabel}>Sugerencias</Text>}
        </TouchableOpacity>

        {/* Profile Button */}
        <TouchableOpacity
          style={[styles.bottomButton, effectiveCollapsed && styles.bottomButtonCollapsed]}
          onPress={onProfileClick}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons name="account-circle" size={18} color="#9CA3AF" />
          {!effectiveCollapsed && <Text style={styles.bottomButtonLabel}>Perfil</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'column',
    height: '100%',
    ...Platform.select({
      web: {
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      },
    }),
  },
  topSection: {
    flex: 1,
    paddingVertical: 12,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  collapseButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationButton: {
    position: 'relative',
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: '#F59E0B',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(17, 24, 39, 0.95)',
  },
  notificationBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  menuScroll: {
    flex: 1,
  },
  menuItems: {
    gap: 6,
    paddingHorizontal: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    gap: 12,
  },
  menuItemCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  activeMenuItem: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderLeftWidth: 3,
    borderLeftColor: '#34D399',
  },
  menuLabel: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '500',
  },
  activeMenuLabel: {
    color: '#34D399',
    fontWeight: '600',
  },
  badge: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    minWidth: 24,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  bottomSection: {
    paddingVertical: 12,
    gap: 6,
    paddingHorizontal: 8,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginHorizontal: 8,
    marginBottom: 8,
  },
  bottomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    gap: 12,
  },
  bottomButtonCollapsed: {
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  bottomButtonLabel: {
    flex: 1,
    color: '#D1D5DB',
    fontSize: 13,
    fontWeight: '500',
  },
});
