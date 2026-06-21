import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
  Platform,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useUserLocationContext } from '../../context/UserLocationContext';

interface Sector {
  id: number;
  name: string;
  color?: string;
  category?: string;
  geojson?: any;
}

interface SectorConfigPanelProps {
  sectors: Sector[];
  visibleSectorIds: number[];
  onToggleSector: (id: number) => void;
  showSectors: boolean;
  onToggleAll: (active: boolean) => void;
  onClose: () => void;
  isDevMode?: boolean;
}

const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3; // metres
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; 
};

const isPointInPolygon = (point: [number, number], vs: [number, number][]) => {
  let x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    let xi = vs[i][0], yi = vs[i][1];
    let xj = vs[j][0], yj = vs[j][1];
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const getPolygonCoords = (geojson: any): [number, number][] | null => {
  if (!geojson) return null;
  if (geojson.type === 'Polygon' && geojson.coordinates?.length > 0) {
    return geojson.coordinates[0];
  } else if (geojson.type === 'MultiPolygon' && geojson.coordinates?.length > 0) {
    return geojson.coordinates[0][0];
  }
  return null;
};

const getSectorCenter = (coords: [number, number][]): [number, number] => {
  if (!coords || coords.length === 0) return [0, 0];
  let sumLon = 0, sumLat = 0;
  coords.forEach(c => {
    sumLon += c[0];
    sumLat += c[1];
  });
  return [sumLon / coords.length, sumLat / coords.length];
};

export const SectorConfigPanel: React.FC<SectorConfigPanelProps> = ({
  sectors,
  visibleSectorIds,
  onToggleSector,
  showSectors,
  onToggleAll,
  onClose,
  isDevMode = false,
}) => {
  const { userLocation } = useUserLocationContext();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState('');

  const toggleGroup = (group: string) => {
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const filteredAndSearchedSectors = useMemo(() => {
    let list = sectors.filter((s) => {
      if (isDevMode) return true;
      const cat = s.category ? s.category.toLowerCase().trim() : '';
      return cat === 'urbano';
    });

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [sectors, isDevMode, searchQuery]);

  const devGroups = useMemo(() => {
    const groups: Record<string, Sector[]> = {};
    if (isDevMode) {
      filteredAndSearchedSectors.forEach((sector) => {
        const category = sector.category ? sector.category.toLowerCase().trim() : 'otros';
        if (!groups[category]) groups[category] = [];
        groups[category].push(sector);
      });
    }
    return groups;
  }, [filteredAndSearchedSectors, isDevMode]);

  const citizenSectors = useMemo(() => {
    if (isDevMode) return [];
    const withDistance = filteredAndSearchedSectors.map(sector => {
        let distance = Infinity;
        let isInside = false;
        if (sector.geojson && userLocation) {
          const coords = getPolygonCoords(sector.geojson);
          if (coords) {
             isInside = isPointInPolygon([userLocation.longitude, userLocation.latitude], coords);
             const center = getSectorCenter(coords);
             distance = getDistance(userLocation.latitude, userLocation.longitude, center[1], center[0]);
          }
        }
        return { ...sector, distance, isInside };
    });
    
    withDistance.sort((a, b) => {
      if (a.isInside && !b.isInside) return -1;
      if (!a.isInside && b.isInside) return 1;
      return a.distance - b.distance;
    });
    
    return withDistance;
  }, [filteredAndSearchedSectors, isDevMode, userLocation]);

  return (
    <View style={styles.overlayContainer}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
      
      <View style={styles.islandContainer}>
        <View style={styles.glowBorderTop} />
        
        <View style={styles.contentHeader}>
          <View style={styles.headerTitleContainer}>
            <View style={styles.logoBadge}>
              <MaterialIcons name="layers" size={20} color="#6EE7B7" />
            </View>
            <Text style={styles.contentHeaderTitle}>{isDevMode ? 'Configurar Capas' : 'Sectores Urbanos'}</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.8}>
            <MaterialIcons name="close" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentArea}>
          
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={20} color="#9CA3AF" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar sector..."
              placeholderTextColor="#6B7280"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.masterRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <MaterialIcons name={showSectors ? "visibility" : "visibility-off"} size={20} color={showSectors ? "#6EE7B7" : "#9CA3AF"} />
              <Text style={styles.masterLabel}>Mostrar Capa de Sectores</Text>
            </View>
            <Switch
              value={showSectors}
              onValueChange={onToggleAll}
              trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: 'rgba(110, 231, 183, 0.3)' }}
              thumbColor={showSectors ? '#6EE7B7' : '#9CA3AF'}
            />
          </View>

          <View style={styles.divider} />

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {isDevMode ? (
              Object.entries(devGroups).map(([groupName, groupSectors]) => {
                const isExpanded = expandedGroups[groupName] || false;
                const displayName = groupName === 'otros' ? 'Otros' : groupName;
                return (
                  <View key={groupName} style={styles.groupContainer}>
                    <TouchableOpacity 
                      style={[styles.groupHeader, isExpanded && styles.groupHeaderActive]} 
                      onPress={() => toggleGroup(groupName)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.groupTitle}>
                        {displayName} <Text style={styles.groupCount}>({groupSectors.length})</Text>
                      </Text>
                      <MaterialIcons 
                        name={isExpanded ? 'expand-less' : 'expand-more'} 
                        size={20} 
                        color="#9CA3AF" 
                      />
                    </TouchableOpacity>

                    {isExpanded && (
                      <View style={styles.groupContent}>
                        {groupSectors.map((sector) => {
                          const isVisible = visibleSectorIds.includes(sector.id);
                          return (
                            <View key={sector.id} style={[styles.sectorRow, !showSectors && { opacity: 0.5 }]}>
                              <View style={styles.sectorInfo}>
                                <View style={[styles.colorBadge, { backgroundColor: sector.color || '#6EE7B7' }]} />
                                <Text style={styles.sectorName}>{sector.name}</Text>
                              </View>
                              <Switch
                                value={isVisible}
                                disabled={!showSectors}
                                onValueChange={() => onToggleSector(sector.id)}
                                trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: 'rgba(110, 231, 183, 0.3)' }}
                                thumbColor={isVisible && showSectors ? '#6EE7B7' : '#9CA3AF'}
                              />
                            </View>
                          );
                        })}
                      </View>
                    )}
                  </View>
                );
              })
            ) : (
              citizenSectors.map((sector: any) => {
                const isVisible = visibleSectorIds.includes(sector.id);
                return (
                  <View key={sector.id} style={[styles.sectorRow, !showSectors && { opacity: 0.5 }]}>
                    <View style={styles.sectorInfo}>
                      <View style={[styles.colorBadge, { backgroundColor: sector.color || '#6EE7B7' }]} />
                      <View>
                        <Text style={styles.sectorName}>{sector.name}</Text>
                        <Text style={styles.sectorDistance}>
                          {sector.isInside ? 'Estás aquí' : sector.distance !== Infinity ? `A ${(sector.distance / 1000).toFixed(1)} km` : ''}
                        </Text>
                      </View>
                    </View>
                    <Switch
                      value={isVisible}
                      disabled={!showSectors}
                      onValueChange={() => onToggleSector(sector.id)}
                      trackColor={{ false: 'rgba(255, 255, 255, 0.1)', true: 'rgba(110, 231, 183, 0.3)' }}
                      thumbColor={isVisible && showSectors ? '#6EE7B7' : '#9CA3AF'}
                    />
                  </View>
                );
              })
            )}
            
            {filteredAndSearchedSectors.length === 0 && (
              <Text style={styles.emptyText}>{searchQuery ? 'No se encontraron resultados' : 'Cargando sectores...'}</Text>
            )}
          </ScrollView>

          <TouchableOpacity style={styles.doneButton} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.doneButtonText}>Aceptar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  overlayContainer: {
    ...StyleSheet.absoluteFill,
    zIndex: 1000,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  islandContainer: {
    width: '90%',
    maxWidth: 420,
    maxHeight: '85%',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    ...Platform.select({
      web: {
        backgroundColor: 'rgba(15, 20, 28, 0.88)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0px 8px 32px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
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
  contentHeader: {
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    borderBottomWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(15, 20, 28, 0.4)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.25)',
  },
  contentHeaderTitle: {
    color: '#F9FAFB',
    fontSize: 18,
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
  },
  contentArea: {
    padding: 24,
    flexShrink: 1,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  searchInput: {
    flex: 1,
    height: 40,
    color: '#F9FAFB',
    fontSize: 14,
    marginLeft: 8,
  },
  masterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 8,
  },
  masterLabel: {
    color: '#F9FAFB',
    fontSize: 15,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 12,
  },
  list: {
    flexShrink: 1,
  },
  groupContainer: {
    marginBottom: 8,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  groupHeaderActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  groupTitle: {
    color: '#D1D5DB',
    fontSize: 14,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  groupCount: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: 'normal',
  },
  groupContent: {
    paddingLeft: 8,
    marginTop: 4,
    paddingBottom: 8,
  },
  sectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  sectorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  colorBadge: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  sectorName: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
  },
  sectorDistance: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
    fontSize: 14,
  },
  doneButton: {
    backgroundColor: 'rgba(110, 231, 183, 0.12)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
    borderWidth: 1,
    borderColor: 'rgba(110, 231, 183, 0.3)',
  },
  doneButtonText: {
    color: '#6EE7B7',
    fontSize: 15,
    fontWeight: '700',
  },
});

