export type TabType = 'map' | 'feed' | 'saved' | 'forum' | 'settings' | 'profile';

export interface TopAppBarProps {
  currentTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  onSearchClick?: () => void;
  onAccountClick?: () => void;
  notificationsCount?: number;
  onNotificationClick?: () => void;
  onVoiceSearch?: (query: any) => void;
  onVoicePartialSearch?: (text: string) => void;
  isModalOpen?: boolean;
  forceSidebarVisible?: boolean;
  onSearchFocus?: () => void;
}

export interface NavLinkProps {
  icon: string;
  label?: string;
  active?: boolean;
  onClick?: () => void;
}
