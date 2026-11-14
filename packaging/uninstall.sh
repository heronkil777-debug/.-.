#!/usr/bin/env bash
set -euo pipefail
DATA_HOME="${XDG_DATA_HOME:-$HOME/.local/share}"
APP_DIR="${NEXO_APP_DIR:-$DATA_HOME/nexo/app}"
BIN="$HOME/.local/bin/nexo"
DESKTOP="$DATA_HOME/applications/nexo.desktop"
ICON="$DATA_HOME/icons/hicolor/scalable/apps/nexo.svg"
if [[ -x "$APP_DIR/nexo" ]]; then "$APP_DIR/nexo" stop || true; fi
if [[ -L "$BIN" && "$(readlink "$BIN")" == "$APP_DIR/nexo" ]]; then rm "$BIN"; fi
if [[ -f "$DESKTOP" ]] && grep -q '^# NEXO installed by packaging/install.sh$' "$DESKTOP"; then rm "$DESKTOP"; fi
if [[ -f "$APP_DIR/.nexo-app" ]]; then
  python3 - "$APP_DIR" <<'PY'
import pathlib, shutil, sys
path = pathlib.Path(sys.argv[1]).resolve()
expected = (pathlib.Path.home() / '.local/share/nexo/app').resolve()
import os
expected = (pathlib.Path(os.environ.get('XDG_DATA_HOME', str(pathlib.Path.home() / '.local/share'))) / 'nexo/app').resolve()
expected = pathlib.Path(os.environ.get('NEXO_APP_DIR', str(expected))).resolve()
if path != expected or not (path / '.nexo-app').is_file() or len(path.parts) < 5:
    raise SystemExit('Recusando remover uma pasta que não é a instalação marcada do NEXO.')
shutil.rmtree(path)
PY
fi
if [[ -f "$ICON" ]] && grep -q 'NEXO installer icon' "$ICON"; then rm "$ICON"; fi
if command -v update-desktop-database >/dev/null 2>&1; then update-desktop-database "$DATA_HOME/applications" >/dev/null 2>&1 || true; fi
echo "NEXO removido. Arquivos de versões antigas, se existirem, foram preservados em $DATA_HOME/nexo."
echo "A versão focada não usa nexo.db. Para apagar dados antigos, faça backup e remova manualmente apenas nexo.db e seus arquivos WAL/SHM."
