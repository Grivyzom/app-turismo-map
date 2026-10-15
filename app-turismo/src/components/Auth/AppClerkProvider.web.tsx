import React from 'react';
import { ClerkProvider } from '@clerk/react';

export function AppClerkProvider({
  publishableKey,
  children,
}: {
  publishableKey: string;
  children: React.ReactNode;
}) {
  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}
