# Web basada en la app móvil — Sub-proyecto 1: Fundación

Fecha: 2026-10-17
Estado: aprobado en conversación, pendiente revisión del spec

## Contexto

La web (`app-turismo/app/(home)/index.tsx` → `WebHomeScreen`) usa el tema oscuro
"Selva Glass" (`src/theme/tokens.ts`): mapa a pantalla completa con islas flotantes.
La app móvil nativa (`app-turismo/src/mobile/`) usa un tema claro minimalista
(`src/mobile/theme.ts`): fondo `#EFEFEF`, tarjetas blancas radio 24, acento `#141414`,
dock inferior con 5 secciones (Inicio, Mapa, Guía, Rutas, Perfil) y overlays
(Clima, Avisos, Evento).

## Objetivo general (3 sub-proyectos)

La web adopta el lenguaje visual **y** la estructura de la app móvil, adaptada a
escritorio con un rail lateral. Ninguna función exclusiva de la web se pierde: se
reubica en la sección que corresponda.

1. **Fundación** (este spec): shell compartido, rail/dock, URL, pantallas móviles
   reusadas y responsive.
2. **Mapa**: re-tematizar el mapa web a claro y reubicar funciones exclusivas
   (RouterHUD, filtros, colecciones, galería, check-in, encuestas).
3. **Pulido**: dark mode, herramientas dev/admin, limpieza del legacy.

## Decisiones tomadas

- Alcance: lenguaje visual + estructura.
- Funciones web exclusivas: se conservan todas, reubicadas (sub-proyecto 2).
- Navegación escritorio: rail lateral izquierdo; en ancho chico, dock inferior.
- Enfoque A: un solo shell (`MobileApp`) para web y native; reuso de pantallas.

## Diseño

### 1. Punto de entrada

- `HomeScreen` (`app/(home)/index.tsx`) renderiza `MobileApp` en todas las plataformas.
- `WebHomeScreen` y sus helpers locales se mueven sin cambios de lógica a
  `app-turismo/src/web/LegacyWebMap.tsx` (export default `LegacyWebMap`).
  `app/(home)/index.tsx` queda como un archivo mínimo.
- En el registro de pantallas de `MobileApp.tsx`, la sección `mapa` resuelve a:
  - web: `LegacyWebMap` (cargado con `React.lazy` para no inflar el bundle inicial),
  - native: `MapaScreen` (sin cambios).
  La elección se hace con `Platform.OS` + `require` para que el build native no
  incluya el legacy web, igual que el patrón actual.
- `LegacyWebMap` en esta fase se ve igual que hoy (oscuro, con su barra propia).
  Convivencia visual temporal aceptada; se resuelve en el sub-proyecto 2.

### 2. Modo de layout

- Hook nuevo `useLayoutMode()` en `src/mobile/hooks/useLayoutMode.ts`:
  devuelve `'wide'` si `Platform.OS === 'web'` y `useWindowDimensions().width >= 768`;
  si no, `'compact'`.
- Constantes de layout en `src/mobile/layout.ts` (sin imports, testeable con node).
- Native siempre `compact` → la app móvil no cambia visualmente.

### 3. Navegación

- `compact`: `TabBar` actual (dock inferior), sin cambios.
- `wide`: componente nuevo `src/mobile/components/SideRail.tsx`:
  - columna fija a la izquierda, ancho 88px, alto 100%, fondo `surface`, sombra `dockShadow`;
  - logo/isotipo arriba;
  - 5 ítems (mismo array de pestañas que `TabBar`, extraído a `src/mobile/navigation.tsx`
    para compartirlo): ícono 22px + etiqueta `caption`; activo `text`, inactivo `textSecondary`;
  - Guía como círculo negro (`accent`) destacado, igual que en el dock;
  - sin avatar ni avisos: siguen en `AppHeader`.
- Al elegir sección se hace `setOverlay(null)` + `setTab(key)` (mismo comportamiento que `TabBar`).
- `Shell` en `wide`: fila `[SideRail][contenido flex:1]`; las pantallas montadas se
  posicionan dentro del área de contenido, no sobre el rail.

### 4. URL ↔ sección (solo web)

- `tab` se sincroniza con el query param `s` (`?s=inicio|mapa|guia|rutas|perfil`)
  con `history.pushState` (primera sincronización con `replaceState`) y `popstate`,
  para que Atrás vuelva a la sección anterior; al montar se lee el param inicial.
  Un `?action=create_*` legacy sin `s` abre Mapa.
- Valor inválido o ausente → `inicio`.
- Otros params se conservan. El manejo de `?auth=login|register` (abrir `AuthModal`
  si no hay sesión) se mueve de `WebHomeScreen` al `Shell` en web, porque al entrar
  por Inicio el legacy no está montado. `LegacyWebMap` deja de manejarlo.

### 5. Pantallas y overlays responsive

- `Screen` (`src/mobile/components/Screen.tsx`) en `wide`:
  contenido centrado con `maxWidth: 760`, `width: '100%'`, `alignSelf: 'center'`,
  `paddingTop: 24`, `paddingBottom: 40` (sin reservar el alto del dock).
  Inicio, Rutas, Perfil, Clima y Avisos heredan esto sin tocar su código.
- `GuiaScreen` no usa `Screen` (chat con `KeyboardAvoidingView` + `ScrollView` propio):
  en `wide` se envuelve su cabecera y su lista en un contenedor centrado
  `maxWidth: 760` con el mismo criterio.
- Overlays Clima y Avisos en `wide`: panel lateral derecho de 440px, alto completo,
  con `Scrim` detrás; click en el scrim cierra.
- `EventOverlay` en `wide`: mismo panel lateral derecho de 440px (animación desde
  la derecha con el ancho del panel, no el de la ventana).
- `BottomSheet` / `OptionSheet` en `wide`: diálogo centrado, `maxWidth: 480`,
  radio `card`, mismo `Scrim`.
- Web: tecla `Escape` cierra, en orden, selector de sector → evento → overlay
  (misma prioridad que el `BackHandler` de Android). `BackHandler` sigue igual en native.

### 6. Fuera de alcance

- Re-tema del mapa web y reubicación de sus funciones (sub-proyecto 2).
- Grillas multi-columna en Inicio, dark mode, herramientas dev/admin (sub-proyecto 3).
- Cambios en `admin/` y `business/`.

## Manejo de errores

- Param `s` inválido → `inicio`, sin error.
- Falla al cargar el chunk de `LegacyWebMap` → `GlobalErrorBoundary` existente
  con opción de reintentar.

## Pruebas

- `tsc --noEmit` y lint del paquete `app-turismo`.
- Playwright sobre `pnpm web` a 1280×800 y 390×844:
  - wide: se ve el rail, no el dock; navegar las 5 secciones; `?s=` cambia y
    recargar con `?s=rutas` abre Rutas;
  - abrir/cerrar Clima, Avisos, Evento y selector de sector (click en scrim y `Escape`);
  - compact (390px): se ve el dock, no el rail; layout igual a la app.
- Native: build Android de verificación; Inicio con dock idéntico al actual
  (`useLayoutMode` = `compact`).

## Criterios de éxito

- En escritorio la web muestra la estructura de la app móvil con rail lateral y
  pantallas claras centradas.
- En ancho de teléfono la web se ve como la app.
- La app native no cambia.
- El mapa web legacy sigue funcionando completo dentro de la sección Mapa.
