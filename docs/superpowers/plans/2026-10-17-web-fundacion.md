# Web Fundación (shell móvil en web) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La web renderiza el shell de la app móvil (`src/mobile/MobileApp`) con rail lateral en escritorio y dock en ancho de teléfono; el mapa web actual queda intacto dentro de la sección Mapa.

**Architecture:** `HomeScreen` renderiza `MobileApp` en todas las plataformas. Un hook `useLayoutMode()` decide `compact`/`wide`; en `wide` el `Shell` muestra `SideRail`, centra las pantallas y abre overlays como panel lateral / diálogo. La sección Mapa resuelve por extensión de plataforma: `MapSection.tsx` (native → `MapaScreen`) y `MapSection.web.tsx` (web → `LegacyWebMap` lazy, el antiguo `WebHomeScreen` movido sin cambios de lógica).

**Tech Stack:** Expo SDK 56, expo-router, React Native Web, TypeScript 6, `node --test` con `--experimental-strip-types` (Node 22) para lógica pura, Playwright Python (`/usr/local/bin/playwright`, módulo `playwright` en python3) para E2E.

**Spec:** `docs/superpowers/specs/2026-10-17-web-fundacion-design.md`

## Global Constraints

- Breakpoint: `wide` solo si `Platform.OS === 'web'` y ancho `>= 768`. Native siempre `compact`.
- Rail: ancho `88`. Contenido de pantallas en `wide`: `maxWidth: 760`, centrado, `paddingTop: 24`, `paddingBottom: 40`.
- Panel lateral de overlays (Clima, Avisos, Evento) en `wide`: `440` de ancho, a la derecha, alto completo, con `Scrim`.
- Diálogo de `BottomSheet`/`OptionSheet` en `wide`: centrado, `maxWidth: 480`, radio `MobileRadii.card`.
- Sección en URL: query param `s` ∈ `inicio|mapa|guia|rutas|perfil`; inválido o ausente → `inicio`. Los demás params se conservan.
- Todos los colores salen de `useColors()` / `src/mobile/theme.ts`; no se agregan colores literales nuevos.
- La app native no debe cambiar visualmente.
- Comentarios y textos de UI en español, mismo estilo que `src/mobile/`.
- Commits terminan con `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

### Desvíos del spec (decididos al planificar; el spec se actualiza en Task 1)

- La URL se sincroniza con `window.history.pushState`/`replaceState` + `popstate` (no `router.setParams`), para que "Atrás" del navegador vuelva a la sección anterior sin remontar la pantalla.
- Un enlace legacy con `?action=create_sector|create_route|create_point` y sin `s` abre la sección Mapa (el legacy lee `action`).
- El rail lleva logo + 5 secciones; `AppHeader` no cambia (avisos y avatar siguen ahí).
- Las constantes de layout viven en `src/mobile/layout.ts` (sin imports, testeable con node), no en `theme.ts`.

## Review Focus

1. **Botón "Atrás" del navegador tras cambiar de sección** → vuelve a la sección anterior, sin salir del sitio. Test: `back_button_restores_section` (Task 3).
2. **Enlaces existentes con otros params (`?action=…`, `?foo=1`)** → el param se conserva al navegar y `?action=` abre Mapa. Tests: `initialSection` unit (Task 1), `action_param_opens_mapa` (Task 2), `url_keeps_other_params` (Task 3).
3. **Redimensionar la ventana cruzando 768px** → no se pierde la sección ni las pantallas montadas; aparece rail o dock según corresponda. Test: `resize_keeps_section` (Task 4).
4. **`Escape` mientras se escribe en la Guía sin nada abierto** → no cambia de sección ni borra el texto. Test: `escape_in_guide_input_is_noop` (Task 6).
5. **Valor de `s` con mayúsculas/espacios (`?s=MAPA`, `?s= rutas`)** → se normaliza a la sección; basura → `inicio`. Tests: unit `parseSection` (Task 1), `invalid_param_falls_back` (Task 3).

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---|---|---|
| `app-turismo/src/mobile/layout.ts` | Crear | Constantes de layout, `Section`, `parseSection`, `initialSection`, `layoutModeFor`, `withSectionParam`. Sin imports. |
| `app-turismo/tests/layout.test.mjs` | Crear | Tests unitarios de `layout.ts` con `node --test`. |
| `app-turismo/src/mobile/hooks/useLayoutMode.ts` | Crear | Hook `useLayoutMode()`. |
| `app-turismo/src/mobile/hooks/useSectionUrlSync.ts` | Crear | Sincroniza `tab` ↔ `?s=` en web. |
| `app-turismo/src/mobile/MobileAppContext.tsx` | Modificar | `MobileTab = Section`; prop `initialTab`. |
| `app-turismo/src/mobile/MobileApp.tsx` | Modificar | Shell responsive, rail/dock, overlays wide, `?auth=`, `Escape`, URL sync. |
| `app-turismo/src/mobile/screens/MapSection.tsx` | Crear | Native: re-exporta `MapaScreen`. |
| `app-turismo/src/mobile/screens/MapSection.web.tsx` | Crear | Web: `LegacyWebMap` lazy con Suspense + ErrorBoundary. |
| `app-turismo/src/web/LegacyWebMap.tsx` | Crear (mover) | El antiguo `WebHomeScreen`, sin `?auth=` ni `<AuthModal />`. |
| `app-turismo/app/(home)/index.tsx` | Reescribir | `HomeScreen` mínimo → `MobileApp`. |
| `app-turismo/src/mobile/components/navItems.tsx` | Crear | Lista de secciones compartida por dock y rail. |
| `app-turismo/src/mobile/components/TabBar.tsx` | Modificar | Usa `NAV_ITEMS`; `testID="tab-bar"`. |
| `app-turismo/src/mobile/components/SideRail.tsx` | Crear | Rail lateral para `wide`. |
| `app-turismo/src/mobile/components/SidePanel.tsx` | Crear | Panel lateral derecho animado para `wide`. |
| `app-turismo/src/mobile/components/Screen.tsx` | Modificar | Columna centrada en `wide`. |
| `app-turismo/src/mobile/screens/GuiaScreen.tsx` | Modificar | Columna centrada en `wide`. |
| `app-turismo/src/mobile/components/BottomSheet.tsx` | Modificar | Diálogo centrado en `wide`. |
| `app-turismo/e2e/web_shell.py` | Crear | Chequeos E2E Playwright del shell web. |
| `app-turismo/package.json` | Modificar | Script `test`. |

## Cómo correr las pruebas

- Unit: `cd app-turismo && pnpm test` (corre `node --experimental-strip-types --test tests/`).
- E2E: en otra terminal `cd app-turismo && pnpm web` (puerto 8082; esperar "Web is waiting on http://localhost:8082"). Luego `cd app-turismo && python3 e2e/web_shell.py <check> [<check> ...]` (sin args corre todos). Sale con código 1 si alguno falla.
- Tipos: `cd app-turismo && npx tsc --noEmit -p .` — comparar contra la línea base del Task 1 (el repo puede tener errores previos; no se aceptan errores **nuevos** en archivos tocados).
- Lint: `cd app-turismo && npx eslint <archivos tocados>`.

---

### Task 1: Lógica pura de layout y sección

**Files:**
- Create: `app-turismo/src/mobile/layout.ts`
- Create: `app-turismo/tests/layout.test.mjs`
- Create: `app-turismo/src/mobile/hooks/useLayoutMode.ts`
- Modify: `app-turismo/package.json` (scripts)
- Modify: `docs/superpowers/specs/2026-10-17-web-fundacion-design.md` (desvíos)

**Interfaces:**
- Produces:
  - `SECTIONS: readonly ['inicio','mapa','guia','rutas','perfil']`
  - `type Section = 'inicio' | 'mapa' | 'guia' | 'rutas' | 'perfil'`
  - `type LayoutMode = 'compact' | 'wide'`
  - `WIDE_BREAKPOINT = 768`, `SIDE_RAIL_WIDTH = 88`, `WIDE_CONTENT_MAX = 760`, `SIDE_PANEL_WIDTH = 440`, `DIALOG_MAX_WIDTH = 480`
  - `layoutModeFor(platform: string, width: number): LayoutMode`
  - `parseSection(value: unknown): Section`
  - `initialSection(params: { s?: unknown; action?: unknown }): Section`
  - `withSectionParam(search: string, section: Section): string` (devuelve `?…`)
  - `useLayoutMode(): LayoutMode`

- [ ] **Step 1: Línea base de tipos**

Run: `cd app-turismo && npx tsc --noEmit -p . > "$CLAUDE_JOB_DIR/tmp/tsc-baseline.txt" 2>&1; wc -l "$CLAUDE_JOB_DIR/tmp/tsc-baseline.txt"`
(Si `$CLAUDE_JOB_DIR` no existe, usar `mktemp -d`.) Guardar el número para comparar al final de cada task.

- [ ] **Step 2: Agregar script de test**

En `app-turismo/package.json`, dentro de `"scripts"`, después de `"format"` agregar:

```json
    "format": "prettier --write \"**/*.{js,jsx,ts,tsx,json,css,md}\"",
    "test": "node --experimental-strip-types --no-warnings --test tests/"
