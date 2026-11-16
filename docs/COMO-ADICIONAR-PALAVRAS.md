# Como adicionar palavras e categorias

O dicionário vive em **`www/js/data.js`**. É só texto — sem banco de dados, sem build.

## Adicionar palavras a uma categoria existente

Abra `www/js/data.js` e encontre a categoria, por exemplo:

```js
{ id: "objeto", nome: "Objeto", emoji: "📦", pack: "classico", d: {
  A: "Abajur|Agulha|Alfinete",
  B: "Balde|Bola",
  ...
}},
```

Regras:

- A **chave** é a letra, sempre maiúscula (`A` até `Z`).
- As palavras são separadas por **`|`** (barra vertical).
- Acentos são permitidos (`África`, `Órgão`). O jogo ignora acentos na hora de comparar.
- **A palavra precisa começar com a letra da chave.** `npm run test:dados` avisa se errar.
- Pode usar apóstrofo (`McDonald's`) e hífen (`Papua-Nova Guiné`).
- Não repita a mesma palavra na mesma letra (o teste também avisa).
- Se a categoria não tiver palavra para uma letra, simplesmente não crie aquela chave.

Depois de editar:

```bash
npm run test:dados   # valida tudo: letra inicial, duplicatas, palavras vazias
npm test             # confere se a interface continua funcionando
```

## Criar uma categoria nova

1. Escolha um `id` curto e único (sem espaços): `"carnaval"`.
2. Adicione o objeto em `CATS`, dentro do arquivo:

```js
{ id: "carnaval", nome: "Coisa de carnaval", emoji: "🎭", pack: "brasil", nicho: true, d: {
  A: "Abadá|Alegoria|Axé",
  B: "Bloco|Bateria|Baiana",
  C: "Confete|Cordão|Cuíca|Camarote",
  ...
}},
```

Campos:

| Campo | Para que serve |
| --- | --- |
| `id` | identificador interno (não mude depois de publicar: quebra palavras salvas) |
| `nome` | o que aparece na ficha e no placar |
| `emoji` | ícone da categoria |
| `pack` | agrupamento no seletor: `classico`, `comida`, `brasil` ou `nerd` |
| `nicho` | `true` mostra o selo **nicho** (categorias mais específicas) |
| `obs` | texto pequeno ao lado do nome (ex.: *"vale qualquer adjetivo"*) |
| `d` | o dicionário de palavras |
| `ref` | use no lugar de `d` para reaproveitar outro dicionário, como `ref: "adjetivos"` |

3. Se quiser um pacote novo (além de Clássico / Comida & festa / Brasilzão / Nicho / Nerd),
   adicione em `PACKS`:

```js
{ id: "esportes", nome: "Esportes", emoji: "🏅" }
```

## Dicas e validação

A dica sorteia uma palavra **do dicionário daquela letra**. Se você adicionar mais palavras,
as dicas ficam mais ricas automaticamente. Categorias sem nenhuma palavra naquela letra
mostram o aviso *"essa categoria não tem dica para a letra X"*.

Já a resposta do jogador é aceita como **"vale conferir"** quando não está no dicionário —
ela vale 5 pontos em vez de 10. Ou seja: o jogo nunca bloqueia uma palavra boa que ainda não conhece.

## Palavras criadas pelos jogadores

Quem usa o app pode adicionar palavras pela tela **Dicionário**. Elas ficam no `localStorage`
do aparelho, separadas do `data.js`, e podem ser exportadas em `.json`
(**Ajustes → Minhas palavras → Exportar**). Para incorporar essas palavras ao repositório,
basta copiá-las para o `data.js` da categoria correspondente.
