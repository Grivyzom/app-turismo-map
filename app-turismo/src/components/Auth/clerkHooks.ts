// Nativo: los hooks deben salir de @clerk/expo. Importarlos directo de @clerk/react
// resuelve el build ESM y no ve el contexto del ClerkProvider (CJS) de @clerk/expo.
export { useAuth, useUser, useClerk } from '@clerk/expo';