```

- [ ] **Step 3: Escribir tests que fallan**

`app-turismo/tests/layout.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  initialSection,
  layoutModeFor,
  parseSection,
  withSectionParam,
} from '../src/mobile/layout.ts';

test('layoutModeFor: wide solo en web desde 768px', () => {
  assert.equal(layoutModeFor('web', 768), 'wide');
  assert.equal(layoutModeFor('web', 1280), 'wide');
  assert.equal(layoutModeFor('web', 767), 'compact');
  assert.equal(layoutModeFor('android', 1280), 'compact');
  assert.equal(layoutModeFor('ios', 1024), 'compact');
});

test('parseSection: valores válidos, normalizados y basura', () => {
  assert.equal(parseSection('rutas'), 'rutas');
  assert.equal(parseSection('MAPA'), 'mapa');
  assert.equal(parseSection(' guia '), 'guia');
  assert.equal(parseSection(['perfil', 'mapa']), 'perfil');
  assert.equal(parseSection('xyz'), 'inicio');
  assert.equal(parseSection(''), 'inicio');
  assert.equal(parseSection(undefined), 'inicio');
  assert.equal(parseSection(null), 'inicio');
  assert.equal(parseSection(42), 'inicio');
});

test('initialSection: s manda; action legacy abre mapa', () => {
  assert.equal(initialSection({}), 'inicio');
  assert.equal(initialSection({ s: 'rutas' }), 'rutas');
  assert.equal(initialSection({ action: 'create_point' }), 'mapa');
  assert.equal(initialSection({ action: 'create_sector' }), 'mapa');
  assert.equal(initialSection({ action: 'create_route' }), 'mapa');
  assert.equal(initialSection({ s: 'perfil', action: 'create_point' }), 'perfil');
  assert.equal(initialSection({ action: 'otra' }), 'inicio');
});

test('withSectionParam: agrega o reemplaza s y conserva el resto', () => {
  assert.equal(withSectionParam('', 'mapa'), '?s=mapa');
  assert.equal(withSectionParam('?s=inicio', 'rutas'), '?s=rutas');
  assert.equal(withSectionParam('?foo=1', 'guia'), '?foo=1&s=guia');
  assert.equal(withSectionParam('?foo=1&s=mapa&bar=2', 'perfil'), '?foo=1&s=perfil&bar=2');
});
```

- [ ] **Step 4: Verificar que falla**

Run: `cd app-turismo && pnpm test`
Expected: FAIL — `Cannot find module '.../src/mobile/layout.ts'`.

- [ ] **Step 5: Implementar `layout.ts`**

`app-turismo/src/mobile/layout.ts`:

```ts
/**
 * Layout responsive de la experiencia móvil cuando corre en la web.
 *
 * Sin imports a propósito: se prueba directo con `node --test` (ver tests/layout.test.mjs).
 */

/** Secciones de la app, en el orden del dock y del rail. */
export const SECTIONS = ['inicio', 'mapa', 'guia', 'rutas', 'perfil'] as const;
export type Section = (typeof SECTIONS)[number];

export type LayoutMode = 'compact' | 'wide';

/** Desde este ancho (solo web) el dock pasa a ser un rail lateral. */
export const WIDE_BREAKPOINT = 768;
export const SIDE_RAIL_WIDTH = 88;
/** Ancho máximo de la columna de contenido en escritorio. */
export const WIDE_CONTENT_MAX = 760;
/** Panel lateral derecho para Clima, Avisos y Evento en escritorio. */
export const SIDE_PANEL_WIDTH = 440;
/** Ancho máximo de las hojas inferiores cuando se muestran como diálogo. */
export const DIALOG_MAX_WIDTH = 480;

/** Acciones de enlaces antiguos de la web que abren herramientas del mapa. */
const LEGACY_MAP_ACTIONS = ['create_sector', 'create_route', 'create_point'];

export function layoutModeFor(platform: string, width: number): LayoutMode {
  return platform === 'web' && width >= WIDE_BREAKPOINT ? 'wide' : 'compact';
}

function first(value: unknown): unknown {
  return Array.isArray(value) ? value[0] : value;
}

/** `?s=` → sección. Ignora mayúsculas y espacios; cualquier otra cosa vuelve al Inicio. */
export function parseSection(value: unknown): Section {
  const raw = first(value);
  if (typeof raw !== 'string') return 'inicio';
  const key = raw.trim().toLowerCase();
  return (SECTIONS as readonly string[]).includes(key) ? (key as Section) : 'inicio';
}

/** Sección con la que arranca la web según la URL de entrada. */
export function initialSection(params: { s?: unknown; action?: unknown }): Section {
  if (first(params.s) !== undefined) return parseSection(params.s);
  const action = first(params.action);
  if (typeof action === 'string' && LEGACY_MAP_ACTIONS.includes(action)) return 'mapa';
  return 'inicio';
}

/** Query string con `s` actualizado, conservando el resto de los params y su orden. */
export function withSectionParam(search: string, section: Section): string {
  const params = new URLSearchParams(search);
  params.set('s', section);
  return `?${params.toString()}`;
}
```

- [ ] **Step 6: Verificar que pasa**

Run: `cd app-turismo && pnpm test`
Expected: PASS, 4 tests.

- [ ] **Step 7: Hook `useLayoutMode`**

`app-turismo/src/mobile/hooks/useLayoutMode.ts`:

```ts
import { Platform, useWindowDimensions } from 'react-native';

import { layoutModeFor, LayoutMode } from '../layout';

