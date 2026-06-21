import React, { useEffect } from 'react';

import { useUserLocationContext } from '../../context/UserLocationContext';

interface LocationErrorNotifierProps {
  showNotification: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void;
}

export const LocationErrorNotifier: React.FC<LocationErrorNotifierProps> = ({
  showNotification,
}) => {
  const { locationError } = useUserLocationContext();

  useEffect(() => {
    if (locationError) {
      showNotification(`${locationError}`, 'warning');
    }
  }, [locationError, showNotification]);

  return null;
};
