import { registerRootComponent } from 'expo';
import * as React from 'react';

import App from './App';

// TEMPORAL (diagnóstico): imprime el owner stack real del error
// "Unexpected text node" para localizar el componente que lo causa. Borrar luego.
if (__DEV__) {
  const origError = console.error;
  console.error = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Unexpected text node')) {
      const owner = (React as any).captureOwnerStack?.();
      console.warn('[diag text-node]', JSON.stringify(args[0]), '\nOWNER STACK:', owner);
    }
    origError(...args);
  };
}

registerRootComponent(App);
