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

## Jogar agora

```bash
# 1) só abrir (funciona offline, sem instalar nada)
xdg-open www/index.html

# 2) ou com servidor local (recomendado: ativa o modo offline/PWA)
npm start          # http://localhost:8080
```

No celular: abra o endereço no navegador → menu → **"Adicionar à tela inicial"**.
Fica com ícone próprio, tela cheia e funciona offline.

## Arch Linux

Pacote nativo (arquivos em `/usr/share/stop-jogo`, comando `stop-jogo` e entrada no menu):

```bash
cd arch
makepkg -si          # instala
stop-jogo            # abre no navegador padrão
stop-jogo --parar    # encerra o servidor local
```

Depende de `python` (serve os arquivos em `127.0.0.1`) e `xdg-utils` (abre o navegador).
Para desinstalar: `sudo pacman -R stop-jogo`.

## APK Android

O APK é gerado **na nuvem pelo GitHub Actions** (o projeto usa [Capacitor](https://capacitorjs.com/),
que empacota o mesmo jogo dentro de um app Android de verdade):

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
arch/                 PKGBUILD, launcher e .desktop (Arch Linux)
scripts/              testes e gerador de ícones
.github/workflows/    APK (Android) e deploy da PWA (Pages)
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
