#!/usr/bin/env bash
# Descarga todos los cambios del repositorio desde GitHub:
#  - trae todas las ramas y tags de origin (sin tocar archivos locales)
#  - elimina referencias remotas que ya no existen (--prune)
#  - actualiza en modo fast-forward solo las ramas locales que estén detrás
#    (nunca hace merge, rebase ni reset: no pierde trabajo local)
#  - la rama actual se actualiza solo si el árbol de trabajo está limpio
set -euo pipefail

REMOTE="${REMOTE:-origin}"

cd "$(dirname "$0")"

if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Error: no es un repositorio git" >&2
  exit 1
fi

echo "==> Descargando ramas y tags de $REMOTE..."
git fetch "$REMOTE" --prune --prune-tags --tags --force

current="$(git branch --show-current)"
dirty=0
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  dirty=1
fi

echo "==> Actualizando ramas locales (solo fast-forward)..."
while IFS= read -r ref; do
  branch="${ref#refs/heads/}"
  remote_ref="refs/remotes/$REMOTE/$branch"

  # Solo ramas que existen en el remoto
  git show-ref --verify --quiet "$remote_ref" || continue

  local_sha="$(git rev-parse "refs/heads/$branch")"
  remote_sha="$(git rev-parse "$remote_ref")"
  [ "$local_sha" = "$remote_sha" ] && continue

  # Ya está al día o adelante del remoto: nada que hacer
  if git merge-base --is-ancestor "$remote_sha" "$local_sha"; then
    echo "  [$branch] adelantada al remoto, sin cambios"
    continue
  fi

  # Solo se puede avanzar si el local es ancestro del remoto
  if ! git merge-base --is-ancestor "$local_sha" "$remote_sha"; then
    echo "  [$branch] divergida del remoto: revisar manualmente" >&2
    continue
  fi

  if [ "$branch" = "$current" ]; then
    if [ "$dirty" -eq 1 ]; then
      echo "  [$branch] actual con cambios sin commit: no se actualiza (haz commit o stash y vuelve a ejecutar)" >&2
      continue
    fi
    git merge --ff-only "$remote_ref" >/dev/null
  else
    git update-ref "refs/heads/$branch" "$remote_sha" "$local_sha"
  fi
  echo "  [$branch] actualizada $(git rev-parse --short "$local_sha") -> $(git rev-parse --short "$remote_sha")"
done < <(git for-each-ref --format='%(refname)' refs/heads/)

echo "==> Listo. Rama actual: $current"
git status -sb | head -1
