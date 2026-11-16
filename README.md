<div align="center">

# STOP! 🎯

**O clássico das palavras — Adedonha digital com dicionário, dicas e modo offline.**

`pais` · `nome` · `objeto` · `profissão` · `coisa de praia` · `termo de RPG` · `peça de carro` · `gíria` …

23 categorias · 2.804 palavras · 0 dependências para jogar

</div>

---

## O que é

Você sorteia uma **letra** e preenche todas as categorias com palavras que começam por ela
(ex.: letra **X** → *Objeto*: **Xícara**, *Animal*: **Xexéu**, *Peça de carro*: **Xenônio**).

O jogo **confere as respostas** contra um dicionário embutido, calcula pontos, mostra quais
palavras são repetidas e dá **dicas** (que custam pontos). Tudo funciona **sem internet**,
sem login, sem anúncio, sem servidor.

Tem cara de jogo de tabuleiro: feltro verde, papel creme, botões que afundam, roleta de letras,
som, vibração e confete no resultado.

## Instalar no Arch Linux (1 comando, sem root)

```bash
curl -fsSL https://github.com/heronkil777-debug/.-./releases/latest/download/stop-jogo-1.0.0.tar.gz \
  -o /tmp/stop.tgz && tar xzf /tmp/stop.tgz -C /tmp && /tmp/stop-jogo-1.0.0/arch/install.sh
```

Isso copia o jogo para `~/.local/share/stop-jogo`, cria o comando **`stop-jogo`**,
o ícone e a entrada **STOP!** no menu de aplicativos. Não usa `sudo`, não mexe em nada do sistema.

```bash
stop-jogo              # abre o jogo (janela do app, se tiver chromium/brave; senão no navegador)
stop-jogo --parar      # encerra o servidor local (porta 8791)
stop-jogo --url        # só mostra o endereço
./arch/install.sh --desinstalar   # remove tudo
```

Precisa apenas de `python` (que já vem no Arch) para servir os arquivos em `127.0.0.1`.
Detalhes: o launcher reaproveita o servidor se já estiver no ar, aceita `STOP_JOGO_PORTA`
e `STOP_JOGO_DIR`, e roda do próprio repositório se você chamar `./arch/stop-jogo` direto.

### Alternativas de instalação

```bash
# direto do git (gera a pasta stop-jogo)
git clone https://github.com/heronkil777-debug/.-. stop-jogo
cd stop-jogo && ./arch/install.sh

# gerenciado pelo pacman (precisa de base-devel)
cd stop-jogo/arch && makepkg -si     # depois: sudo pacman -R stop-jogo
```

### Só abrir, sem instalar

```bash
xdg-open www/index.html     # funciona offline, direto do repositório
npm start                   # ou servir em http://localhost:8080 (ativa o cache offline/PWA)
```

No celular: abra o endereço no navegador → menu → **"Adicionar à tela inicial"**.
Fica com ícone próprio, tela cheia e funciona offline.

## Opcional: APK Android

