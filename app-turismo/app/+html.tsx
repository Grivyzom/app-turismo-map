import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Modern Typography Fonts — loaded asynchronously to avoid render-blocking */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* media="print" trick: browser downloads the font in background, then onLoad
            switches it to "all" so it applies without ever blocking the first paint. */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
          rel="stylesheet"
          media="print"
          // @ts-ignore — onLoad is valid on link elements
          onLoad="this.media='all'"
        />
        {/* Fallback for browsers with JS disabled */}
        <noscript>
          <link
            href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=Outfit:wght@300;400;500;600;700;800;900&display=swap"
            rel="stylesheet"
          />
        </noscript>

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
