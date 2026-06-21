import React, { createContext, useContext, ReactNode } from 'react';

import { useUserLocation, UserLocation } from '../hooks/useUserLocation';

interface UserLocationContextType {
  userLocation: UserLocation | null;
  locationError: string | null;
  isLoadingLocation: boolean;
  retryLocation: () => void;
}

const UserLocationContext = createContext<UserLocationContextType | undefined>(undefined);

export function UserLocationProvider({ children }: { children: ReactNode }) {
  const locationState = useUserLocation();

  return (
    <UserLocationContext.Provider value={locationState}>{children}</UserLocationContext.Provider>
  );
}

export function useUserLocationContext() {
  const context = useContext(UserLocationContext);
  if (context === undefined) {
    throw new Error('useUserLocationContext must be used within a UserLocationProvider');
  }
  return context;
}
