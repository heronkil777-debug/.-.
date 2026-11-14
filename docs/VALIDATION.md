# Validação — NEXO

Data: 2026-11-14. Ambiente de execução: Debian GNU/Linux 12, Python 3.11.2, Node 22.22.3, npm 10.9.8. **Não é Arch Linux.**

## Executado neste ambiente

- Build TypeScript estrito + Vite de produção.
- Testes Python unittest: armazenamento, permissões, validação, deduplicação, retenção, filtro heurístico, clipboard indisponível e mocks Wayland, parsing de sistema, comandos pacman sem execução, HTTP, Host/Origin, sessão e limites.
- Testes Vitest de formatação pt-BR.
- Playwright/Chromium: painel, notas CRUD/exportação/persistência, clipboard guardar/copiar/fixar/limpar, pacman seguro, paleta/atalhos/foco, exportação JSON.
- Axe WCAG 2 A/AA + 2.1 AA nas cinco páginas.
- Overflow em 320, 390, 768, 1024 e 1440 px nas cinco páginas; navegação móvel.
- Launcher real: start/status/url/stop, porta efêmera loopback, chave privada, bootstrap, cookie de sessão, criação de nota e leitura após reload.
- Capturas de tela sem erros de runtime e sem requisições externas.

## Resultados

- Backend: **19/19** testes Python aprovados.
- Unidade frontend: **3/3** testes Vitest aprovados.
- E2E: **16/16** testes Playwright aprovados (inclui 5 páginas Axe sem violações e 5 larguras sem overflow).
- Build de produção: TypeScript estrito + Vite aprovados; JS principal ~287,8 KB (~88,5 KB gzip), CSS ~65,7 KB (~16,1 KB gzip).
- Launcher local: inicialização, status, URL com chave, nota persistida após reload e encerramento aprovados.
- Instalador: executado com `HOME`/XDG isolados em `artifacts/install-home`; install → start → status → stop → uninstall aprovado, com atalho `.desktop` e dados preservados.
- Capturas finais: `artifacts/nexo-desktop.png`, `nexo-notes.png`, `nexo-pacman.png`, `nexo-mobile.png`; zero erros de runtime e zero requisições externas no fluxo capturado.

## Relatado pelo usuário em Arch real (2026-11-14)

- Máquina: Arch Linux x86_64, Lenovo IdeaPad S145-15API, kernel 6.18.62-1-lts, Wayland/mango.
- Toolchain do usuário: Python 3.14.10, Node.js 26.13.0, npm 12.2.2, bash 5.3.20.
- `git clone` público, `./packaging/install.sh`, `npm ci` e `vite build` concluídos com sucesso; atalho `.desktop` criado.
- `desktop-file-validate` emitiu apenas hint cosmético sobre duas categorias principais (`Utility;System;`). Corrigido para `Categories=Utility;`.
- Ainda não confirmado nesta conversa: janela do app visível, captura Wayland real e consulta pacman dentro da interface.

## Não executado aqui (limitação honesta)

- `pacman` real em Arch: não instalado no sandbox. Consulta e parsing foram testados com mocks; a interface informa indisponibilidade.
- `wl-paste`/`wl-copy` e `xclip` reais: não instalados e sem display desktop. Detecção, argumentos e fallback foram testados; captura real precisa de conferência no seu Wayland/X11.
- Instalador no filesystem real do usuário Arch: instalação/build foram confirmados pelo usuário (seção acima); o sandbox também exercitou o fluxo com HOME/XDG isolados em Debian.
- Navegador em modo app visível no desktop do usuário: o sandbox usa Chromium headless.

## Checklist no seu Arch

1. `./packaging/install.sh`
2. Abrir NEXO pelo menu.
3. Conferir hostname, CPU, memória e disco.
4. Criar uma nota, fechar o app, reabrir e confirmar persistência.
5. Em Preferências, exportar JSON.
6. Opcional: instalar wl-clipboard/xclip, ativar captura, copiar um texto comum e conferir histórico.
7. Gerar `sudo pacman -Syu`, copiar e revisar no terminal. O app não executa nada.
8. `nexo stop` e `./packaging/uninstall.sh` preservam dados.
