#!/usr/bin/env bash
# ==============================================================================
# Genera el APK desde la última versión de main en GitHub.
#
#   ./release-apk.sh            # arm64-v8a (celular)
#   ./release-apk.sh x86_64     # emulador (AVD test35)
#   BRANCH=otra ./release-apk.sh
#
# Pasos:
#  1. Exige árbol de trabajo limpio (no pisa cambios sin commit).
#  2. git fetch + checkout de $BRANCH (main por defecto) + fast-forward a origin.
#  3. Si cambiaron package.json / pnpm-lock.yaml / app.config.js desde el último
#     build (o no existe android/): pnpm install + expo prebuild, y vuelve a
#     subir la memoria de Gradle (prebuild la resetea y el build falla por
#     Metaspace OOM).
#  4. Llama a build-apk.sh (tsc + gradle assembleRelease + nginx).
# ==============================================================================
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$ROOT_DIR/app-turismo"
ANDROID_DIR="$APP_DIR/android"
MARKER="$ANDROID_DIR/.last-build-commit"
BRANCH="${BRANCH:-main}"
ARCH="${1:-arm64-v8a}"
DEP_FILES=(app-turismo/package.json app-turismo/pnpm-lock.yaml app-turismo/app.config.js)

cd "$ROOT_DIR"

# 1. Árbol limpio
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  echo "❌ Hay cambios sin commit. Haz commit o stash antes de compilar." >&2
  git status -s --untracked-files=no >&2
  exit 1
fi

# 2. Traer últimos cambios y posicionarse en $BRANCH
echo "==> git fetch origin"
git fetch origin --prune
if [ "$(git branch --show-current)" != "$BRANCH" ]; then
  echo "==> Cambiando a $BRANCH"
  git checkout "$BRANCH"
fi
if ! git merge --ff-only "origin/$BRANCH"; then
  echo "❌ $BRANCH divergió de origin/$BRANCH: revisar manualmente." >&2
  exit 1
fi
HEAD_SHA="$(git rev-parse HEAD)"
echo "==> Compilando $BRANCH @ $(git log --oneline -1)"

# 3. ¿Hace falta reinstalar deps / regenerar android/?
needs_prebuild=0
if [ ! -x "$ANDROID_DIR/gradlew" ]; then
  echo "==> No existe android/: se hará prebuild"
  needs_prebuild=1
elif [ ! -f "$MARKER" ] || ! git cat-file -e "$(cat "$MARKER")^{commit}" 2>/dev/null; then
  echo "==> Sin registro del último build: se hará prebuild por seguridad"
  needs_prebuild=1
elif ! git diff --quiet "$(cat "$MARKER")" HEAD -- "${DEP_FILES[@]}"; then
  echo "==> Cambiaron dependencias/config desde el último build:"
  git diff --stat "$(cat "$MARKER")" HEAD -- "${DEP_FILES[@]}"
  needs_prebuild=1
fi

if [ "$needs_prebuild" -eq 1 ]; then
  # Usar pnpm: `expo install` con npm falla por el package-lock.json
  (cd "$APP_DIR" && pnpm install && npx expo prebuild --platform android --no-install)
  sed -i 's/^org\.gradle\.jvmargs=.*/org.gradle.jvmargs=-Xmx8g -XX:MaxMetaspaceSize=2g/' "$ANDROID_DIR/gradle.properties"
  grep -q '^org\.gradle\.jvmargs=' "$ANDROID_DIR/gradle.properties" \
    || echo 'org.gradle.jvmargs=-Xmx8g -XX:MaxMetaspaceSize=2g' >> "$ANDROID_DIR/gradle.properties"
else
  echo "==> Dependencias sin cambios: se omite prebuild"
fi

# 4. Compilar
"$ROOT_DIR/build-apk.sh" \
  -PreactNativeArchitectures="$ARCH" \
  -x lintVitalAnalyzeRelease -x lintVitalRelease

echo "$HEAD_SHA" > "$MARKER"
echo "✅ APK ($ARCH) de $BRANCH @ ${HEAD_SHA:0:7}"
