# NEXO

**Seu Linux, mais perto.** Um cockpit local para Arch Linux com dois focos: **monitor do sistema** e **assistente de comandos pacman**. Sem conta, sem nuvem, sem telemetria — e sem executar comandos por você.

> A versão 3 remove notas e histórico de clipboard, conforme seu feedback. O jogo anterior continua preservado apenas no histórico Git (`eb44d22`).

## O que ele faz

- **Monitor do sistema:** CPU total e por núcleo, carga média, memória, swap, cache, disco da partição pessoal, outros pontos de montagem, rede, temperaturas e bateria quando expostas pelo kernel. Processos com busca e ordenação por memória/CPU. Leitura real de `/proc` e `/sys`, sem root.
- **Assistente pacman:** diagnóstico local de pacotes instalados, atualizações pendentes no banco sincronizado, órfãos, pacotes foreign/AUR e cache; busca em pacotes instalados e detalhes via `pacman -Qi`. Monta comandos de atualização, busca, informação, instalação, remoção, órfãos, atualizações, arquivos e limpeza de cache. **Nunca executa comandos.** Você copia, revisa e executa no seu terminal.
- **Transparência:** página Sobre e instalação, exportação de diagnóstico JSON e atalhos. Não há banco de dados pessoal, notas, histórico de clipboard nem captura automática.
- **Atalhos:** `Ctrl/⌘+K` para ações, `1` monitor, `2` pacman, `?` ajuda.

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

O repositório é público; esse clone por HTTPS não pede token. Se você já instalou a versão anterior, atualize e reinstale a partir da pasta existente:

```bash
cd "$HOME/nexo"
git pull --ff-only origin arena/e098a341-repo
./packaging/install.sh
"$HOME/.local/bin/nexo" open
```

O instalador encerra a instância antiga marcada do NEXO antes de substituir os arquivos do app. **Ele não apaga `nexo.db` nem outros dados antigos** que porventura existam em `~/.local/share/nexo`; a versão 3 simplesmente não os usa. Se quiser removê-los, faça backup e apague manualmente apenas esses arquivos depois de conferir o que são.

> **`./packaging/install.sh: No such file or directory`** significa que o terminal ainda está fora da pasta do projeto (por exemplo, em `~`). Rode o `git clone` e o `cd` acima primeiro. As mensagens `is up to date -- skipping` do pacman são normais: as dependências já estavam instaladas.

O instalador:

1. instala as dependências npm do lockfile;
2. compila a interface;
3. copia o app para `~/.local/share/nexo/app` (respeita `XDG_DATA_HOME`);
4. cria `~/.local/bin/nexo` e um ícone **NEXO** no menu de aplicativos.

Não usa sudo, não instala pacotes do sistema silenciosamente e não cria serviço root.

Abra pelo menu ou:

```bash
"$HOME/.local/bin/nexo" open
```

Se `~/.local/bin` estiver no seu `PATH`, basta `nexo open`. O launcher inicia o backend local quando necessário e abre Chromium/Chrome em modo app, Firefox ou o navegador padrão. Nenhum Electron é empacotado.

### Integração opcional

```bash
# Janela em modo app (opcional)
sudo pacman -S --needed chromium
```

Não é necessário instalar `wl-clipboard` nem `xclip`: a versão focada não tem histórico de clipboard. O botão “Copiar comando” usa a Clipboard API do navegador após seu clique; se ela for bloqueada, mostra o texto para seleção manual.

## Comandos

```bash
./nexo open      # abre a janela e inicia o serviço se necessário
./nexo start     # inicia o serviço em segundo plano e mostra a porta
./nexo status    # estado, porta e pasta do app
./nexo url       # URL local com chave de sessão (não compartilhe)
./nexo stop      # encerra o serviço
```

## Desenvolver

```bash
npm ci
npm run dev -- --preview   # UI 0.0.0.0:5173 + API loopback:8765
```

Sem `--preview`, o Vite de desenvolvimento escuta apenas em `127.0.0.1`. A flag `--preview` é explicitamente para o sandbox hospedado da Arena; não a use para expor dados pessoais.

```bash
npm run build
./nexo open
npm run check    # formatação, backend, unidade, build e E2E
```

## Dados e privacidade

- **Sem banco de dados pessoal.** Esta versão não grava notas, textos ou preferências no servidor. O diagnóstico JSON só é gravado quando você clica em exportar.
- Permissões: pasta de runtime `0700`, chave de sessão em arquivo `0600`.
- API local exige chave de inicialização, cookie HttpOnly/SameSite=Strict, checagem de Host/Origin e cabeçalho customizado nas mutações.
- Não há endpoint de execução arbitrária. `sudo` aparece apenas como texto sugerido. Consultas pacman usam argv fixo e somente leitura.
- Fontes e ícones são empacotados localmente. Licenças em `public/licenses/`.
- O diagnóstico JSON contém hostname, processos e informações de pacotes. Revise antes de compartilhar.

## Desinstalação

```bash
cd "$HOME/nexo"
./packaging/uninstall.sh
```

Remove app, atalho e ícone. Dados antigos de versões anteriores, se existirem, não são apagados automaticamente.

## Validação honesta

O sandbox de desenvolvimento é **Debian 12**, não Arch. Aqui foram exercitados backend Linux real, launcher local, interface, fluxos E2E, acessibilidade e responsividade. `pacman` não está disponível no sandbox; consultas e parsing têm testes com mocks, e a UI de Arch também foi exercitada com respostas simuladas explícitas. **A consulta pacman real ainda precisa ser conferida no seu Arch.** O instalador foi exercitado com HOME/XDG isolados e a versão anterior foi instalada/compilada com sucesso em Arch real relatado pelo usuário. Consulte `docs/VALIDATION.md` para os resultados exatos desta versão.