/** `wide` en la web de escritorio (rail lateral, contenido centrado); `compact` en el resto. */
export function useLayoutMode(): LayoutMode {
  const { width } = useWindowDimensions();
  return layoutModeFor(Platform.OS, width);
}
```

- [ ] **Step 8: Actualizar el spec con los desvíos**

En `docs/superpowers/specs/2026-10-17-web-fundacion-design.md`:
- Sección 2: reemplazar "Constante `WIDE_BREAKPOINT = 768` y `SIDE_RAIL_WIDTH = 88` en `src/mobile/theme.ts`." por "Constantes de layout en `src/mobile/layout.ts` (sin imports, testeable con node)."
- Sección 3: reemplazar el bullet "avatar + avisos (con `BadgeDot`) al fondo del rail." por "sin avatar ni avisos: siguen en `AppHeader`."
- Sección 4: reemplazar "usando `router.setParams` de expo-router; al montar se lee el param inicial." por "con `history.pushState` (primera sincronización con `replaceState`) y `popstate`, para que Atrás vuelva a la sección anterior; al montar se lee el param inicial. Un `?action=create_*` legacy sin `s` abre Mapa."
- Sección 5: borrar el bullet de `AppHeader` en `wide`.

- [ ] **Step 9: Lint y commit**

Run: `cd app-turismo && npx eslint src/mobile/layout.ts src/mobile/hooks/useLayoutMode.ts`
Expected: sin errores.

```bash
git add app-turismo/src/mobile/layout.ts app-turismo/src/mobile/hooks/useLayoutMode.ts app-turismo/tests/layout.test.mjs app-turismo/package.json docs/superpowers/specs/2026-10-17-web-fundacion-design.md
git commit -m "feat(mobile): lógica de layout responsive y sección en URL

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Web renderiza `MobileApp`; mapa legacy en la sección Mapa

**Files:**
- Create: `app-turismo/src/web/LegacyWebMap.tsx` (copia de `app/(home)/index.tsx`, editada)
- Rewrite: `app-turismo/app/(home)/index.tsx`
- Create: `app-turismo/src/mobile/screens/MapSection.tsx`
- Create: `app-turismo/src/mobile/screens/MapSection.web.tsx`
- Modify: `app-turismo/src/mobile/MobileAppContext.tsx`
- Modify: `app-turismo/src/mobile/MobileApp.tsx`
- Create: `app-turismo/e2e/web_shell.py`

**Interfaces:**
- Consumes: `Section`, `initialSection` (Task 1).
- Produces:
  - `MobileTab` = `Section` (re-exportado desde `MobileAppContext`).
  - `MobileAppProvider({ children, initialTab?: MobileTab })`.
  - `default function MobileApp({ initialTab }: { initialTab?: MobileTab })`.
  - `default function LegacyWebMap()` en `src/web/LegacyWebMap.tsx`.
  - `MapSection` (named export) en `src/mobile/screens/MapSection(.web).tsx`.
  - testIDs: `app-shell` (raíz del Shell), `section-<key>` / `section-<key>-active` (wrapper de cada pantalla montada).
  - E2E: `e2e/web_shell.py` con helpers `open_page(browser, viewport, query='')`, `active_section(page) -> str`, decorador `@check`, constantes `WIDE`, `COMPACT`.

- [ ] **Step 1: Escribir el script E2E con los primeros chequeos**

`app-turismo/e2e/web_shell.py`:

```python
"""Chequeos E2E del shell web (spec 2026-10-17-web-fundacion).

Requiere `pnpm web` corriendo en :8082.
Uso: python3 e2e/web_shell.py [check ...]   (sin args corre todos)
"""
import re
import sys

from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8082/'
WIDE = {'width': 1280, 'height': 800}
COMPACT = {'width': 390, 'height': 844}
TIMEOUT = 90_000

CHECKS = {}


def check(fn):
    CHECKS[fn.__name__] = fn
    return fn


def open_page(browser, viewport, query=''):
    page = browser.new_page(viewport=viewport)
    page.set_default_timeout(TIMEOUT)
    page.goto(BASE + query)
    page.wait_for_selector('[data-testid="app-shell"]')
    return page


def active_section(page):
    el = page.wait_for_selector('[data-testid$="-active"][data-testid^="section-"]')
    return el.get_attribute('data-testid').removeprefix('section-').removesuffix('-active')


def expect_section(page, key):
    page.wait_for_selector(f'[data-testid="section-{key}-active"]')
    assert active_section(page) == key, f'sección activa {active_section(page)!r}, esperaba {key!r}'


def search_param(page, name):
    m = re.search(rf'[?&]{name}=([^&#]*)', page.url)
    return m.group(1) if m else None


@check
def shell_renders_on_web(browser):
    page = open_page(browser, WIDE)
    expect_section(page, 'inicio')


@check
def mapa_param_loads_legacy(browser):
    page = open_page(browser, WIDE, '?s=mapa')
    expect_section(page, 'mapa')
    page.wait_for_selector('[data-testid="section-mapa-active"] canvas')


@check
def action_param_opens_mapa(browser):
    page = open_page(browser, WIDE, '?action=create_point')
    expect_section(page, 'mapa')


@check
def auth_param_opens_modal(browser):
    page = open_page(browser, WIDE, '?auth=login')
    page.wait_for_selector('[aria-label="Cerrar modal de autenticación"]')
    assert len(page.query_selector_all('[aria-label="Cerrar modal de autenticación"]')) == 1, \
        'hay más de un AuthModal abierto'


def main(names):
    selected = names or list(CHECKS)
    failed = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for name in selected:
            try:
                CHECKS[name](browser)
                print(f'PASS {name}')
            except Exception as e:  # noqa: BLE001 — reportar y seguir con el resto
                failed.append(name)
                print(f'FAIL {name}: {e}')
        browser.close()
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main(sys.argv[1:])
```

- [ ] **Step 2: Verificar que falla**

Levantar `pnpm web` (ver "Cómo correr las pruebas").
Run: `cd app-turismo && python3 e2e/web_shell.py shell_renders_on_web mapa_param_loads_legacy action_param_opens_mapa auth_param_opens_modal`
Expected: FAIL en los 4 (timeout esperando `app-shell`; la web todavía renderiza `WebHomeScreen`).

- [ ] **Step 3: Mover `WebHomeScreen` a `LegacyWebMap.tsx`**

```bash
cd app-turismo
mkdir -p src/web
cp "app/(home)/index.tsx" src/web/LegacyWebMap.tsx
sed -i "s#'\.\./\.\./src/#'../#g" src/web/LegacyWebMap.tsx
grep -n "'\.\./\.\./" src/web/LegacyWebMap.tsx   # debe quedar solo la línea del require de MobileApp
```

Luego editar `src/web/LegacyWebMap.tsx` a mano:
1. Borrar el bloque completo que empieza en `// Vista móvil nativa (Android / iOS). Con require + Platform.OS…` hasta el cierre de `export default function HomeScreen() { … }` (las constantes `MobileApp` y la función `HomeScreen`).
2. Cambiar `function WebHomeScreen() {` por:
   ```tsx
   /**
    * Mapa web original (tema Selva Glass) movido tal cual desde app/(home)/index.tsx.
    * Vive dentro de la sección Mapa del shell; el re-tema es el sub-proyecto 2.
    */
   export default function LegacyWebMap() {
   ```
3. Borrar el efecto de `?auth=` (el `useEffect` que compara `params.auth === 'login' || params.auth === 'register'`, incluyendo `router.setParams({ auth: undefined })`). El shell lo maneja ahora. **Conservar** `const params = useLocalSearchParams();` (lo usa el efecto de `params.action`).
4. Borrar `{/* ━━━ MODAL DE AUTENTICACIÓN … */}` y la línea `<AuthModal />`, y el `import { AuthModal } from '../components/Auth/AuthModal';` (el shell ya renderiza uno; dos modales abrirían duplicado).
5. Correr `npx eslint src/web/LegacyWebMap.tsx` y quitar de los imports solo lo que el lint marque como no usado por estos borrados (p. ej. `router`, `Platform` si quedaron sin uso). No tocar nada más.

- [ ] **Step 4: `MapSection` por plataforma**

`app-turismo/src/mobile/screens/MapSection.tsx`:

