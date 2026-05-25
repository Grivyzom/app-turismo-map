import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* 
          Add any additional <head> elements here, such as custom fonts or scripts.
          The Google Identity script is required for Google Sign-In on Web.
        */}
        <script src="https://accounts.google.com/gsi/client" async defer></script>

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
