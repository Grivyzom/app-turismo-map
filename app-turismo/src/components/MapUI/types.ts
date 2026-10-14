export type TabType =
  | 'map'
  | 'feed'
  | 'eventos'
  | 'saved'
  | 'historial'
  | 'forum'
  | 'settings'
  | 'profile';

// Modo de contenido del mapa (qué pines/información se muestran), independiente del activeTab
export type MapDisplayMode = 'mapa' | 'turismo' | 'comercial';

export interface TopAppBarProps {
  currentTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  notificationsCount?: number;
  onNotificationClick?: () => void;
  isNotificationsOpen?: boolean;
  onVoiceSearch?: (query: any) => void;
  onVoicePartialSearch?: (text: string) => void;
  onSearchFocus?: () => void;
  onSearchClick?: () => void;
  onAccountClick?: () => void;
  mapDisplayMode?: MapDisplayMode;
  onMapDisplayModeChange?: (mode: MapDisplayMode) => void;
  viewMode?: 'local' | 'tourist';
  onToggleViewMode?: () => void;
  showFilters?: boolean;
  onFiltersClick?: () => void;
  // Posición medida del botón correspondiente en el navbar, para anclar
  // el menú/panel justo debajo de él (en vez de una posición fija).
  onFiltersAnchorChange?: (pos: { top: number; left: number }) => void;
  onNotificationsAnchorChange?: (pos: { top: number; left: number }) => void;
}

export interface NavLinkProps {
  icon: string;
  label?: string;
  active?: boolean;
  onClick?: () => void;
}
