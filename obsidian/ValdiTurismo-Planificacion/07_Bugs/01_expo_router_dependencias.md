# 🐛 Bug: Fallo de Ruteo en Expo (Dependencias Faltantes)

## 📌 Síntomas
- Los cambios realizados en las pantallas de Expo (por ejemplo, `app/(home)/index.tsx`) no se veían reflejados en el navegador web. Parecía cargar código "fantasma" o antiguo.
- Al cambiar el punto de entrada en `package.json` de `"index.ts"` a `"expo-router/entry"`, la aplicación lanzaba de inmediato un error masivo al intentar compilar:
  ```text
  Unable to resolve "expo-web-browser" from "app\login.tsx"
  PluginError: Failed to resolve plugin for module "@react-native-google-signin/google-signin" relative to "..."
  ```

## 🔍 Causa Raíz
El proyecto tenía su `"main"` configurado hacia `"index.ts"` (el cual usaba el antiguo archivo monolítico `App.tsx`) ignorando toda la estructura de carpetas `app/` propia de Expo Router.
Al intentar forzar el enrutamiento para que Expo Router tomara el control (`"main": "expo-router/entry"`), Expo analizó y armó todas las rutas del directorio `app/`. Durante este nivel, escaneó el entorno en `app/login.tsx`, el cual requería las siguientes librerías que **no estaban instaladas** en el proyecto:
- `@react-native-google-signin/google-signin`
- `expo-web-browser`

Como las importaciones de estos paquetes y sus plugins de configuración asociados estaban ausentes, la construcción de Metro Bundler (el servidor de desarrollo) colapsó. 

## ✅ Solución Implementada
1. Se aseguró que `package.json` mantenga el punto de entrada correcto para las arquitecturas modernas de Expo:
   ```json
   "main": "expo-router/entry",
   ```
2. Se instalaron las dependencias faltantes usando el gestor de paquetes de nuestro ecosistema (`pnpm`), dirigidos propiamente a la carpeta `app-turismo/`:
   ```bash
   pnpm add @react-native-google-signin/google-signin expo-web-browser
   ```
3. Para asegurar que Metro superara los archivos corruptos, se detuvo todo proceso node que consumiera memoria previamente y se levantó la aplicación limpiando el entorno de caché:
   ```bash
   pnpm start --clear --web
   ```