```tsx
/** Sección Mapa en Android / iOS: el mapa móvil con MapLibre. */
export { MapaScreen as MapSection } from './MapaScreen';
```

`app-turismo/src/mobile/screens/MapSection.web.tsx`:

```tsx
import React, { Suspense } from 'react';

import { GlobalErrorBoundary } from '../../components/ui/GlobalErrorBoundary';
import { LoadingFallback } from '../../components/ui/LoadingFallback';
import { lazyWithRetry } from '../../utils/lazyWithRetry';

const LegacyWebMap = lazyWithRetry(() => import('../../web/LegacyWebMap'));

/**
 * Sección Mapa en la web: el mapa web completo de siempre (filtros, rutas, colecciones…),
 * cargado aparte para no pesar en el Inicio. Su re-tema es el sub-proyecto 2.
 */
export function MapSection() {
  return (
    <GlobalErrorBoundary>
      <Suspense fallback={<LoadingFallback />}>
        <LegacyWebMap />
      </Suspense>
    </GlobalErrorBoundary>
  );
}
```

- [ ] **Step 5: `initialTab` en el contexto**

En `app-turismo/src/mobile/MobileAppContext.tsx`:

Agregar import:
```tsx
import type { Section } from './layout';
```
Reemplazar:
```tsx
export type MobileTab = 'inicio' | 'mapa' | 'guia' | 'rutas' | 'perfil';
```
por:
```tsx
export type MobileTab = Section;
```
Reemplazar la firma del provider y el estado inicial:
```tsx
export function MobileAppProvider({
  children,
  initialTab = 'inicio',
}: {
  children: React.ReactNode;
  /** Sección de arranque (en la web sale de `?s=`). */
  initialTab?: MobileTab;
}) {
```
```tsx
  const [tab, setTab] = useState<MobileTab>(initialTab);
```

- [ ] **Step 6: Shell — Mapa por plataforma, `?auth=`, testIDs**

En `app-turismo/src/mobile/MobileApp.tsx`:

Imports: cambiar `import React, { useEffect, useState } from 'react';` por
```tsx
import React, { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
```
agregar
```tsx
import { useAuth } from '../context/AuthContext';
```
reemplazar `import { MapaScreen } from './screens/MapaScreen';` por
```tsx
import { MapSection } from './screens/MapSection';
```
y en `SCREENS` cambiar `mapa: MapaScreen,` por `mapa: MapSection,`.

Dentro de `Shell()`, después de `const colors = useColors();`:
```tsx
  // Enlaces `?auth=login|register` (p. ej. desde el onboarding) abren el modal de acceso
  const { isAuthenticated, openAuthModal } = useAuth();
  const { auth } = useLocalSearchParams<{ auth?: string }>();
  useEffect(() => {
    if (auth !== 'login' && auth !== 'register') return;
    if (!isAuthenticated) openAuthModal(auth);
    router.setParams({ auth: undefined });
  }, [auth, isAuthenticated, openAuthModal]);
```

En el JSX: la raíz `<View style={[styles.root, …]}>` recibe `testID="app-shell"`, y el wrapper de cada pantalla montada:
```tsx
          <View
            key={key}
            testID={visible ? `section-${key}-active` : `section-${key}`}
            style={[StyleSheet.absoluteFill, !visible && styles.hidden]}
            pointerEvents={visible ? 'auto' : 'none'}
          >
```

Cambiar el export:
```tsx
/** Experiencia móvil: Inicio, Mapa, Guía, Rutas y Perfil (Android, iOS y web). */
export default function MobileApp({ initialTab }: { initialTab?: MobileTab }) {
  return (
    <MobileAppProvider initialTab={initialTab}>
      <Shell />
    </MobileAppProvider>
  );
}
```

Y el estado inicial de montadas debe incluir la sección de arranque:
```tsx
  const [mounted, setMounted] = useState<Set<MobileTab>>(() => new Set<MobileTab>([tab]));
```

- [ ] **Step 7: `HomeScreen` mínimo**

Reemplazar todo `app-turismo/app/(home)/index.tsx` por:

```tsx
import React, { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

import MobileApp from '../../src/mobile/MobileApp';
import { initialSection } from '../../src/mobile/layout';

/** Inicio de la app en todas las plataformas; en la web la sección sale de `?s=`. */
export default function HomeScreen() {
  const params = useLocalSearchParams<{ s?: string; action?: string }>();
  // Solo se lee al montar: después la sección vive en el estado del shell
  const [initialTab] = useState(() => initialSection(params));
  return <MobileApp initialTab={initialTab} />;
}
```

- [ ] **Step 8: Verificar**

Run: `cd app-turismo && python3 e2e/web_shell.py shell_renders_on_web mapa_param_loads_legacy action_param_opens_mapa auth_param_opens_modal`
Expected: PASS los 4. (En esta fase el dock móvil aparece también en escritorio; es esperado hasta Task 4.)

Run: `cd app-turismo && npx tsc --noEmit -p . 2>&1 | wc -l` → no mayor a la línea base; revisar con `npx tsc --noEmit -p . 2>&1 | grep -E "src/mobile|src/web|app/\(home\)"` que no haya errores nuevos en archivos tocados.
Run: `cd app-turismo && npx eslint "app/(home)/index.tsx" src/mobile/MobileApp.tsx src/mobile/MobileAppContext.tsx src/mobile/screens/MapSection.tsx src/mobile/screens/MapSection.web.tsx src/web/LegacyWebMap.tsx`
Expected: sin errores nuevos.

- [ ] **Step 9: Commit**

```bash
git add app-turismo/app/\(home\)/index.tsx app-turismo/src/web/LegacyWebMap.tsx app-turismo/src/mobile/screens/MapSection.tsx app-turismo/src/mobile/screens/MapSection.web.tsx app-turismo/src/mobile/MobileApp.tsx app-turismo/src/mobile/MobileAppContext.tsx app-turismo/e2e/web_shell.py
git commit -m "feat(web): la web usa el shell móvil; mapa web legacy en la sección Mapa

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Sección ↔ URL con historial

**Files:**
- Create: `app-turismo/src/mobile/hooks/useSectionUrlSync.ts`
- Modify: `app-turismo/src/mobile/MobileApp.tsx`
- Modify: `app-turismo/e2e/web_shell.py`

**Interfaces:**
- Consumes: `parseSection`, `withSectionParam`, `Section` (Task 1); `useMobileApp().tab/setTab`.
- Produces: `useSectionUrlSync(tab: Section, setTab: (tab: Section) => void): void`.

- [ ] **Step 1: Chequeos E2E que fallan**

Agregar a `app-turismo/e2e/web_shell.py` (antes de `def main`):

```python
def click_section(page, label):
    """Navega con el dock o el rail, el que esté visible."""
    page.get_by_role('tab', name=label, exact=True).first.click()


@check
def url_tracks_section(browser):
    page = open_page(browser, COMPACT)
    page.wait_for_function("new URLSearchParams(location.search).get('s') === 'inicio'")
    click_section(page, 'Rutas')
    expect_section(page, 'rutas')
    page.wait_for_function("new URLSearchParams(location.search).get('s') === 'rutas'")


@check
def back_button_restores_section(browser):
    page = open_page(browser, COMPACT)
    click_section(page, 'Rutas')
    expect_section(page, 'rutas')
    click_section(page, 'Perfil')
    expect_section(page, 'perfil')
    page.go_back()
    expect_section(page, 'rutas')
    page.go_back()
    expect_section(page, 'inicio')


@check
def url_keeps_other_params(browser):
    page = open_page(browser, COMPACT, '?foo=1')
    click_section(page, 'Rutas')
    page.wait_for_function("new URLSearchParams(location.search).get('s') === 'rutas'")
    assert search_param(page, 'foo') == '1', f'se perdió foo: {page.url}'