O APK é gerado **na nuvem pelo GitHub Actions** (o projeto usa [Capacitor](https://capacitorjs.com/),
que empacota o mesmo jogo dentro de um app Android de verdade).

Ative o workflow uma única vez (os arquivos ficam em `docs/workflows/` porque o bot que criou
este repositório não tem permissão de commitar em `.github/workflows`):

```bash
mkdir -p .github/workflows
cp docs/workflows/*.yml .github/workflows/
git add .github && git commit -m "ci: APK Android + deploy da PWA" && git push
```

Depois:

1. **Actions → “APK Android” → Run workflow**
2. Ao terminar, baixe o artefato **`stop-jogo-apk`**
3. No celular, permita "instalar apps de fontes desconhecidas" e abra o `.apk`

Também dá para compilar na mão, com Android SDK + Java 21 instalados:

```bash
npm ci
npx cap add android
npx cap sync android
cd android && ./gradlew assembleDebug
# APK em android/app/build/outputs/apk/debug/app-debug.apk
```

> Quer um APK assinado para publicar na Play Store? Crie um keystore e use
> `./gradlew assembleRelease` com `android/keystore.properties` — instruções em
> `docs/ANDROID.md`.

## Como pontua

| Situação | Pontos |
| --- | --- |
| Palavra que está no dicionário | **+10** |
| Palavra que o jogo não conhece (vale conferir) | **+5** |
| Palavra com 9 letras ou mais | **+2** extra |
| Palavra repetida com outro jogador | vale **metade** |
| Usou dica naquela palavra | **−6** |

A dica mostra as **duas primeiras letras** e o **tamanho** da palavra.
No **modo festa** (2 a 6 jogadores) o celular passa de mão em mão: todos jogam a mesma letra,
e no fim você vê o placar da rodada e o acumulado da sessão.

## Categorias

| Categoria | Pacote | Palavras |
| --- | --- | --- |
| 🌍 País | Clássico | 160 |
| 🧑 Nome | Clássico | 148 |
| 📦 Objeto | Clássico | 147 |
| 🧑‍🔧 Profissão | Clássico | 140 |
| ⚽ Esporte | Clássico | 125 |
| 🪀 Brinquedo | Clássico | 113 |
| 🏷️ Marca | Clássico | 149 |
| 🎨 Cor | Clássico | 107 |
| 🎤 Cantor ou banda | Clássico | 126 |
| 🏠 Meu vizinho é… | Clássico | 135 |
| 😈 Minha sogra é… | Clássico | 135 |
| 🐾 Animal | Clássico | 140 |
| 🎸 Instrumento musical | Clássico | 103 |
| 🏖️ Coisa de praia | Comida & festa | 110 |
| 🍳 Coisa da cozinha | Comida & festa | 126 |
| 👵 Coisa da casa da vó | Comida & festa | 110 |
| 🧺 Coisa da feira | Comida & festa | 127 |
| 🍲 Comida brasileira | Brasilzão | 112 |
| 🗯️ Gíria / internet | Brasilzão · nicho | 117 |
| 🎬 Filme ou série | Nicho / Nerd | 115 |
| 💻 Coisa de computador | Nicho / Nerd | 146 |
| 🎲 Termo de RPG/fantasia | Nicho / Nerd | 136 |
| 🚗 Peça de carro | Nicho / Nerd | 112 |

## Adicionar palavras (o jogo aprende com você)

Duas formas:

1. **Dentro do jogo** → *Dicionário* → digite a palavra, escolha a categoria → **Adicionar**.
   Ela passa a valer na hora, fica salva no aparelho e pode ser **exportada/importada** em `.json`.
2. **No código** → `www/js/data.js`, no formato `A: "Palavra 1|Palavra 2"`.
   Depois rode `npm run test:dados` para checar letra inicial, duplicatas e erros de digitação.

O passo a passo completo está em [`docs/COMO-ADICIONAR-PALAVRAS.md`](docs/COMO-ADICIONAR-PALAVRAS.md).

## Publicar de graça

- **Site/PWA:** ative `docs/workflows/pages.yml` (mesmo comando acima) e em
  *Settings → Pages* escolha **GitHub Actions**. O jogo fica em
  `https://SEU-USUARIO.github.io/SEU-REPO/`, instalável no celular e offline.
- **APK:** workflow `docs/workflows/android.yml` → artefato `stop-jogo-apk`.
- **Arch:** já é o caminho principal — veja o topo deste README.

## Estrutura

```
www/                  o jogo (é isso que vira site, PWA e APK)
├── index.html
├── css/style.css
├── js/data.js        dicionário e categorias  ← é aqui que você mexe
├── js/engine.js      regras: sorteio, validação, pontuação, dicas
├── js/app.js         telas, cronômetro, som, confete, navegação
├── sw.js            service worker (offline)
├── manifest.webmanifest
└── assets/           fontes Baloo 2/Nunito + ícones
arch/                 install.sh (sem root), launcher, .desktop e PKGBUILD
scripts/              testes e gerador de ícones
docs/workflows/       modelos de CI: APK (Android) e deploy da PWA (Pages)
```

## Testes

```bash
npm ci
npm test           # 29 verificações de interface com jsdom
npm run test:dados # valida o dicionário inteiro
```

## Privacidade

Nada sai do seu aparelho. Placar, ajustes e palavras novas ficam no `localStorage`;
não há analytics, conta ou chamada de rede.

## Licença

MIT — veja [`LICENSE`](LICENSE).
