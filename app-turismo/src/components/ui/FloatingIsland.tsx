import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Dimensions,
} from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { loadUserProfile, getDefaultUserProfile, type NormalUserProfile } from '../../utils/userProfileStorage';

import FeedScreen from '../../screens/FeedScreen';
import PassportScreen from '../../screens/PassportScreen';
import ForumScreen from '../../screens/ForumScreen';
import UserProfileScreen from '../../screens/UserProfileScreen';

import { TabType } from '../MapUI/types';

export interface FloatingIslandItem {
  id: string;
  label: string;
  iconName: string;
  iconFamily: 'Ionicons' | 'MaterialIcons';
  component?: React.ReactNode;
  render?: () => React.ReactNode;
  headerTitle: string;
}

interface FloatingIslandProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  onClose: () => void;
  items?: FloatingIslandItem[];
  children?: React.ReactNode;
  showSidebar?: boolean;
}

const DEFAULT_ITEMS: FloatingIslandItem[] = [
  {
    id: 'feed',
    label: 'Feed de Eventos',
    iconName: 'dynamic-feed',
    iconFamily: 'MaterialIcons',
    render: () => <FeedScreen />,
    headerTitle: 'El Pulso de la Ciudad',
  },
  {
    id: 'saved',
    label: 'Mi Pasaporte',
    iconName: 'bookmark',
    iconFamily: 'Ionicons',
    render: () => <PassportScreen />,
    headerTitle: 'Pasaporte Turístico',
  },
  {
    id: 'forum',
    label: 'Foro de Discusión',
    iconName: 'forum',
    iconFamily: 'MaterialIcons',
    render: () => <ForumScreen />,
    headerTitle: 'Comunidad & Foro',
  },
  {
    id: 'profile',
    label: 'Mi Perfil',
    iconName: 'person',
    iconFamily: 'MaterialIcons',
    render: () => <UserProfileScreen />,
    headerTitle: 'Mi Cuenta',
  },
];