@check
def invalid_param_falls_back(browser):
    page = open_page(browser, COMPACT, '?s=xyz')
    expect_section(page, 'inicio')
    page = open_page(browser, COMPACT, '?s=RUTAS')
    expect_section(page, 'rutas')


@check
def reload_keeps_section(browser):
    page = open_page(browser, COMPACT)
    click_section(page, 'Perfil')
    page.wait_for_function("new URLSearchParams(location.search).get('s') === 'perfil'")
    page.reload()
    page.wait_for_selector('[data-testid="app-shell"]')
    expect_section(page, 'perfil')
```

Run: `cd app-turismo && python3 e2e/web_shell.py url_tracks_section back_button_restores_section url_keeps_other_params invalid_param_falls_back reload_keeps_section`
Expected: FAIL `url_tracks_section`, `back_button_restores_section`, `url_keeps_other_params`, `reload_keeps_section` (la URL no cambia). `invalid_param_falls_back` ya pasa (lo cubre Task 2).

- [ ] **Step 2: Implementar el hook**

`app-turismo/src/mobile/hooks/useSectionUrlSync.ts`:

```ts
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { parseSection, Section, withSectionParam } from '../layout';

function currentParam() {
  return new URLSearchParams(window.location.search).get('s');
}

/**
 * Web: refleja la sección en `?s=` para que recargar o compartir el enlace la conserve.
 * Cada cambio apila una entrada de historial, así "Atrás" vuelve a la sección anterior
 * sin remontar nada (es la misma pantalla de expo-router). En native no hace nada.
 */
export function useSectionUrlSync(tab: Section, setTab: (tab: Section) => void) {
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onPop = () => setTab(parseSection(currentParam()));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [setTab]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const current = currentParam();
    if (current === tab) return;
    const url = `${window.location.pathname}${withSectionParam(window.location.search, tab)}${window.location.hash}`;
    // Al entrar sin `s` o con un valor no canónico (`xyz`, `RUTAS`) se corrige sin crear historial
    const method = current === null || !isSection(current) ? 'replaceState' : 'pushState';
    window.history[method](window.history.state, '', url);
  }, [tab]);
}

/** ¿El valor ya es una sección escrita tal cual (minúsculas, sin espacios)? */
function isSection(value: string) {
  return parseSection(value) === value;
}
```

- [ ] **Step 3: Usarlo en el Shell**

En `app-turismo/src/mobile/MobileApp.tsx` agregar el import:
```tsx
import { useSectionUrlSync } from './hooks/useSectionUrlSync';
```
y dentro de `Shell()`, después del efecto de `?auth=`:
```tsx
  useSectionUrlSync(tab, setTab);
```

- [ ] **Step 4: Verificar**

Run: `cd app-turismo && python3 e2e/web_shell.py url_tracks_section back_button_restores_section url_keeps_other_params invalid_param_falls_back reload_keeps_section shell_renders_on_web mapa_param_loads_legacy`
Expected: PASS todos.

Si `back_button_restores_section` falla porque expo-router reacciona al `popstate` remontando la pantalla (síntoma: vuelve a `inicio` siempre), detenerse y reportar: es un desvío de diseño, no se parchea a ciegas.

Run: `npx eslint src/mobile/hooks/useSectionUrlSync.ts src/mobile/MobileApp.tsx` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add app-turismo/src/mobile/hooks/useSectionUrlSync.ts app-turismo/src/mobile/MobileApp.tsx app-turismo/e2e/web_shell.py
git commit -m "feat(web): sección en ?s= con historial del navegador

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Rail lateral en escritorio

**Files:**
- Create: `app-turismo/src/mobile/components/navItems.tsx`
- Create: `app-turismo/src/mobile/components/SideRail.tsx`
- Modify: `app-turismo/src/mobile/components/TabBar.tsx`
- Modify: `app-turismo/src/mobile/MobileApp.tsx`
- Modify: `app-turismo/e2e/web_shell.py`

**Interfaces:**
- Consumes: `useLayoutMode()`, `SIDE_RAIL_WIDTH` (Task 1); `useMobileApp()`.
- Produces:
  - `NAV_ITEMS: NavItem[]`, `type NavItem = { key: MobileTab; label: string; render: (color: string) => React.ReactNode }` (Guía con `render` que devuelve `null`).
  - `SideRail()` con `testID="side-rail"`; ítems con `accessibilityRole="tab"` y `accessibilityLabel` = label.
  - `TabBar` raíz con `testID="tab-bar"`.

- [ ] **Step 1: Chequeos E2E que fallan**

Agregar a `e2e/web_shell.py`:

```python
def count(page, testid):
    return len(page.query_selector_all(f'[data-testid="{testid}"]'))


@check
def rail_on_wide_dock_on_compact(browser):
    page = open_page(browser, WIDE)
    page.wait_for_selector('[data-testid="side-rail"]')
    assert count(page, 'tab-bar') == 0, 'el dock no debe verse en escritorio'
    box = page.query_selector('[data-testid="side-rail"]').bounding_box()
    assert box['x'] == 0 and abs(box['width'] - 88) <= 1, f'rail mal ubicado: {box}'
    for label, key in [('Mapa', 'mapa'), ('Guía', 'guia'), ('Rutas', 'rutas'), ('Perfil', 'perfil'), ('Inicio', 'inicio')]:
        click_section(page, label)
        expect_section(page, key)

    page = open_page(browser, COMPACT)
    page.wait_for_selector('[data-testid="tab-bar"]')
    assert count(page, 'side-rail') == 0, 'el rail no debe verse en ancho de teléfono'


@check
def content_starts_after_rail(browser):
    page = open_page(browser, WIDE)
    box = page.wait_for_selector('[data-testid="section-inicio-active"]').bounding_box()
    assert abs(box['x'] - 88) <= 1, f'el contenido debe empezar después del rail: {box}'


@check
def resize_keeps_section(browser):
    page = open_page(browser, WIDE)
    click_section(page, 'Rutas')
    expect_section(page, 'rutas')
    page.set_viewport_size(COMPACT)
    page.wait_for_selector('[data-testid="tab-bar"]')
    expect_section(page, 'rutas')
    page.set_viewport_size(WIDE)
    page.wait_for_selector('[data-testid="side-rail"]')
    expect_section(page, 'rutas')
```

Run: `python3 e2e/web_shell.py rail_on_wide_dock_on_compact content_starts_after_rail resize_keeps_section`
Expected: FAIL los 3 (no existe `side-rail`).

- [ ] **Step 2: Extraer `NAV_ITEMS`**

`app-turismo/src/mobile/components/navItems.tsx`:

```tsx
import React from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

import type { MobileTab } from '../MobileAppContext';

export type NavItem = { key: MobileTab; label: string; render: (color: string) => React.ReactNode };

