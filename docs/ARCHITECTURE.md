# Arquitetura do NEXO

## Escopo

Dois pilares: **monitor do sistema** e **assistente pacman**. Notas, histórico de clipboard, captura automática e banco SQLite foram removidos na versão 3. A página auxiliar explica instalação, permissões e exportação de diagnóstico; não é um CRUD pessoal.

## Peças

- `backend/system.py`: leitura de `/proc`, `/sys`, `os-release`, `shutil.disk_usage`; consultas pacman somente leitura (`-Q`, `-Qs`, `-Qdt`, `-Qm`, `-Qu`, `-Qi`); montagem de comandos com `shlex.join`. Nenhum shell.
- `backend/server.py`: `ThreadingHTTPServer` da stdlib, API JSON e arquivos estáticos compilados. Não importa nem cria armazenamento pessoal.
- `nexo`: launcher de usuário, porta loopback efêmera, chave de bootstrap, runtime `0600`, abertura de janela.
- `src/`: React + TypeScript + Vite; CSS próprio; fontes locais; lucide.
- `packaging/`: instalação sem root, `.desktop`, ícone e desinstalação. O instalador substitui apenas a pasta marcada do app e preserva arquivos antigos de versões anteriores.

## Limites de confiança

1. O navegador fala apenas com URLs relativas `/api/*`.
2. Em produção, o servidor escuta somente em `127.0.0.1` e valida Host.
3. A sessão exige chave gerada pelo launcher ou cookie já emitido. A chave é removida da URL antes das chamadas React.
4. A montagem de comandos via POST exige Origin local, cookie e `X-NEXO-Request: 1`. Ela retorna texto; não executa.
5. CSP restringe scripts, conexões, fontes e frames.
6. Pacman é consultado com argv fixo e nomes validados por `PACKAGE_NAME`. Não existe rota `run`/`exec`.
7. A Clipboard API do navegador só é chamada após clique em “Copiar comando”. Não há ponte nativa, captura automática nem histórico.
8. O diagnóstico JSON é gerado em memória e baixado pelo navegador; o servidor não grava uma cópia.

## Modo preview da Arena

`npm run dev -- --preview` liga Vite em `0.0.0.0` e um backend loopback separado. O proxy injeta a chave de bootstrap apenas nesse modo explícito. A interface mostra uma faixa permanente explicando que os sensores são do sandbox Debian, não do computador de quem acessa.

## Decisões

- Sem Electron: menor empacotamento; usa navegador já instalado, com modo app quando disponível.
- Sem dependências Python de terceiros: backend auditável e fácil de executar no Arch.
- Sem root: monitoramento é de usuário; comandos privilegiados ficam no terminal do usuário.
- Sem persistência pessoal: menos superfície de privacidade e menos manutenção. Atualizações não apagam dados antigos automaticamente.
