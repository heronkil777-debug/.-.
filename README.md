# NEXO

**Seu Linux, mais perto.** Uma central pessoal para Arch Linux: monitor do sistema, notas rápidas, histórico de textos e um assistente de comandos pacman. Sem conta, sem nuvem, sem telemetria.

> O jogo anterior foi removido da árvore atual, como pedido. Ele continua preservado no histórico Git (`eb44d22`).

## O que ele faz

- **Visão geral:** CPU, memória, swap, disco da partição pessoal, uptime, rede e processos que mais usam memória. Leitura real de `/proc`, sem root.
- **Notas rápidas:** criar, editar com salvamento automático, buscar, fixar, colorir, excluir e exportar em Markdown. Persistência em SQLite.
- **Área de transferência:** guardar textos manualmente, copiar, buscar, fixar e limpar. Captura automática **opcional** via `wl-clipboard` (Wayland) ou `xclip` (X11), somente texto, até 20.000 caracteres e 200 itens.
- **Assistente pacman:** montar comandos de atualização, busca, informação, instalação, remoção e listagem de órfãos. **Nunca executa comandos.** Você copia, revisa e executa no seu terminal.
- **Preferenças:** exportação JSON, atalhos, limites e explicação honesta das permissões.
- **Atalhos:** `Ctrl/⌘+K` para ações, `N` para nota, `1–4` para páginas, `?` para ajuda.

## Instalar no Arch

Requisitos de build: **Git, Python 3.10+, Node.js 22+, npm**.

Os comandos abaixo podem ser copiados **de qualquer pasta**. Eles baixam o projeto para `~/nexo`, entram na pasta correta e só então executam o instalador:

```bash
sudo pacman -S --needed git python nodejs npm
git clone --branch arena/e098a341-repo https://github.com/heronkil777-debug/.-..git "$HOME/nexo"
cd "$HOME/nexo"
./packaging/install.sh
"$HOME/.local/bin/nexo" open
```

O repositório é público; esse clone por HTTPS não pede token. Se você já clonou o projeto antes, atualize e reinstale a partir da pasta existente:

```bash
cd "$HOME/nexo"
git pull --ff-only origin arena/e098a341-repo
./packaging/install.sh
"$HOME/.local/bin/nexo" open
```

> **`./packaging/install.sh: No such file or directory`** significa que o terminal ainda está fora da pasta do projeto (por exemplo, em `~`). Rode o `git clone` e o `cd` acima primeiro. As mensagens `is up to date -- skipping` do pacman são normais: as dependências já estavam instaladas.

O instalador:

1. instala as dependências npm do lockfile;
2. compila a interface;
3. copia o app para `~/.local/share/nexo/app` (respeita `XDG_DATA_HOME`);
4. cria `~/.local/bin/nexo` e um ícone **NEXO** no menu de aplicativos.

Não usa sudo, não instala pacotes do sistema silenciosamente e não cria serviço root.

Abra pelo menu ou:

```bash
~/.local/bin/nexo open
```

Se `~/.local/bin` estiver no seu `PATH`, basta `nexo open`. O launcher inicia o backend local quando necessário e abre Chromium/Chrome em modo app, Firefox ou o navegador padrão. Nenhum Electron é empacotado.

### Integrações opcionais

```bash
# Wayland
sudo pacman -S --needed wl-clipboard

# X11
sudo pacman -S --needed xclip

# Janela em modo app (opcional)
sudo pacman -S --needed chromium
```

A captura automática começa **desligada a cada inicialização**. Ative em Preferências ou na página Área de transferência. Sem essas ferramentas, guardar/copiar textos pela interface continua funcionando.

## Comandos

```bash
./nexo open      # abre a janela e inicia o serviço se necessário
./nexo start     # inicia o serviço em segundo plano e mostra a porta
./nexo status    # estado, porta e pasta de dados
./nexo url       # URL local com chave de sessão (não compartilhe)
./nexo stop      # encerra o serviço; preserva os dados
```

## Desenvolver

```bash
npm ci
npm run dev -- --preview   # UI 0.0.0.0:5173 + API loopback:8765, dados .nexo-dev-data
```

Sem `--preview`, o Vite de desenvolvimento escuta apenas em `127.0.0.1`. A flag `--preview` é explicitamente para o sandbox hospedado da Arena; não a use para expor dados pessoais.

```bash
npm run build
./nexo open
npm run check    # formatação, backend, unidade, build e E2E
```

## Dados e privacidade

- Banco: `~/.local/share/nexo/nexo.db` (ou `XDG_DATA_HOME/nexo/nexo.db`).
- Permissões: pasta `0700`, banco `0600`; chaves de runtime em arquivo `0600`.
- **Sem criptografia em repouso.** Permissões Unix não protegem contra processos do mesmo usuário ou acesso físico. Não use como gerenciador de senhas.
- O filtro de segredos da captura automática é heurístico e pode falhar. Textos guardados manualmente não passam por esse filtro.
- API local exige chave de inicialização, cookie HttpOnly/SameSite=Strict, checagem de Host/Origin e cabeçalho customizado nas mutações.
- Não há endpoint de execução arbitrária. `sudo` aparece apenas como texto sugerido.
- Fontes e ícones são empacotados localmente. Licenças em `public/licenses/`.

## Backup e desinstalação

Em Preferências, exporte JSON. Uma nota também pode ser exportada em Markdown.

```bash
./packaging/uninstall.sh
```

Remove app, atalho e ícone; **preserva o banco**. Para apagar dados, faça backup e remova manualmente `nexo.db` e seus arquivos WAL/SHM na pasta de dados.

## Validação honesta

O sandbox de desenvolvimento é **Debian 12**, não Arch. Aqui foram exercitados backend Linux real, SQLite, launcher local, interface, fluxos E2E, acessibilidade e responsividade. `pacman`, `wl-paste` e `xclip` não estão disponíveis no sandbox; suas integrações têm testes unitários com mocks e degradação explícita, mas **não foram executadas em um Arch real nesta sessão**. O instalador foi exercitado com HOME/XDG isolados e também instalado/compilado com sucesso em Arch real relatado pelo usuário (Python 3.14, Node 26, npm 12). Resultado: 19 testes backend + 3 unitários + 16 E2E aprovados; 5 páginas sem violações Axe e 5 larguras sem overflow. Consulte `docs/VALIDATION.md`.