/** Secciones del dock (teléfono) y del rail (escritorio). La Guía se dibuja aparte, destacada. */
export const NAV_ITEMS: NavItem[] = [
  {
    key: 'inicio',
    label: 'Inicio',
    render: (c) => <Ionicons name="home-outline" size={22} color={c} />,
  },
  {
    key: 'mapa',
    label: 'Mapa',
    render: (c) => <Ionicons name="map-outline" size={22} color={c} />,
  },
  { key: 'guia', label: 'Guía', render: () => null },
  {
    key: 'rutas',
    label: 'Rutas',
    render: (c) => <MaterialIcons name="route" size={22} color={c} />,
  },
  {
    key: 'perfil',
    label: 'Perfil',
    render: (c) => <Ionicons name="person-outline" size={22} color={c} />,
  },
];
```

En `TabBar.tsx`: borrar `type TabDef` y `const TABS` completos, borrar los imports de `MaterialIcons` y el tipo `MobileTab` si quedan sin uso, agregar `import { NAV_ITEMS } from './navItems';`, cambiar `{TABS.map((t) => {` por `{NAV_ITEMS.map((t) => {`, y agregar `testID="tab-bar"` al `<View pointerEvents="box-none" style={[styles.wrapper, …]}>` raíz.

- [ ] **Step 3: `SideRail`**

`app-turismo/src/mobile/components/SideRail.tsx`:

```tsx
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { MobileTab, useMobileApp } from '../MobileAppContext';
import { SIDE_RAIL_WIDTH } from '../layout';
import { dockShadow, MobileRadii } from '../theme';

import { NAV_ITEMS } from './navItems';
import { T, useColors } from './ui';

/** Rail lateral de escritorio: mismo menú que el dock, con la Guía destacada en negro. */
export function SideRail() {
  const { tab, setTab, setOverlay } = useMobileApp();
  const colors = useColors();

  const go = (key: MobileTab) => {
    setOverlay(null);
    setTab(key);
  };

  return (
    <View
      testID="side-rail"
      style={[styles.rail, { backgroundColor: colors.surface, borderRightColor: colors.border }, dockShadow]}
    >
      <Image
        source={require('../../../assets/favicon.png')}
        style={styles.logo}
        accessibilityLabel="ValdiTurismo"
      />
      <View style={styles.items}>
        {NAV_ITEMS.map((t) => {
          const active = tab === t.key;
          const color = active ? colors.text : colors.textSecondary;
          const guide = t.key === 'guia';
          return (
            <Pressable
              key={t.key}
              onPress={() => go(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={t.label}
            >
              <View
                style={[
                  styles.item,
                  active && !guide && { backgroundColor: colors.surfaceMuted },
                ]}
              >
                {guide ? (
                  <View style={[styles.guide, { backgroundColor: colors.accent }]}>
                    <Ionicons name="sparkles" size={20} color={colors.onAccent} />
                  </View>
                ) : (
                  t.render(color)
                )}
                <T
                  variant="caption"
                  weight={active || guide ? '700' : '400'}
                  color={guide ? colors.text : color}
                  style={{ marginTop: 4 }}
                >
                  {t.label}
                </T>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    width: SIDE_RAIL_WIDTH,
    height: '100%',
    alignItems: 'center',
    paddingTop: 20,
    borderRightWidth: StyleSheet.hairlineWidth,
    zIndex: 10,
  },
  logo: { width: 36, height: 36, borderRadius: 10, marginBottom: 28 },
  items: { gap: 8, alignItems: 'center' },
  item: {
    width: 72,
    minHeight: 64,
    borderRadius: MobileRadii.inner,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  guide: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 4: Shell en dos columnas**

En `app-turismo/src/mobile/MobileApp.tsx`:

Imports:
```tsx
import { SideRail } from './components/SideRail';
import { useLayoutMode } from './hooks/useLayoutMode';
```
Dentro de `Shell()`:
```tsx
  const wide = useLayoutMode() === 'wide';
```
Reestructurar el `return` así (lo demás igual):

```tsx
  return (
    <View
      testID="app-shell"
      style={[styles.root, wide && styles.rootWide, { backgroundColor: colors.background }]}
    >
      <StatusBar style="dark" />
      {wide ? <SideRail /> : null}

      <View style={styles.content}>
        {[...mounted].map((key) => {
          /* …igual que antes… */
        })}

        {overlay ? (
          <View style={StyleSheet.absoluteFill}>
            {overlay === 'clima' ? <ClimaScreen /> : <AvisosScreen />}
          </View>
        ) : null}

        {wide ? null : <TabBar />}

        {/* Ficha de evento: cubre también el dock, tiene su propia barra de acciones */}
        <EventOverlay />
      </View>

      <OptionSheet /* …igual… */ />

      <AuthModal />
    </View>
  );
```

y en `styles`:
```tsx
const styles = StyleSheet.create({
  root: { flex: 1 },
  rootWide: { flexDirection: 'row' },
  content: { flex: 1, position: 'relative' },
  hidden: { opacity: 0, zIndex: -1 },
});
```

- [ ] **Step 5: Verificar**

Run: `python3 e2e/web_shell.py rail_on_wide_dock_on_compact content_starts_after_rail resize_keeps_section back_button_restores_section mapa_param_loads_legacy`
Expected: PASS todos.

Abrir `http://localhost:8082/` a 1280px y a 390px y mirar: rail blanco a la izquierda, Guía círculo negro; en 390px el dock de siempre. Capturas:
`python3 -c "from playwright.sync_api import sync_playwright as s; p=s().start(); b=p.chromium.launch(); pg=b.new_page(viewport={'width':1280,'height':800}); pg.goto('http://localhost:8082/'); pg.wait_for_selector('[data-testid=side-rail]'); pg.wait_for_timeout(1500); pg.screenshot(path='$CLAUDE_JOB_DIR/tmp/rail.png'); b.close(); p.stop()"` y revisar la imagen.

Run: `npx eslint src/mobile/components/navItems.tsx src/mobile/components/SideRail.tsx src/mobile/components/TabBar.tsx src/mobile/MobileApp.tsx` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add app-turismo/src/mobile/components/navItems.tsx app-turismo/src/mobile/components/SideRail.tsx app-turismo/src/mobile/components/TabBar.tsx app-turismo/src/mobile/MobileApp.tsx app-turismo/e2e/web_shell.py
git commit -m "feat(web): rail lateral en escritorio, dock en ancho de teléfono

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Pantallas en columna centrada

**Files:**
- Modify: `app-turismo/src/mobile/components/Screen.tsx`
- Modify: `app-turismo/src/mobile/screens/GuiaScreen.tsx`
- Modify: `app-turismo/e2e/web_shell.py`

**Interfaces:**
- Consumes: `useLayoutMode()`, `WIDE_CONTENT_MAX` (Task 1).
- Produces: testIDs `screen-scroll` (ScrollView de `Screen`) y `guia-scroll` (ScrollView de Guía).

- [ ] **Step 1: Chequeos E2E que fallan**

```python
def content_box(page, section, scroll_testid):
    sel = f'[data-testid="section-{section}-active"] [data-testid="{scroll_testid}"] > div'
    return page.wait_for_selector(sel).bounding_box()


@check
def screens_centered_on_wide(browser):
    page = open_page(browser, WIDE)
    area_x, area_w = 88, WIDE['width'] - 88
    for label, key, scroll in [('Inicio', 'inicio', 'screen-scroll'), ('Rutas', 'rutas', 'screen-scroll'),
                               ('Perfil', 'perfil', 'screen-scroll'), ('Guía', 'guia', 'guia-scroll')]:
        click_section(page, label)
        expect_section(page, key)
        box = content_box(page, key, scroll)
        assert box['width'] <= 761, f'{key}: columna de {box["width"]}px, máx 760'
        center = box['x'] + box['width'] / 2
        assert abs(center - (area_x + area_w / 2)) <= 2, f'{key}: columna no centrada ({box})'


@check
def screens_full_width_on_compact(browser):
    page = open_page(browser, COMPACT)
    box = content_box(page, 'inicio', 'screen-scroll')
    assert abs(box['width'] - COMPACT['width']) <= 1, f'en teléfono el contenido usa todo el ancho: {box}'
```

Run: `python3 e2e/web_shell.py screens_centered_on_wide screens_full_width_on_compact`
Expected: FAIL ambos (no existe `screen-scroll`).

- [ ] **Step 2: `Screen` responsive**

En `app-turismo/src/mobile/components/Screen.tsx`:

Imports:
```tsx
import { useLayoutMode } from '../hooks/useLayoutMode';
import { WIDE_CONTENT_MAX } from '../layout';
```
Dentro del componente:
```tsx
  const wide = useLayoutMode() === 'wide';
```
Reemplazar el `<ScrollView … contentContainerStyle={{…}}` por:
```tsx
      <ScrollView
        testID="screen-scroll"
        contentContainerStyle={[
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 40,
            paddingHorizontal: MobileSpacing.screen,
            gap: MobileSpacing.gap,
          },
          // Escritorio: columna centrada y sin el hueco del dock (la navegación va en el rail)
          wide && styles.wide,
        ]}
```
y en `styles`:
```tsx
  wide: {
    width: '100%',
    maxWidth: WIDE_CONTENT_MAX,
    alignSelf: 'center',
    paddingTop: 24,
    paddingBottom: 40,
  },
```

- [ ] **Step 3: Guía responsive**

En `app-turismo/src/mobile/screens/GuiaScreen.tsx`:

Imports:
```tsx
import { useLayoutMode } from '../hooks/useLayoutMode';
import { WIDE_CONTENT_MAX } from '../layout';
```
Dentro de `GuiaScreen()`:
```tsx
  const wide = useLayoutMode() === 'wide';
```
- Cabecera: `<View style={[styles.header, { paddingTop: insets.top + 8 }]}>` → `<View style={[styles.header, { paddingTop: insets.top + 8 }, wide && styles.column, wide && { paddingTop: 24 }]}>`
- ScrollView: agregar `testID="guia-scroll"` y cambiar `contentContainerStyle={{ padding: MobileSpacing.screen, gap: 12 }}` por `contentContainerStyle={[{ padding: MobileSpacing.screen, gap: 12 }, wide && styles.column]}`
- Compositor: el `<View style={{ paddingHorizontal: …, paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 30, paddingTop: 8 }}>` → 
```tsx
      <View
        style={[
          {
            paddingHorizontal: MobileSpacing.screen,
            paddingBottom: wide ? 24 : insets.bottom + TAB_BAR_HEIGHT + 30,
            paddingTop: 8,
          },
          wide && styles.column,
        ]}
      >
```
- En `styles`: `column: { width: '100%', maxWidth: WIDE_CONTENT_MAX, alignSelf: 'center' },`

- [ ] **Step 4: Verificar**

Run: `python3 e2e/web_shell.py screens_centered_on_wide screens_full_width_on_compact rail_on_wide_dock_on_compact`
Expected: PASS.
Captura a 1280px de Inicio y Guía (mismo one-liner de Task 4, `?s=guia`) y revisar: columna centrada, sin hueco grande abajo.
Run: `npx eslint src/mobile/components/Screen.tsx src/mobile/screens/GuiaScreen.tsx` → sin errores.

- [ ] **Step 5: Commit**

```bash
git add app-turismo/src/mobile/components/Screen.tsx app-turismo/src/mobile/screens/GuiaScreen.tsx app-turismo/e2e/web_shell.py
git commit -m "feat(web): pantallas en columna centrada de 760px en escritorio

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Overlays como panel lateral, hojas como diálogo, `Escape`

**Files:**
- Create: `app-turismo/src/mobile/components/SidePanel.tsx`
- Modify: `app-turismo/src/mobile/components/BottomSheet.tsx`
- Modify: `app-turismo/src/mobile/MobileApp.tsx`
- Modify: `app-turismo/e2e/web_shell.py`

**Interfaces:**
- Consumes: `usePresence`, `Scrim` (de `BottomSheet.tsx`), `useLayoutMode`, `SIDE_PANEL_WIDTH`, `DIALOG_MAX_WIDTH`; `EventoScreen` (export existente en `screens/EventoScreen.tsx`), `ClimaScreen`, `AvisosScreen`.
- Produces:
  - `SidePanel<T>({ item: T | null; onClose: () => void; testID?: string; children: (item: T) => React.ReactNode })`.
  - testIDs `side-panel` (overlays), `event-panel` (evento), `sheet` (contenedor de `BottomSheet` en ambos modos).

- [ ] **Step 1: Chequeos E2E que fallan**

```python
def open_avisos(page):
    page.locator('[aria-label^="Avisos"]').first.click()


@check
def overlay_is_side_panel_on_wide(browser):
    page = open_page(browser, WIDE)
    open_avisos(page)
    box = page.wait_for_selector('[data-testid="side-panel"]').bounding_box()
    assert abs(box['width'] - 440) <= 1, f'panel de {box["width"]}px'
    assert abs(box['x'] + box['width'] - WIDE['width']) <= 1, f'panel no pegado a la derecha: {box}'
    page.keyboard.press('Escape')
    page.wait_for_selector('[data-testid="side-panel"]', state='detached')
    open_avisos(page)
    page.wait_for_selector('[data-testid="side-panel"]')
    page.mouse.click(400, 400)  # scrim
    page.wait_for_selector('[data-testid="side-panel"]', state='detached')
    expect_section(page, 'inicio')


@check
def overlay_fullscreen_on_compact(browser):
    page = open_page(browser, COMPACT)
    open_avisos(page)
    page.wait_for_timeout(600)
    assert count(page, 'side-panel') == 0, 'en teléfono el overlay es pantalla completa'


@check
def sector_sheet_is_dialog_on_wide(browser):
    page = open_page(browser, WIDE)
    page.locator('[aria-label^="Sector"]').first.click()
    box = page.wait_for_selector('[data-testid="sheet"]').bounding_box()
    assert box['width'] <= 481, f'diálogo de {box["width"]}px'
    assert abs(box['x'] + box['width'] / 2 - WIDE['width'] / 2) <= 2, f'diálogo no centrado: {box}'
    assert box['y'] + box['height'] < WIDE['height'] - 8, f'diálogo pegado abajo: {box}'
    page.keyboard.press('Escape')
    page.wait_for_selector('[data-testid="sheet"]', state='detached')


@check
def escape_in_guide_input_is_noop(browser):
    page = open_page(browser, WIDE, '?s=guia')
    expect_section(page, 'guia')
    box = page.locator('[data-testid="section-guia-active"] [aria-label="Pregunta para la guía"]')
    box.fill('museos cerca')
    box.press('Escape')
    expect_section(page, 'guia')
    assert box.input_value() == 'museos cerca', 'Escape borró el texto'
```

Run: `python3 e2e/web_shell.py overlay_is_side_panel_on_wide overlay_fullscreen_on_compact sector_sheet_is_dialog_on_wide escape_in_guide_input_is_noop`
Expected: FAIL `overlay_is_side_panel_on_wide` y `sector_sheet_is_dialog_on_wide`; los otros dos pueden pasar ya (son de regresión).

- [ ] **Step 2: `SidePanel`**

`app-turismo/src/mobile/components/SidePanel.tsx`:

```tsx
import React, { useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';

import { SIDE_PANEL_WIDTH } from '../layout';
import { dockShadow } from '../theme';

import { Scrim, usePresence } from './BottomSheet';
import { useColors } from './ui';

/**
 * Panel lateral derecho de escritorio (Clima, Avisos, Evento). Entra deslizando con un
 * fundido del fondo y conserva el último contenido mientras sale, para que cerrar se vea.
 */
export function SidePanel<T>({
  item,
  onClose,
  testID,
  children,
}: {
  item: T | null;
  onClose: () => void;
  testID?: string;
  children: (item: T) => React.ReactNode;
}) {
  const colors = useColors();
  const [last, setLast] = useState<T | null>(item);
  if (item !== null && item !== last) setLast(item);
  const { progress, mounted } = usePresence(item !== null);

  if (!mounted || last === null) return null;
  const translateX = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [SIDE_PANEL_WIDTH, 0],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents={item !== null ? 'auto' : 'none'}>
      <Scrim progress={progress} onPress={onClose} />
      <Animated.View
        testID={testID}
        style={[
          styles.panel,
          { backgroundColor: colors.background, transform: [{ translateX }] },
          dockShadow,
        ]}
      >
        {children(last)}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: SIDE_PANEL_WIDTH,
    maxWidth: '100%',
    overflow: 'hidden',
  },
});
```

- [ ] **Step 3: `BottomSheet` como diálogo en escritorio**

En `app-turismo/src/mobile/components/BottomSheet.tsx`:

Imports:
```tsx
import { useLayoutMode } from '../hooks/useLayoutMode';
import { DIALOG_MAX_WIDTH } from '../layout';
```
Dentro de `BottomSheet`:
```tsx
  const wide = useLayoutMode() === 'wide';
```
Reemplazar `translateY`:
```tsx
  // Teléfono: sube desde abajo. Escritorio: diálogo centrado que aparece con un leve desplazamiento
  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: wide ? [16, 0] : [height, 0],
  });
```
Reemplazar el bloque interior del `Modal`:
```tsx
      <View style={wide ? styles.rootWide : styles.root}>
        <Scrim progress={progress} onPress={onClose} />
        <Animated.View
          testID="sheet"
          onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
          style={[
            wide ? styles.dialog : styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: wide ? 16 : insets.bottom + 16,
              transform: [{ translateY }],
            },
            wide && { opacity: progress },
          ]}
        >
          {wide ? null : (
            <View style={[styles.grabber, { backgroundColor: colors.borderStrong }]} />
          )}
          {title ? (
            <T variant="title" weight="700" style={styles.title} accessibilityRole="header">
              {title}
            </T>
          ) : null}
          {children}
        </Animated.View>
      </View>
```
En `styles` agregar:
```tsx
  rootWide: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  dialog: {
    width: '100%',
    maxWidth: DIALOG_MAX_WIDTH,
    borderRadius: MobileRadii.card,
    paddingHorizontal: MobileSpacing.screen,
    paddingTop: 16,
  },
```

- [ ] **Step 4: Shell — overlays en panel y `Escape`**

En `app-turismo/src/mobile/MobileApp.tsx`:

Imports:
```tsx
import { Platform } from 'react-native';   // sumar a la import existente de 'react-native'
import { SidePanel } from './components/SidePanel';
import { EventOverlay, EventoScreen } from './screens/EventoScreen';
```
(reemplaza `import { EventOverlay } from './screens/EventoScreen';`)

Del `useAuth()` del Task 2, sumar `isAuthModalOpen`:
```tsx
  const { isAuthenticated, isAuthModalOpen, openAuthModal } = useAuth();
```

Reemplazar el efecto del `BackHandler` por una función compartida + dos efectos:

```tsx
  // Cierra la capa de más arriba (selector → evento → overlay). Devuelve si cerró algo.
  const closeTopLayer = React.useCallback(() => {
    if (sectorPickerOpen) {
      setSectorPickerOpen(false);
      return true;
    }
    if (eventDetail) {
      closeEvent();
      return true;
    }
    if (overlay) {
      setOverlay(null);
      return true;
    }
    return false;
  }, [sectorPickerOpen, eventDetail, overlay, setSectorPickerOpen, closeEvent, setOverlay]);

  // Botón "atrás" de Android: cierra capas y vuelve al Inicio antes de salir
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (closeTopLayer()) return true;
      if (tab !== 'inicio') {
        setTab('inicio');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [closeTopLayer, tab, setTab]);

  // Web: Escape cierra la capa de más arriba (el modal de acceso maneja su propio cierre)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || isAuthModalOpen) return;
      if (closeTopLayer()) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [closeTopLayer, isAuthModalOpen]);
```

En el JSX, dentro de `<View style={styles.content}>`, reemplazar el bloque de overlay y `EventOverlay` por:

```tsx
        {!wide && overlay ? (
          <View style={StyleSheet.absoluteFill}>
            {overlay === 'clima' ? <ClimaScreen /> : <AvisosScreen />}
          </View>
        ) : null}

        {wide ? null : <TabBar />}

        {/* Ficha de evento: cubre también el dock, tiene su propia barra de acciones */}
        {wide ? null : <EventOverlay />}
```

y justo después de cerrar `</View>` de `content` (antes de `<OptionSheet`):

```tsx
      {wide ? (
        <>
          <SidePanel item={overlay} onClose={() => setOverlay(null)} testID="side-panel">
            {(o) => (o === 'clima' ? <ClimaScreen /> : <AvisosScreen />)}
          </SidePanel>
          <SidePanel item={eventDetail} onClose={closeEvent} testID="event-panel">
            {(ev) => <EventoScreen key={ev.id} event={ev} />}
          </SidePanel>
        </>
      ) : null}
```

- [ ] **Step 5: Verificar**

Run: `python3 e2e/web_shell.py` (todos)
Expected: PASS todos los chequeos.

Capturas a 1280px: Avisos abierto (panel derecho) y selector de sector (diálogo). Abrir un evento desde Inicio a mano y verificar que la ficha se ve bien en 440px y que su barra de acciones no queda cortada; si queda cortada, ajustar solo estilos de `EventoScreen` que dependan del ancho de ventana (no hay `useWindowDimensions` en `EventoScreen`, solo en `EventOverlay`).

Run: `npx eslint src/mobile/components/SidePanel.tsx src/mobile/components/BottomSheet.tsx src/mobile/MobileApp.tsx` → sin errores.

- [ ] **Step 6: Commit**

```bash
git add app-turismo/src/mobile/components/SidePanel.tsx app-turismo/src/mobile/components/BottomSheet.tsx app-turismo/src/mobile/MobileApp.tsx app-turismo/e2e/web_shell.py
git commit -m "feat(web): overlays en panel lateral, hojas como diálogo y Escape

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: Verificación final (native intacto)

**Files:** ninguno nuevo (solo correcciones si algo falla).

- [ ] **Step 1: Unit + E2E completos**

Run: `cd app-turismo && pnpm test && python3 e2e/web_shell.py`
Expected: todo PASS.

- [ ] **Step 2: Tipos y lint**

Run: `cd app-turismo && npx tsc --noEmit -p . 2>&1 | wc -l` → no mayor a la línea base de Task 1.
Run: `cd app-turismo && npx eslint "app/(home)/index.tsx" src/mobile src/web` → sin errores nuevos.

- [ ] **Step 3: Bundle Android compila sin el legacy web**

Run: `cd app-turismo && npx expo export --platform android --output-dir "$CLAUDE_JOB_DIR/tmp/export-android" 2>&1 | tail -20`
Expected: export exitoso.
Run: `grep -rl "LegacyWebMap" "$CLAUDE_JOB_DIR/tmp/export-android" | head`
Expected: sin resultados (el native usa `MapSection.tsx` → `MapaScreen`).

- [ ] **Step 4: Native sin cambios visuales**

Revisar el diff de los archivos compartidos con native: en `compact`, `Screen`, `GuiaScreen`, `BottomSheet`, `TabBar` y `Shell` deben producir los mismos estilos que antes (todas las ramas nuevas están detrás de `wide`). `git diff main~6 -- app-turismo/src/mobile` y confirmar a ojo.
Si hay emulador disponible (ver memoria `android_build_gotchas`), abrir la app y comparar Inicio y el dock.

- [ ] **Step 5: Commit de correcciones (si hubo)**

```bash
git add -A app-turismo
git commit -m "fix(web): ajustes de verificación final de la fundación

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
