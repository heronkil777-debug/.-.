# Validação — NEXO 3 (sistema + pacman)

Data: 2026-11-14. Ambiente de execução: Debian GNU/Linux 12, Python 3.11.2, Node 22.22.3, npm 10.9.8. **Não é Arch Linux.**

## Escopo desta versão

Notas, histórico de clipboard, captura automática, banco SQLite e endpoints de dados pessoais foram removidos. Restaram o monitor do sistema, o assistente pacman e uma página auxiliar de transparência/instalação.

## Executado neste ambiente

- Build TypeScript estrito + Vite de produção.
- Testes Python unittest: parsing de sistema, núcleos, processos, comandos pacman sem execução, diagnóstico pacman com mocks, detalhes de pacote, HTTP, Host/Origin, sessão, limites e ausência dos endpoints antigos de notas/clipboard.
- Testes Vitest de formatação pt-BR.
- Playwright/Chromium: monitor, busca/ordenação de processos, pacman seguro com cópia real via Clipboard API, diagnóstico/detalhes de pacote com respostas simuladas explícitas, paleta/atalhos/foco, exportação de diagnóstico JSON.
- Axe WCAG 2 A/AA + 2.1 AA nas três páginas.
- Overflow em 320, 390, 768, 1024 e 1440 px nas três páginas; navegação móvel.
- Launcher real com HOME/XDG isolados: start/status/stop, porta efêmera loopback, chave privada 0600, bootstrap, cookie de sessão, leitura de sistema/diagnóstico/exportação e confirmação de que nenhum `nexo.db` é criado.
- Instalador real com HOME/XDG isolados: install → start → status → stop → uninstall, sem deixar app, atalho ou ícone.
- Capturas de tela sem erros de runtime e sem requisições externas.

## Resultados

- Backend: **17/17** testes Python aprovados (6 servidor + 11 sistema/pacman).
- Unidade frontend: **3/3** testes Vitest aprovados.
- E2E: **14/14** testes Playwright aprovados (inclui 3 páginas Axe sem violações e 5 larguras sem overflow).
- Build de produção: TypeScript estrito + Vite aprovados; JS principal ~276,1 KB (~85,4 KB gzip), CSS ~56,3 KB (~14,3 KB gzip).
- Launcher isolado: `LAUNCHER+API+NO-DB OK`.
- Instalador isolado: `INSTALL+LAUNCH+UNINSTALL OK`.
- Capturas finais: `artifacts/nexo-desktop.png`, `nexo-pacman.png`, `nexo-mobile.png`; zero erros de runtime e zero requisições externas no fluxo capturado.

## Relatado pelo usuário em Arch real (versão anterior, 2026-11-14)

- Máquina: Arch Linux x86_64, Lenovo IdeaPad S145-15API, kernel 6.18.62-1-lts, Wayland/mango.
- Toolchain do usuário: Python 3.14.10, Node.js 26.13.0, npm 12.2.2, bash 5.3.20.
- A versão 2 foi clonada, compilada e instalada com sucesso; atalho `.desktop` criado.
- **A versão 3 ainda não foi instalada nem exercitada pelo usuário neste Arch.** O instalador desta versão foi validado apenas com HOME/XDG isolados em Debian.

## Não executado aqui (limitação honesta)

- `pacman` real em Arch: não instalado no sandbox. Consulta e parsing foram testados com mocks; a interface informa indisponibilidade. A UI com pacman disponível foi testada com respostas simuladas explícitas, não com um banco Arch real.
- Instalador no filesystem real do usuário Arch para a versão 3: pendente de confirmação.
- Navegador em modo app visível no desktop do usuário: o sandbox usa Chromium headless.
- Sensores de temperatura/bateria dependem do que o kernel expõe; o sandbox pode não expor todos.

## Checklist no seu Arch

1. `cd "$HOME/nexo" && git pull --ff-only origin arena/e098a341-repo && ./packaging/install.sh`
2. Abrir NEXO pelo menu ou `"$HOME/.local/bin/nexo" open`.
3. Conferir hostname, CPU, memória, disco e processos.
4. Abrir o assistente pacman e conferir o diagnóstico local.
5. Gerar `sudo pacman -Syu`, copiar e revisar no terminal. O app não executa nada.
6. Confirmar que não há páginas de notas ou histórico de clipboard.
7. `"$HOME/.local/bin/nexo" stop` encerra o serviço. Dados antigos, se existirem, não são apagados automaticamente.
