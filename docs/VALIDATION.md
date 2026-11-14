# Validação da entrega

Verificado em 14 de novembro de 2026, no ambiente Linux da Arena, com Node.js 22.22.3 e Chromium 153.

## Suíte automatizada

`npm run check` executa:

1. Verificação de formatação.
2. 28 testes unitários de regras, circuitos, cifra, biometria, progressão, três finais e validação de saves.
3. TypeScript com checagem de variáveis não utilizadas e build de produção.
4. 10 testes de navegador, incluindo auditorias axe-core WCAG 2.1 A/AA nas telas principais, estados restaurados, escolha final e confirmação.

**Resultado: 28 testes unitários e 10 testes de navegador aprovados.**

Os fluxos de navegador resolvem os cinco puzzles pelos controles reais, testam respostas incorretas, reproduzem o eco biométrico, conferem a sequência textual, salvam e recarregam a missão, percorrem os três finais, exportam o diário, cancelam e confirmam o reinício e verificam o modo apresentação. Também cobrem armazenamento corrompido/indisponível, áudio opt-in, movimento reduzido, foco de diálogos e ausência de overflow no celular.

## Revisão visual e responsiva

Capturas revisadas da abertura, estação, circuito, biometria, escolha final, epílogo e versão mobile. Além do teste de 390 px, uma varredura Chromium verificou abertura, cinco puzzles, estados restaurados, escolha e epílogo nas larguras:

`320, 375, 390, 560, 768, 800, 1024, 1280, 1440, 1920 px`

**Overflow horizontal: 0 px em todas as telas e larguras verificadas.**

Na revisão de rede, a aplicação não fez requisições externas nem registrou erros JavaScript. Fontes e cenário são locais; o áudio é sintetizado no navegador.

## Limites da verificação

- Testes automatizados de acessibilidade não equivalem a uma certificação WCAG nem substituem testes com usuários de leitores de tela.
- A revisão de navegador foi feita em Chromium; não foi executada uma matriz real de Safari/Firefox/dispositivos físicos.
- O jogo não tem backend e não foi publicado em um domínio externo. O preview da Arena serve a aplicação diretamente do ambiente de desenvolvimento.
- O cenário é ficcional e gerado por IA. Não há serviço de voz, analytics ou API externa para configurar.
