export type TabType = 'map' | 'feed' | 'saved' | 'forum' | 'settings' | 'profile';

export interface TopAppBarProps {
  currentTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  onSearchClick?: () => void;
  onAccountClick?: () => void;
}

export interface NavLinkProps {
  icon: string;
  label?: string;
  active?: boolean;
  onClick?: () => void;
}
