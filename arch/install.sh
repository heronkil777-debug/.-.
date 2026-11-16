#!/usr/bin/env bash
# STOP! — instalador para Arch Linux (e qualquer Linux), SEM root.
#
#   ./arch/install.sh              instala em ~/.local (menu de aplicativos incluso)
#   ./arch/install.sh --desinstalar
#
# Não mexe em nada do sistema: tudo fica dentro de ~/.local e pode ser removido
# com --desinstalar.
set -euo pipefail

ORIGEM="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DADOS="${XDG_DATA_HOME:-$HOME/.local/share}"
DEST="$DADOS/stop-jogo"
BIN="$HOME/.local/bin"
APPS="$DADOS/applications"
ICONES="$DADOS/icons/hicolor"

verde() { printf '\033[1;32m%s\033[0m\n' "$*"; }
amarelo() { printf '\033[1;33m%s\033[0m\n' "$*"; }
erro() { printf '\033[1;31m%s\033[0m\n' "$*" >&2; }

desinstalar() {
  if [[ -x "$BIN/stop-jogo" ]]; then "$BIN/stop-jogo" --parar >/dev/null 2>&1 || true; fi
  rm -rf "$DEST"
  rm -f "$BIN/stop-jogo" "$APPS/stop-jogo.desktop"
  rm -f "$ICONES/scalable/apps/stop-jogo.svg"
  rm -f "$ICONES"/{192x192,256x256,512x512}/apps/stop-jogo.png
  command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q "$APPS" 2>/dev/null || true
  command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t -f "$ICONES" 2>/dev/null || true
  verde "STOP! desinstalado de $DEST (o servidor local também foi encerrado)."
}

if [[ "${1:-}" == "--desinstalar" || "${1:-}" == "--uninstall" ]]; then
  desinstalar
  exit 0
fi

echo
verde "  STOP!  →  instalando em $DEST"
echo

# 1) pré-requisitos
if ! command -v python3 >/dev/null 2>&1; then
  erro "Falta o Python 3 (ele só serve os arquivos localmente)."
  erro "Instale com:  sudo pacman -S python"
  exit 1
fi

if [[ ! -f "$ORIGEM/www/index.html" ]]; then
  erro "Não achei o jogo em $ORIGEM/www"
  erro "Rode este script de dentro da pasta do projeto: ./arch/install.sh"
  exit 1
fi

# 2) arquivos do jogo
rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$ORIGEM/www/." "$DEST/"

# 3) comando stop-jogo
mkdir -p "$BIN"
install -m755 "$ORIGEM/arch/stop-jogo" "$BIN/stop-jogo"

# 4) entrada no menu de aplicativos
mkdir -p "$APPS"
cat > "$APPS/stop-jogo.desktop" <<DESKTOP
[Desktop Entry]
Type=Application
Name=STOP!
GenericName=Jogo de palavras
Comment=Adedonha digital: sorteie uma letra e preencha as categorias
Exec=stop-jogo
Icon=stop-jogo
Terminal=false
Categories=Game;Education;
Keywords=stop;adedonha;adedanha;palavras;jogo;
StartupNotify=true
DESKTOP
chmod 644 "$APPS/stop-jogo.desktop"

# 5) ícones
mkdir -p "$ICONES/scalable/apps" "$ICONES/192x192/apps" "$ICONES/256x256/apps" "$ICONES/512x512/apps"
cp "$ORIGEM/www/assets/icone.svg" "$ICONES/scalable/apps/stop-jogo.svg"
cp "$ORIGEM/www/assets/icone-192.png" "$ICONES/192x192/apps/stop-jogo.png"
cp "$ORIGEM/www/assets/icone-256.png" "$ICONES/256x256/apps/stop-jogo.png"
cp "$ORIGEM/www/assets/icone-512.png" "$ICONES/512x512/apps/stop-jogo.png"

# 6) caches (opcional, só para o menu atualizar na hora)
command -v update-desktop-database >/dev/null 2>&1 && update-desktop-database -q "$APPS" 2>/dev/null || true
command -v gtk-update-icon-cache >/dev/null 2>&1 && gtk-update-icon-cache -q -t -f "$ICONES" 2>/dev/null || true

verde "  Instalado! ✔"
echo
echo "  Abrir agora:      stop-jogo"
echo "  Ou clique em STOP! no menu de aplicativos"
echo "  Endereço local:   $(STOP_JOGO_DIR="$DEST" "$BIN/stop-jogo" --url)"
echo "  Encerrar:         stop-jogo --parar"
echo "  Desinstalar:      $ORIGEM/arch/install.sh --desinstalar"
echo

if ! printf '%s' ":$PATH:" | grep -q ":$BIN:"; then
  amarelo "  Aviso: $BIN não está no seu PATH."
  amarelo "  Adicione ao ~/.bashrc:  export PATH=\"\$HOME/.local/bin:\$PATH\""
  amarelo "  (ou abra pelo menu de aplicativos, que já funciona)"
  echo
fi
