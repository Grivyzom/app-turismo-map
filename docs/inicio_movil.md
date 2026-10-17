# 🏠 Inicio de la App Móvil: Análisis según la Sesión del Usuario

Este documento analiza la pantalla **Inicio** de la experiencia móvil (`app-turismo/src/mobile/screens/InicioScreen.tsx`) desde un punto de vista: **qué sabe cada componente sobre el usuario que está usando la app**. Para cada uno dice qué componentes conviene **agregar al flujo**, **separar** o **refactorizar**.

> Alcance: el shell móvil (`src/mobile`), que desde [#18](https://github.com/Grivyzom/app-turismo-map/pull/18) se usa en Android, iOS y web. Las líneas citadas corresponden a `main` en el commit `f19c4a1`.

**Motivo:** al instalar el APK, la app **no mostró la bienvenida** (login / registro / invitado) y el Inicio se ve igual para todos, como si ningún componente revisara si el usuario inició sesión.

---

## 1. 🔎 Diagnóstico: por qué no aparece la bienvenida

La bienvenida se muestra cuando se cumple esta condición (`src/mobile/MobileAppContext.tsx:300`):

```ts
showWelcome: !authLoading && !isAuthenticated && !guestDismissed
```

Hay tres caminos que la hacen falsa al abrir la app:

| # | Causa | Dónde | Efecto |
|---|---|---|---|
| A | **Token viejo en AsyncStorage.** Si Clerk cargó y no hay sesión, `AuthContext` lee `auth_token` y marca la sesión como iniciada con `isAuthenticated: !!token`. | `src/context/AuthContext.tsx:220-223`, `src/utils/authStorage.ts` | Un token del backend guardado en un login anterior basta para que la app "crea" que hay sesión, aunque Clerk no tenga ninguna. **Instalar el APK encima de una versión anterior conserva AsyncStorage.** |
| B | **Clerk nunca termina de cargar** (sin red, clave mal configurada en el build release). | `AuthContext.tsx:135` (`if (!isClerkLoaded) return;`), `MobileAppContext.tsx:128,163,299` | `isLoading` queda en `true` para siempre. A los 6 s se quita la pantalla de carga, pero `showWelcome` sigue en `false` y se entra **sin bienvenida**. |
| C | **El APK es anterior a [#17](https://github.com/Grivyzom/app-turismo-map/pull/17).** | `release-apk.sh` compila `main` | La bienvenida no existe en ese build. |

**Cómo confirmar cuál es:**
1. *Ajustes → Apps → app-turismo → Almacenamiento → Borrar datos*, y abrir la app.
   - Si **ahora sí** aparece la bienvenida → causa **A**.
2. Si no aparece y la app tarda unos 6 s en mostrarse → causa **B**. En `adb logcat`, buscar los avisos `[AuthProvider]` o los de Clerk.
3. Si aparece **inmediatamente** sin bienvenida → causa **C**. Recompilar con `./release-apk.sh`.

> **Nota sobre A:** `signIn()` (`AuthContext.tsx:252`) ya no se llama desde ningún lado. Hoy el único login es con Clerk, así que el respaldo de "token guardado = sesión" no tiene un caso de uso real y solo produce este falso positivo.

---

## 2. 🗺️ Mapa del Inicio

Las secciones de `InicioScreen.tsx`, en orden, con la columna que importa aquí: **¿depende de la sesión?**

| Sección (línea) | Datos que usa | ¿Usa la sesión? | Qué ve hoy un invitado |
|---|---|---|---|
| **Header** (`AppHeader.tsx:50`) | `prefs.nick`, `prefs.photoUri`, sector, avisos | ❌ El avatar sale de preferencias **locales** | "Visitante". Igual que un usuario con sesión que no configuró apodo |
| **Saludo + clima** (104) | `prefs.nick` (línea 111), `weather` | ❌ "Hola, {apodo}" local, nunca el nombre de la cuenta | Buenos días / tardes / noches |
| **Aviso de la ciudad** (147) | `weather.alert`, `prefs.dismissedAlert` | No aplica (público) | Igual |
| **Banner de invitado** (171) | `isGuest` | ✅ | "Estás como invitado · Entrar" |
| **Recomendación + Guía** (189) | `recommendedRoute`, `QuestionInput` → `askGuide` | ⚠️ Solo al **enviar** | Puede escribir. Al enviar aparece "Necesitas una cuenta" |
| **Eventos** (209) | `events`, `prefs.savedEventIds` | ⚠️ Guardar está bloqueado, pero lo guardado es **del dispositivo** | Ve los marcadores guardados en el teléfono aunque no tenga cuenta |
| **Categorías** (217) | `QUICK_CATEGORIES` | No aplica | Igual |
| **Alojamiento** (236) | `prefs.lodging` | ❌ "Agregar" (línea 260) lleva a Perfil | Lo manda a Perfil, que está **bloqueado** para él |
| **Ruta recomendada** (264) | `recommendedRoute` | ⚠️ "Iniciar ruta" está bloqueado; "Ajustar" lleva a Perfil | "Ajustar" lo manda a Perfil bloqueado |
| **Cerca de ti** (267) | `places` | No aplica | Igual |
| **Servicios útiles** (281) | `prefs.emergencyContact` | ❌ El contacto solo se configura con cuenta | SOS sin contacto propio |
| **Beneficio de comercio** (313) | `places`, `prefs.notifications.businessBenefits` | No aplica | Igual |

### Por qué la app "se siente fija"

1. **La identidad nunca llega a la UI.** `AuthContext` arma un `NormalUserProfile` con `fullName` y `email` desde Clerk y lo guarda (`AuthContext.tsx:196`), pero **no lo expone**. El header y el saludo solo leen `prefs.nick` y `prefs.photoUri` (AsyncStorage local). Con sesión o sin ella, el Inicio se ve igual.
2. **Guardados y me gusta son del dispositivo.** `prefs.savedEventIds` y `prefs.likedEventIds` (`useMobilePreferences.ts:50-51`) no se ligan a la cuenta, no se sincronizan y no se borran al cerrar sesión. La web ya tiene colecciones en el backend (`src/context/CollectionsContext.tsx`, `src/utils/collectionsApi.ts`).
3. **Los eventos de ejemplo siempre aparecen.** `usePlacesData.ts:144` mezcla siempre `buildDefaultEvents()` con la agenda del backend. Pero el comentario de `defaultEvents.ts:5` dice que solo deberían mostrarse *"mientras la agenda del backend no traiga eventos propios"*.
   - `INITIAL_EVENTS` (`src/data/mockEvents.ts`) es otra cosa: es el catálogo local de lugares (parques, mobiliario, polígonos). Que se mezcle con el backend es correcto.
4. **Para el invitado, varias acciones llevan a un lugar bloqueado.** Alojamiento → "Agregar" y Ruta → "Ajustar" llaman a `setTab('perfil')` directamente (`InicioScreen.tsx:260,265`; también `RutasScreen.tsx:57,62`), en lugar de pasar por `requireAccount`.

---

## 3. 🧭 Propuestas

### P0. Que el estado de sesión sea confiable

Sin esto, el resto de las propuestas no se nota.

| Cambio | Archivo |
|---|---|
| Si Clerk ya cargó y **no** hay sesión: borrar `auth_token` (`clearAuthTokenAsync`) y quedar **sin sesión**. Así se elimina el falso positivo de la causa A. | `src/context/AuthContext.tsx` |
| Exponer `user: { fullName, firstName, email, imageUrl } \| null` en el contexto, tomado de `activeUser` (Clerk), con `NormalUserProfile` como respaldo. | `src/context/AuthContext.tsx` |
| Si vence la espera de 6 s y la sesión sigue sin resolverse, **mostrar la bienvenida igual**, como invitado. Hoy se salta (causa B). | `src/mobile/MobileAppContext.tsx` |

### Agregar al flujo

| Componente / hook | Para qué |
|---|---|
| **`useCurrentUser()`** en `src/mobile/hooks/` | Una sola fuente para `displayName` (nombre de la cuenta → apodo local → "Visitante"), `avatarUrl` (foto de Clerk → foto local), `email` e `isGuest`. Lo usan `AppHeader`, el saludo y `PerfilScreen`. |
| **Avatar con estado** en `AppHeader` | Invitado: ícono de persona y al tocarlo se abre el login. Con sesión: foto e inicial de la cuenta. |
| **Skeleton del Inicio** | Mientras cargan la sesión y los lugares (`loadingPlaces`), en lugar de tarjetas vacías o "--°". |

### Separar en componentes

`InicioScreen.tsx` tiene 387 líneas: unas 225 son de JSX, repartidas en 12 secciones. Conviene separar cada bloque en `src/mobile/sections/`, igual que ya se hace con `RouteCard`, `EventsCarousel`, `MiniMap` y `PlaceRow`. Así cada pieza decide por sí misma qué mostrar según la sesión:

| Componente nuevo | Sale de | Qué decide según la sesión |
|---|---|---|
| `GreetingHeader` | Saludo (104-145) | Usa `useCurrentUser().displayName` |
| `WeatherChip` | Chip de clima (114-144) | — (también lo reutiliza Clima) |
| `CityAlertCard` | Aviso de la ciudad (147-169) | — |
| `GuestBanner` | Banner de invitado (171-187) | Solo se muestra con `isGuest` |
| `GuideCard` | Recomendación + Guía (189-207) | Invitado: input bloqueado con "Inicia sesión para preguntar", en vez de dejar escribir y avisar después |
| `QuickCategoriesCard` | Categorías (217-234) | — |
| `LodgingCard` | Alojamiento (236-262) | Invitado: "Agregar" → `requireAccount('perfil')` |
| `ServicesCard` | Servicios útiles (281-311) | SOS: con sesión usa el contacto propio. Invitado: solo el menú de emergencia |
| `BenefitCard` | Beneficio (313-327) | — |

### Refactorizar

| Cambio | Detalle |
|---|---|
| **Guardados y me gusta ligados a la cuenta** | `toggleSavedEvent` y `toggleLikedEvent` (`MobileAppContext.tsx`) escriben en el backend con `collectionsApi`, como la web. Al cerrar sesión se limpian `savedEventIds` y `likedEventIds` locales. |
| **Eventos de ejemplo solo como respaldo** | En `usePlacesData`, incluir `buildDefaultEvents()` solo si `remote` no trae eventos con banner, como dice su comentario. |
| **Acciones del invitado que llevan a Perfil** | `RouteCard.onAdjust` y "Agregar alojamiento" pasan por `requireAccount('perfil')` (en Inicio y en Rutas). |
| **Preferencias por usuario** | Hoy `useMobilePreferences` guarda todo en una sola clave de AsyncStorage. Separar lo **del dispositivo** (texto, contraste, idioma) de lo **de la cuenta** (alojamiento, contacto, guardados), y que lo de la cuenta se cargue o borre con la sesión. |

---

## 4. 📋 Orden sugerido de implementación

1. ✅ **P0 (hecho):** quitar el token viejo, exponer `user` y mostrar la bienvenida cuando vence la espera. Verificar en el APK con *Borrar datos* y sin borrarlos.
   - `AuthContext` borra `auth_token` cuando Clerk cargó sin sesión y expone `user` (`src/utils/authUser.ts`).
   - La regla de la bienvenida vive en `src/mobile/session.ts` (`shouldShowWelcome`), con tests en `tests/session.test.mjs`.
2. `useCurrentUser()` y su uso en `AppHeader` y en el saludo, para que la sesión **se vea**.
3. Separar `GreetingHeader`, `GuestBanner`, `GuideCard` y `LodgingCard`: son las piezas con lógica de sesión.
4. Redirigir a `requireAccount` las acciones de invitado que hoy llevan a Perfil.
5. Separar el resto de las secciones: `WeatherChip`, `CityAlertCard`, `QuickCategoriesCard`, `ServicesCard`, `BenefitCard`.
6. Guardados y me gusta en el backend, y separación de preferencias de dispositivo y de cuenta.
7. Eventos de ejemplo solo como respaldo.
