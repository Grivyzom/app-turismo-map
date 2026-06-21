import React from 'react';

export interface RadialMenuItem {
  id: string;
  icon: React.ReactNode; // E.g. Ionicons name, text, or a full custom Node
  tooltip: string;
  onClick: () => void;
}

export interface ContextualRadialMenuProps {
  children: React.ReactNode;
  items: RadialMenuItem[];
  /**
   * Diameter of each action button in pixels.
   * Should be ≤ the pin's own diameter to avoid visual overflow.
   * Default: 24px
   */
  buttonSize?: number;
  /**
   * Visual gap between the edge of the target and the center of the action buttons.
   * Default: 8px
   */
  offset?: number;
  /**
   * Manual override for the start angle (degrees).
   * When omitted the component auto-detects the best direction based on viewport position.
   */
  startAngle?: number;
  /**
   * Manual override for the end angle (degrees).
   * When omitted the component auto-detects the best direction based on viewport position.
   */
  endAngle?: number;
  /** Optional controlled visibility state. */
  isSelected?: boolean;
  /** Callback when the open/close state changes. */
  onSelectionChange?: (selected: boolean) => void;
  /** What gesture opens the menu. Default: 'both' */
  trigger?: 'click' | 'hover' | 'both';
  /**
   * Stable unique id for this menu instance.
   * Used by the registry to close all other menus when this one opens.
   * If omitted a random UUID is generated internally.
   */
  menuId?: string;
}
