#!/usr/bin/env bash
# ==============================================================================
# Script de compilación automatizada del APK para celulares Android (App Turismo)
# ==============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"
APP_DIR="$ROOT_DIR/app-turismo"
ANDROID_DIR="$APP_DIR/android"
APK_OUTPUT="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
APK_ROOT_COPY="$ROOT_DIR/app-turismo.apk"
HTTP_PORT="18733"
PUBLIC_IP="144.217.10.38"

echo "============================================================"
echo "📱 Iniciando compilación de APK (Android - Release Móvil)"
echo "============================================================"

# 1. Configurar JAVA_HOME (Java 17 para CMake / Toolchain nativo de React Native)
if [ -d "/usr/lib/jvm/java-17-openjdk-amd64" ]; then
  export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
elif [ -d "/root/.sdkman/candidates/java/17.0.15-amzn" ]; then
  export JAVA_HOME="/root/.sdkman/candidates/java/17.0.15-amzn"
elif [ -z "${JAVA_HOME:-}" ]; then
  echo "⚠️  JAVA_HOME no está definido, usando la versión del sistema:"
  java -version
fi

# 2. Configurar ANDROID_HOME
if [ -d "/opt/android-sdk" ]; then
  export ANDROID_HOME="/opt/android-sdk"
elif [ -z "${ANDROID_HOME:-}" ]; then
  echo "❌ Error: ANDROID_HOME no está configurado y no se encontró /opt/android-sdk."
  exit 1
fi

export PATH="$JAVA_HOME/bin:$ANDROID_HOME/platform-tools:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

echo "☕ Usando Java: $($JAVA_HOME/bin/java -version 2>&1 | head -n 1)"
echo "🤖 Usando Android SDK: $ANDROID_HOME"

# 3. Asegurar local.properties en app-turismo/android
mkdir -p "$ANDROID_DIR"
echo "sdk.dir=$ANDROID_HOME" > "$ANDROID_DIR/local.properties"

# 4. Validar tipos de TypeScript antes de compilar
echo "🔍 Validando código TypeScript..."
(cd "$APP_DIR" && pnpm tsc --noEmit)
echo "✅ TypeScript validado correctamente."

# 5. Compilar APK Release
echo "⚙️  Ejecutando Gradle assembleRelease..."
cd "$ANDROID_DIR"
./gradlew assembleRelease "$@"

if [ ! -f "$APK_OUTPUT" ]; then
  echo "❌ Error: No se encontró el APK en $APK_OUTPUT"
  exit 1
fi

# 6. Copiar a la raíz del proyecto para acceso rápido
cp -f "$APK_OUTPUT" "$APK_ROOT_COPY"
chmod 666 "$APK_OUTPUT" "$APK_ROOT_COPY" 2>/dev/null || true

APK_SIZE=$(ls -lh "$APK_OUTPUT" | awk '{print $5}')
APK_BYTES=$(stat -c%s "$APK_OUTPUT")

# 7. Asegurar que Nginx esté activo y sirviendo el nuevo APK
echo "🌐 Actualizando servidor web de descarga (Nginx en puerto $HTTP_PORT)..."
if command -v systemctl >/dev/null 2>&1 && systemctl is-active --quiet nginx; then
  systemctl reload nginx || true
elif command -v nginx >/dev/null 2>&1; then
  nginx -s reload || true
fi

# 8. Verificación de salud del enlace de descarga
HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:$HTTP_PORT/app-release.apk" || echo "000")
if [ "$HTTP_STATUS" = "200" ]; then
  echo "✅ Enlace de descarga verificado y respondiendo HTTP 200 OK."
else
  echo "⚠️  Advertencia: El enlace HTTP respondió con código $HTTP_STATUS."
fi

echo "============================================================"
echo "🎉 ¡APK generado exitosamente!"
echo "============================================================"
echo "📦 Archivo: $APK_OUTPUT"
echo "📦 Copia en raíz: $APK_ROOT_COPY"
echo "⚖️  Tamaño: $APK_SIZE ($APK_BYTES bytes)"
echo "🔗 Link de descarga: http://$PUBLIC_IP:$HTTP_PORT/app-release.apk"
echo "============================================================"
