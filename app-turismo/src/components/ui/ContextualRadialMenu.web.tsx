import React, { useState, useEffect, useRef, useId } from 'react';
import { Planet } from 'react-planet';

import { radialMenuRegistry } from '../../utils/radialMenuRegistry';

import { ContextualRadialMenuProps } from './ContextualRadialMenu.types';

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContextualRadialMenu({
  children,
  items,
  buttonSize = 24,
  offset = 8,
  startAngle: propStartAngle,
  endAngle: propEndAngle,
  isSelected: propIsSelected,
  onSelectionChange,
  trigger = 'both',
  menuId: propMenuId,
}: ContextualRadialMenuProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [internalSelected, setInternalSelected] = useState(false);
  const [angles, setAngles] = useState({ startAngle: 190, endAngle: 350 });

  // Stable unique ID for the registry (use React 18 useId or a UUID fallback)
  const reactId = useId();
  const menuId = useRef(propMenuId ?? reactId).current;

  const isControlled = propIsSelected !== undefined;
  const isSelected = isControlled ? propIsSelected : internalSelected;

  const setIsSelected = (val: boolean) => {
    if (!isControlled) setInternalSelected(val);
    if (onSelectionChange) onSelectionChange(val);
  };

  // ---------------------------------------------------------------------------
  // Registry: close this menu when another one opens
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const unsub = radialMenuRegistry.subscribe((openId) => {
      if (openId !== menuId && openId !== null) {
        // Another menu just opened — close ours
        if (!isControlled) setInternalSelected(false);
        if (onSelectionChange) onSelectionChange(false);
      }
    });
    return unsub;
  }, [menuId, isControlled, onSelectionChange]);

  // ---------------------------------------------------------------------------
  // ResizeObserver: keep dimensions fresh
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!wrapperRef.current) return;
    const target = wrapperRef.current.firstElementChild ?? wrapperRef.current;

    const update = () => {
      const rect = target.getBoundingClientRect();
      setDimensions({ width: rect.width, height: rect.height });
    };
    update();

    const ro = new ResizeObserver(update);
    ro.observe(target);
    return () => ro.disconnect();
  }, [children]);

  // ---------------------------------------------------------------------------
  // Angle Arc: default to top semicircle unless overridden
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isSelected || !wrapperRef.current) return;

    // Use manual overrides when provided, otherwise default to upper semicircle
    if (propStartAngle !== undefined && propEndAngle !== undefined) {
      setAngles({ startAngle: propStartAngle, endAngle: propEndAngle });
    } else {
      setAngles({ startAngle: 190, endAngle: 350 });
    }
  }, [isSelected, propStartAngle, propEndAngle]);

  // ---------------------------------------------------------------------------
  // Click-outside
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!isSelected) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsSelected(false);
        radialMenuRegistry.close(menuId);
      }
    };
    const timer = setTimeout(() => document.addEventListener('click', handleDocumentClick), 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [isSelected]);

  // ---------------------------------------------------------------------------
  // Hover close timeout
  // ---------------------------------------------------------------------------
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearClose = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  useEffect(() => () => clearClose(), []);

  // ---------------------------------------------------------------------------
  // Geometry
  // ---------------------------------------------------------------------------
  const { width: W, height: H } = dimensions;

  // Orbit radius: half the pin diameter + gap offset
  const r = Math.max(W, H) / 2 + buttonSize / 2 + offset;

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------
  const openMenu = () => {
    setIsSelected(true);
    radialMenuRegistry.open(menuId);
  };

  const closeMenu = () => {
    setIsSelected(false);
    radialMenuRegistry.close(menuId);
  };

  const handleToggleOpen = (e: React.MouseEvent) => {
    if (trigger === 'hover') return;
    if ((e.target as HTMLElement).closest('[data-radial-island]')) return;
    if (isSelected) {
      closeMenu();
    } else {
      openMenu();
    }
  };

  const handleMouseEnter = () => {
    clearClose();
    if (trigger === 'hover' || trigger === 'both') openMenu();
  };

  const handleMouseLeave = () => {
    if (trigger === 'hover' || trigger === 'both') {
      clearClose();
      closeTimeoutRef.current = setTimeout(closeMenu, 800);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div
      ref={wrapperRef}
      className="relative inline-block select-none"
      aria-expanded={isSelected}
      onClick={handleToggleOpen}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ cursor: 'pointer' }}
    >
      <Planet
        centerContent={<div className="relative z-10">{children}</div>}
        open={isSelected}
        autoClose={false}
        hideOrbit
        orbitRadius={r}
        bounce
        mass={1}
        tension={500}
        friction={19}
        rotation={angles.startAngle}
      >
        {items.map((item) => (
          <div
            key={item.id}
            data-radial-island
            className="group relative"
            style={{ width: buttonSize, height: buttonSize }}
          >
            {/* Action button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                item.onClick();
                closeMenu();
              }}
              style={{ width: buttonSize, height: buttonSize }}
              className="flex items-center justify-center rounded-full bg-white/90 dark:bg-zinc-800/95 border border-white/40 dark:border-zinc-700/50 shadow-[0_4px_12px_rgba(0,0,0,0.18)] hover:shadow-[0_8px_20px_rgba(0,0,0,0.25)] hover:bg-white dark:hover:bg-zinc-700 transition-all duration-150 active:scale-90 cursor-pointer"
            >
              {item.icon}
            </button>

            {/* Tooltip */}
            {item.tooltip && (
              <span className="absolute left-1/2 -bottom-7 -translate-x-1/2 px-2 py-0.5 rounded bg-zinc-900/90 backdrop-blur-sm text-white text-[10px] font-medium tracking-wide shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-[60] border border-white/10">
                {item.tooltip}
              </span>
            )}
          </div>
        ))}
      </Planet>
    </div>
  );
}