export default function FloatingIsland({
  activeTab,
  onTabChange,
  onClose,
  items,
  children,
  showSidebar = true,
}: FloatingIslandProps) {
  const [profile, setProfile] = useState<NormalUserProfile>(getDefaultUserProfile());
  const [isPinned, setIsPinned] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    if (activeTab === 'feed') {
      setIsPinned(false);
    } else {
      setIsPinned(true);
    }
  }, [activeTab]);

  const isExpanded = isPinned || isHovered;

  useEffect(() => {
    let isMounted = true;
    void loadUserProfile().then((storedProfile) => {
      if (isMounted && storedProfile) {
        setProfile(storedProfile);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [activeTab]); // Recargar cuando cambie de pestaña (por si editó su perfil)

  const currentItems = items || DEFAULT_ITEMS;

  // Instanciar y memorizar cada pantalla una sola vez al montar
  const screenElements = useMemo(() => {
    return currentItems.map((item) => {
      const Element = item.render ? item.render() : item.component;
      return {
        id: item.id,
        element: Element,
      };
    });
  }, [currentItems]);

  const getHeaderTitle = () => {
    if (children) {
      return 'Lienzo de Contenido';
    }
    const activeItem = currentItems.find((item) => item.id === activeTab);
    return activeItem ? activeItem.headerTitle : 'Portal Turístico';
  };

  return (
    <View style={styles.overlayContainer}>
      {/* Tap-to-dismiss background backdrop */}
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      />

      <View style={styles.islandContainer}>
        {/* Glowing sub-borders (Visual enhancement) */}
        <View style={styles.glowBorderTop} />

        {/* SIDEBAR DE NAVEGACIÓN */}
        {showSidebar && (
          <View 
            style={[styles.sidebar, { width: isExpanded ? 280 : 88, paddingHorizontal: isExpanded ? 24 : 12 }]}
            {...(Platform.OS === 'web'
              ? {
                  onMouseEnter: () => setIsHovered(true),
                  onMouseLeave: () => setIsHovered(false),
                }
              : {})}
          >
            <View style={[styles.brandContainer, !isExpanded && { justifyContent: 'center' }]}>
              {isExpanded ? (
                <>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={styles.logoBadge}>
                      <MaterialIcons name="explore" size={24} color="#6EE7B7" />
                    </View>
                    <View>
                      <Text style={styles.brandTitle}>Valdivia</Text>
                      <Text style={styles.brandSubtitle}>PORTAL TURÍSTICO</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={() => setIsPinned(!isPinned)} style={styles.pinButton}>
                    <MaterialIcons name={"push-pin"} size={16} color={isPinned ? "#6EE7B7" : "#4B5563"} style={!isPinned ? { transform: [{ rotate: '45deg' }] } : {}} />
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.logoBadge}>
                  <MaterialIcons name="explore" size={24} color="#6EE7B7" />
                </View>
              )}
            </View>

            <View style={styles.divider} />

            {/* Menú de Navegación */}
            <View style={styles.navMenu}>
              {/* Botón de Explorar Mapa */}
              <TouchableOpacity
                style={[
                  styles.navItem,
                  !isExpanded && { justifyContent: 'center', paddingHorizontal: 0 },
                  activeTab === 'map' && styles.navItemActive,
                ]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Ionicons
                  name="map"
                  size={20}
                  color={activeTab === 'map' ? '#6EE7B7' : '#9CA3AF'}
                  style={isExpanded ? styles.navIcon : {}}
                />
                {isExpanded && (
                  <Text style={[styles.navLabel, activeTab === 'map' && styles.navLabelActive]}>
                    Explorar Mapa
                  </Text>
                )}
              </TouchableOpacity>

              {isExpanded ? (
                <View style={styles.sectionTitleWrapper}>
                  <Text style={styles.sectionTitle}>SECCIONES</Text>
                </View>
              ) : (
                <View style={{ height: 24 }} />
              )}

              {/* Resto de pestañas */}
              {currentItems.map((item) => {
                const isActive = activeTab === item.id;
                const IconComp = item.iconFamily === 'Ionicons' ? Ionicons : MaterialIcons;

                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.navItem,
                      !isExpanded && { justifyContent: 'center', paddingHorizontal: 0 },
                      isActive && styles.navItemActive,
                    ]}
                    onPress={() => onTabChange(item.id as any)}
                    activeOpacity={0.8}
                  >
                    <IconComp
                      name={item.iconName as any}
                      size={20}
                      color={isActive ? '#6EE7B7' : '#9CA3AF'}
                      style={isExpanded ? styles.navIcon : {}}
                    />
                    {isExpanded && (
                      <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                        {item.label}
                      </Text>
                    )}
                    {isActive && isExpanded && <View style={styles.activeDot} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tarjeta de Perfil al Fondo del Sidebar */}
            <TouchableOpacity
              style={[
                styles.sidebarProfile,
                !isExpanded && { padding: 0, backgroundColor: 'transparent', borderWidth: 0, justifyContent: 'center' }
              ]}
              onPress={() => onTabChange('profile')}
              activeOpacity={0.9}
            >
              <View style={styles.sidebarAvatar}>
                <MaterialIcons name={profile.avatarIcon} size={20} color="#6EE7B7" />
              </View>
              {isExpanded && (
                <>
                  <View style={styles.profileTextContainer}>
                    <Text style={styles.profileName} numberOfLines={1}>
                      {profile.fullName}
                    </Text>
                    <Text style={styles.profileRole}>
                      {profile.userType === 'citizen'
                        ? 'Turista'
                        : profile.userType === 'partner_owner'
                        ? 'Entidad'
                        : 'Invitado'}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={18} color="#4B5563" />
                </>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* CONTENEDOR PRINCIPAL DE CONTENIDO */}
        <View style={styles.contentArea}>
          <View style={styles.contentHeader}>
            <Text style={styles.contentHeaderTitle}>
              {getHeaderTitle()}
            </Text>
            <TouchableOpacity style={styles.closeButton} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <View style={styles.contentWrapper}>
            {/* Animación fade-in controlada mediante CSS en Web */}
            <View style={styles.innerContent}>
              {children ? (
                children
              ) : (
                screenElements.map((screen) => {
                  const isActive = activeTab === screen.id;
                  return (
                    <View
                      key={screen.id}
                      style={{
                        display: isActive ? 'flex' : 'none',
                        flex: 1,
                      }}
                    >
                      {screen.element}
                    </View>
                  );
                })
              )}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    justifyContent: 'flex-end',
    alignItems: 'center',
    ...Platform.select({
      web: {
        paddingBottom: '3.5vh',
      } as any,
      default: {
        paddingBottom: 24,
      }
    }),
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    pointerEvents: 'auto',
  },
  islandContainer: {
    width: '96vw',
    height: '88vh',
    maxWidth: 1750,
    maxHeight: 1000,
    borderRadius: 24,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(15, 20, 28, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      } as any,
      default: {
        backgroundColor: '#0f141c',
      },
    }),
  },
  glowBorderTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    ...Platform.select({
      web: {
        background: 'linear-gradient(90deg, transparent, rgba(110, 231, 183, 0.3), transparent)',
      } as any,
    }),
  },
  sidebar: {
    height: '100%',
    paddingVertical: 24,
    borderRightWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(10, 12, 18, 0.25)',
    ...Platform.select({
      web: {
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
      } as any,
    }),
  },
  pinButton: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  brandContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoBadge: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.25)',
  },
  brandTitle: {
    color: '#F5FAF7',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    color: '#6B7280',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 20,
  },
  navMenu: {
    flex: 1,
    gap: 6,
  },
  sectionTitleWrapper: {
    marginTop: 18,
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  sectionTitle: {
    color: '#4B5563',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 2,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    position: 'relative',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  navItemActive: {
    backgroundColor: 'rgba(110, 231, 183, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.15)',
  },
  navIcon: {
    marginRight: 12,
  },
  navLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    fontWeight: '600',
  },
  navLabelActive: {
    color: '#6EE7B7',
    fontWeight: '700',
  },
  activeDot: {
    position: 'absolute',
    right: 14,
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#6EE7B7',
  },
  sidebarProfile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 12,
    marginTop: 20,
  },
  sidebarAvatar: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(110, 231, 183, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.2)',
  },
  profileTextContainer: {
    flex: 1,
  },
  profileName: {
    color: '#F9FAFB',
    fontSize: 13,
    fontWeight: '700',
  },
  profileRole: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '500',
    marginTop: 1,
  },
  contentArea: {
    flex: 1,
    height: '100%',
    backgroundColor: 'transparent',
  },
  contentHeader: {
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 32,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 20, 28, 0.4)',
  },
  contentHeaderTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '800',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    ...Platform.select({
      web: {
        transition: 'all 0.2s ease',
      } as any,
    }),
  },
  contentWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  innerContent: {
    flex: 1,
    ...Platform.select({
      web: {
        animation: 'fadeIn 0.3s ease-out forwards',
        height: '100%',
        overflowY: 'auto',
      } as any,
      default: {
        height: '100%',
      },
    }),
  },
});

// Registrar estilos globales en CSS para Web
if (Platform.OS === 'web' && typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .hover-glow:hover {
      box-shadow: 0 0 20px rgba(110, 231, 183, 0.15) !important;
      border-color: rgba(110, 231, 183, 0.3) !important;
    }
  `;
  document.head.appendChild(style);
}
