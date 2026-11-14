# ÚLTIMO SINAL

**O silêncio não significa que você está sozinho.**

Uma experiência narrativa de investigação orbital, em português. Você é a última pessoa acordada a bordo da Íris–9. Uma transmissão desconhecida chegou da órbita. Restaure cinco sistemas, recupere seus registros e decida o que fazer com a verdade.

Não é uma landing page: é um pequeno jogo completo, com cinco mecânicas interativas, uma história em etapas e três desfechos diferentes.

## Jogar

Requer **Node.js 22.12+** e npm.

```bash
npm ci
npm run dev
```

Abra `http://localhost:5173`. O servidor escuta em `0.0.0.0` e aceita o host do preview da Arena.

- **Assumir o turno:** investigação normal, com duas pistas opcionais por sistema.
- **Modo apresentação:** percurso assistido para demonstrar o projeto em poucos minutos. O botão de assistência restaura o sistema atual; a decisão final continua sendo do jogador.
- **Ligar áudio:** ativa a paisagem sonora original, sintetizada com Web Audio. O áudio nunca começa automaticamente.
- **Ajuda e opções:** manual, som e movimento reduzido.

Uma partida normal leva aproximadamente 10–15 minutos. Não há contagem regressiva, vidas, publicidade, login ou penalidade por tentar.

## Os cinco sistemas

| Sistema                 | Mecânica                                                                             | O que revela           |
| ----------------------- | ------------------------------------------------------------------------------------ | ---------------------- |
| Rede de escuta          | Sintonizar frequência e amplificação; acompanhar a coerência e a forma de onda       | A origem da voz        |
| Barramento de energia   | Girar oito peças para fechar um circuito real, com propagação de energia peça a peça | O estado da tripulação |
| Arquivo cifrado         | Três rotores de deslocamento com prévia de decodificação                             | Seu último registro    |
| Autenticação biométrica | Observar um eco de seis pulsos e reproduzir a sequência                              | Por que você esqueceu  |
| Alinhamento orbital     | Mirar no mapa celeste ou ajustar azimute e elevação                                  | Quem está esperando    |

Os módulos são desbloqueados em sequência. Cada solução adiciona uma evidência ao diário. Depois dos cinco sistemas, o canal de resposta oferece três escolhas, com epílogos próprios. É possível voltar e explorar outros finais sem refazer os puzzles.

## Acessibilidade e controles

- Controles nativos, rótulos em português, foco visível e navegação por teclado.
- Sliders aceitam setas, Home e End; botões de ajuste fino complementam a sintonia.
- O eco biométrico pode ser acompanhado por som, destaque visual ou **Ler sequência**. Não é necessário ouvir nem memorizar para jogar.
- Teclas **1–4** nos sensores biométricos; **M** abre o mapa; **J** abre o diário; **?** abre a ajuda; **Esc** fecha janelas.
- Diálogos usam `<dialog>` nativo, contenção explícita de foco e retorno de foco ao fechar.
- Preferência do sistema por movimento reduzido respeitada, com opção de ajuste manual.
- Layout responsivo: mapa e diário viram janelas no celular, sem esconder as pistas.
- Verificações automatizadas axe-core para WCAG 2.1 A/AA nas telas principais. Isso não substitui uma auditoria manual completa de acessibilidade.

## Persistência e privacidade

O progresso, os ajustes dos puzzles, as pistas e o tempo de turno são salvos em `localStorage`, sob `ultimo-sinal:mission:v1`. Recarregar a página retoma a missão diretamente. Os finais descobertos ficam em `ultimo-sinal:desfechos`; a preferência de movimento em `ultimo-sinal:motion`.

- Saves são versionados e validados; dados corrompidos não impedem jogar.
- Se o navegador bloquear o armazenamento, o jogo continua em memória e mostra um aviso.
- O diário pode ser baixado como `.txt` antes de reiniciar ou depois de um final.
- Nenhum progresso é enviado a servidores. Não há analytics, backend, API paga ou contas.
- Fontes, cenário e código são servidos pelo próprio app; não há CDN em tempo de execução.
- Não há service worker: a primeira abertura requer acesso ao servidor que hospeda os arquivos.

## Verificação

```bash
npm test          # 28 testes unitários das regras, puzzles, progressão e saves
npm run build     # checagem TypeScript + build de produção
npm run test:e2e  # Playwright: fluxos completos, celular, teclado, áudio e axe-core
npm run check     # todos os comandos acima
```

Os testes de navegador usam Chromium empacotado via npm (`@sparticuz/chromium`). As bibliotecas NSS/NSPR incluídas no pacote são extraídas para `/tmp`; não é preciso baixar navegador de uma CDN nem instalar pacotes do sistema. O servidor de desenvolvimento é iniciado automaticamente se ainda não estiver rodando.

Se o npm instalado apresentar o erro de resolução de peers `Cannot read properties of null (reading 'edgesOut')`, use `npm ci --legacy-peer-deps` ou `npm install --legacy-peer-deps`. O lockfile está incluído. A suíte foi executada com Node 22 e Chromium 153.

Capturas de revisão ficam em `artifacts/` e não são versionadas. Falhas e traces de testes ficam em `test-results/`, também fora do Git.

## Produção

```bash
npm run build
npm run preview
```

Publique o conteúdo de `dist/` em qualquer hospedagem estática. O preview de produção usa a porta 4173. Não há variáveis de ambiente nem segredos para configurar.

## Estrutura

```text
src/
  game.ts                 # dados narrativos, regras puras, progressão e validação de saves
  audio.ts                # ambiência e efeitos originais via Web Audio
  App.tsx                 # abertura, estação, preferências e epílogos
  styles.css              # direção visual e layouts responsivos
  components/
    Puzzles.tsx           # cinco mecânicas e assistência da apresentação
    Visuals.tsx           # mapa da estação, marca e osciloscópio em canvas
    Journal.tsx           # pistas, evidências, escolhas e exportação do diário
    Modal.tsx             # diálogos acessíveis
public/assets/
  orbital-earth.webp      # cenário orbital otimizado
  orbital-earth.jpg       # imagem original gerada para o projeto
tests/
  game.test.ts
  e2e/experience.spec.ts
  e2e/accessibility.spec.ts
```

## Créditos e escopo

React, TypeScript, Vite, Lucide e fontes locais Space Grotesk, Manrope e IBM Plex Mono. As fontes são distribuídas sob SIL Open Font License; suas licenças estão em `public/licenses/`.

O cenário foi criado com IA para este projeto. Interface, narrativa, trilho sonoro procedural e efeitos foram implementados para a experiência. A estação, a missão e a telemetria são ficcionais.

**Não incluído:** multiplayer, contas, sincronização entre dispositivos, narração falada ou integração com serviços externos. O jogo funciona inteiramente no navegador e não precisa desses serviços.

---

**Fim da transmissão. Não da história.**
