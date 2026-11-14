#!/usr/bin/env bash
# User-only Arch/Linux installer. Never uses sudo and never removes user data.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
APP_DIR="${NEXO_APP_DIR:-$DATA_HOME/nexo/app}"
BIN_DIR="$HOME/.local/bin"
DESKTOP_DIR="$DATA_HOME/applications"
ICON_DIR="$DATA_HOME/icons/hicolor/scalable/apps"

if [[ "$(id -u)" -eq 0 ]]; then
  echo "Execute como seu usuário normal, não como root/sudo." >&2
  exit 1
fi
for tool in python3 node npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    echo "Falta $tool. No Arch: sudo pacman -S --needed python nodejs npm" >&2
    exit 1
  fi
done
python3 -c 'import sys; assert sys.version_info >= (3, 10), "Python 3.10+ necessário"'
node -e 'if (+process.versions.node.split(".")[0] < 22) { console.error("Node.js 22+ necessário"); process.exit(1); }'
if [[ -e "$APP_DIR" && ! -f "$APP_DIR/.nexo-app" ]]; then
  echo "Recusando sobrescrever pasta estranha: $APP_DIR" >&2
  exit 1
fi
cd "$ROOT"
echo "→ Instalando dependências de build pinned pelo lockfile…"
npm ci --no-audit --no-fund
echo "→ Compilando a interface local…"
npm run build
mkdir -p "$APP_DIR/backend" "$APP_DIR/dist" "$BIN_DIR" "$DESKTOP_DIR" "$ICON_DIR"
printf 'NEXO application files. Safe to replace on upgrade.\n' > "$APP_DIR/.nexo-app"
python3 - "$APP_DIR" <<'PY'
import pathlib, shutil, sys
app = pathlib.Path(sys.argv[1])
for name in ('backend', 'dist'):
    target = app / name
    if target.exists():
        shutil.rmtree(target)
    target.mkdir()
PY
cp backend/*.py "$APP_DIR/backend/"
cp -R dist/. "$APP_DIR/dist/"
cp nexo "$APP_DIR/nexo"
chmod 755 "$APP_DIR/nexo"
cp packaging/nexo.svg "$ICON_DIR/nexo.svg"
ln -sfn "$APP_DIR/nexo" "$BIN_DIR/nexo"
ESCAPED_BIN=$(python3 -c 'import json,pathlib,sys; print(json.dumps(pathlib.Path(sys.argv[1]).as_posix()).replace("%","%%"))' "$BIN_DIR/nexo")
cat > "$DESKTOP_DIR/nexo.desktop" <<EOF
# NEXO installed by packaging/install.sh
[Desktop Entry]
Type=Application
Name=NEXO
Comment=Sua central pessoal para Linux — local, sem conta
Comment[pt_BR]=Sua central pessoal para Linux — local, sem conta
Exec=$ESCAPED_BIN open
Icon=nexo
Terminal=false
Categories=Utility;System;
Keywords=linux;notes;clipboard;pacman;system;
StartupNotify=true
StartupWMClass=NEXO
EOF
chmod 644 "$DESKTOP_DIR/nexo.desktop"
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$DESKTOP_DIR" >/dev/null 2>&1 || true; fi
if command -v desktop-file-validate >/dev/null 2>&1; then desktop-file-validate "$DESKTOP_DIR/nexo.desktop"; fi
echo
printf '✓ NEXO instalado em %s\n' "$APP_DIR"
printf '✓ Atalho criado no menu de aplicativos. Procure NEXO.\n'
printf '→ Agora: %s/nexo open\n' "$BIN_DIR"
if ! command -v chromium >/dev/null && ! command -v google-chrome-stable >/dev/null && ! command -v firefox >/dev/null; then
  echo "• Nenhum navegador dedicado detectado. Será usado o navegador padrão."
  echo "  Opcional no Arch: sudo pacman -S --needed chromium"
fi
if ! command -v wl-paste >/dev/null && ! command -v xclip >/dev/null; then
  echo "• Clipboard do desktop é opcional: wl-clipboard (Wayland) ou xclip (X11)."
fi
echo "• Seus dados ficam fora da pasta do app e são preservados em atualizações."
