# Arquitetura do NEXO

## Peças

- `backend/system.py`: leitura de `/proc`, `os-release`, `shutil.disk_usage`; consultas pacman somente leitura; montagem de comandos com `shlex.join`.
- `backend/store.py`: SQLite WAL, notas, textos, configurações; captura de texto opcional via subprocessos explícitos.
- `backend/server.py`: `ThreadingHTTPServer` da stdlib, API JSON e arquivos estáticos compilados.
- `nexo`: launcher de usuário, porta loopback efêmera, chave de bootstrap, runtime `0600`, abertura de janela.
- `src/`: React + TypeScript + Vite; CSS próprio; fontes locais; lucide.
- `packaging/`: instalação sem root, `.desktop`, ícone e desinstalação preservando dados.

## Limites de confiança

1. O navegador fala apenas com URLs relativas `/api/*`.
2. Em produção, o servidor escuta somente em `127.0.0.1` e valida Host.
3. A sessão exige chave gerada pelo launcher ou cookie já emitido. A chave é removida da URL antes das chamadas React.
4. Mutações exigem Origin local, cookie e `X-NEXO-Request: 1`.
5. CSP restringe scripts, conexões, fontes e frames. Não há eval de conteúdo do usuário.
6. Pacman é consultado com argv fixo. O assistente retorna texto; não existe rota `run`/`exec`.
7. Clipboard automático é opt-in por processo, somente texto, com limite de tamanho e filtro heurístico de segredos.

## Modo preview da Arena

`npm run dev -- --preview` liga Vite em `0.0.0.0` e um backend loopback separado. O proxy injeta a chave de bootstrap apenas nesse modo explícito. Os dados ficam em `.nexo-dev-data`, não no computador de quem acessa. A interface mostra uma faixa permanente explicando isso.

## Decisões

- Sem Electron: menor empacotamento; usa navegador já instalado, com modo app quando disponível.
- Sem dependências Python de terceiros: backend auditável e fácil de executar no Arch.
- Sem root: monitoramento e dados são de usuário; comandos privilegiados ficam no terminal do usuário.
- Sem criptografia prometida: o app declara claramente o modelo de ameaça e oferece exportação.
