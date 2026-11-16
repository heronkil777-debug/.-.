/* Teste de fumaça da interface: carrega o jogo em um DOM simulado,
   sorteia letra, preenche campos, usa dica e confere o resultado. */
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const RAIZ = path.join(__dirname, "..");
const ler = (p) => fs.readFileSync(path.join(RAIZ, p), "utf8");

let falhas = 0;
function ok(cond, msg) {
  if (cond) console.log("  ✓ " + msg);
  else { console.log("  ✗ " + msg); falhas++; }
}

const html = ler("www/index.html").replace(/<script[\s\S]*?<\/script>/g, "");
const dom = new JSDOM(html, { url: "http://localhost/", runScripts: "outside-only", pretendToBeVisual: true });
const { window } = dom;
window.eval(ler("www/js/data.js"));
window.eval(ler("www/js/engine.js"));
window.eval(ler("www/js/app.js"));

const doc = window.document;
const app = () => doc.getElementById("app");
const clicar = (sel) => {
  const el = app().querySelector(sel) || doc.querySelector(sel);
  if (!el) throw new Error("elemento não encontrado: " + sel);
  el.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
};
const digitar = (sel, valor) => {
  const el = app().querySelector(sel);
  if (!el) throw new Error("campo não encontrado: " + sel);
  el.value = valor;
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  console.log("1) tela inicial");
  ok(app().textContent.includes("SORTEAR LETRA"), "botão de sorteio aparece");
  ok(doc.querySelector(".letra-display").textContent === "?", "letra começa vazia");
  ok(app().textContent.includes("Jogadores"), "atalho de jogadores aparece");

  console.log("2) navegação");
  clicar('[data-acao="ir:jogadores"]');
  ok(app().textContent.includes("Quem vai jogar?"), "tela de jogadores abre");
  clicar('[data-acao="modo"][data-val="festa"]');
  ok(doc.querySelectorAll("input[data-nome]").length >= 2, "modo festa tem 2+ campos de nome");
  digitar('input[data-nome="0"]', "Heron");
  digitar('input[data-nome="1"]', "Bia");
  clicar('[data-acao="tempo"][data-val="60"]');
  clicar('[data-acao="ir:home"]');
  ok(app().textContent.includes("Heron") || app().textContent.includes("2 jogadores"), "resumo mostra 2 jogadores");

  clicar('[data-acao="ir:categorias"]');
  ok(app().textContent.includes("Monte sua rodada"), "tela de categorias abre");
  ok(doc.querySelectorAll('[data-acao="toggle-cat"]').length >= 20, "todas as categorias listadas");
  clicar('[data-acao="cats:sugeridas"]');
  clicar('[data-acao="toggle-cat"][data-val="rpg"]');
  ok(doc.querySelector('[data-acao="toggle-cat"][data-val="rpg"]').getAttribute("aria-pressed") === "true", "categoria nicho pode ser ativada");
  clicar('[data-acao="ir:home"]');

  console.log("3) dicionário");
  clicar('[data-acao="ir:dicionario"]');
  ok(app().textContent.includes("Adicionar palavra"), "tela de dicionário abre");
  digitar("#busca-dic", "xícara");
  ok(doc.getElementById("dic-lista").textContent.includes("Xícara"), "busca encontra Xícara");
  digitar("#busca-dic", "");
  clicar('[data-acao="dic-letra"][data-val="Q"]');
  ok(doc.getElementById("dic-lista").textContent.length > 0, "filtro por letra Q mostra palavras");
  const sel = doc.getElementById("dic-categoria");
  sel.value = "objeto";
  const campo = doc.getElementById("dic-nova");
  campo.value = "Quinquilharia";
  clicar('[data-acao="dic-adicionar"]');
  ok(window.STOP_ENGINE.palavras("objeto", "Q").includes("Quinquilharia"), "palavra nova entra no dicionário");
  clicar('[data-acao="ir:home"]');

  console.log("4) rodada (sorteio + preenchimento)");
  clicar('[data-acao="sorteio"]');
  await esperar(3200);
  const letraEl = doc.querySelector(".letra-pill strong");
  ok(!!letraEl, "tela de rodada abriu após o sorteio");
  const letra = letraEl.textContent.trim();
  console.log("     letra sorteada:", letra);
  const campos = Array.from(doc.querySelectorAll('input[data-campo="palavra"]'));
  ok(campos.length >= 3, "campos de categoria renderizados (" + campos.length + ")");

  const Engine = window.STOP_ENGINE;
  // escolhe categorias que tenham palavras válidas para a letra sorteada
  const comPalavras = campos.map((c) => c.getAttribute("data-cat")).filter((id) => Engine.palavras(id, letra).length > 0);
  ok(comPalavras.length >= 1, "há categorias com palavras para a letra " + letra);

  // dica numa categoria que tem dicionário
  const catDica = comPalavras[0];
  clicar('[data-acao="dica"][data-val="' + catDica + '"]');
  ok(doc.querySelector(".dica-texto") !== null, "dica aparece na tela");

  const cat2 = comPalavras[1] || comPalavras[0];
  const palavra = Engine.palavras(cat2, letra)[0] || (letra + "teste");
  digitar('input[data-cat="' + cat2 + '"]', palavra);
  const linha = doc.querySelector('[data-linha="' + cat2 + '"]');
  ok(linha.classList.contains("ok"), "palavra do dicionário fica marcada como válida");

  const feitos = doc.querySelectorAll('input[data-campo="palavra"]').length;
  ok(feitos === campos.length, "todos os campos continuam na tela");

  clicar('[data-acao="parar"]');
  await esperar(120);
  ok(app().textContent.includes("Passe o celular"), "modo festa passa o celular para o 2º jogador");
  clicar('[data-acao="proximo-turno"]');
  await esperar(60);
  const campos2 = Array.from(doc.querySelectorAll('input[data-campo="palavra"]'));
  ok(campos2.length === campos.length, "2º jogador recebe a mesma ficha");
  const palavra2 = Engine.palavras(cat2, letra)[1] || palavra;
  digitar('input[data-cat="' + cat2 + '"]', palavra2);
  clicar('[data-acao="parar"]');
  await esperar(200);

  console.log("5) resultado");
  ok(app().textContent.includes("Resultado"), "tela de resultado abriu");
  ok(doc.querySelectorAll(".podio-linha").length >= 2, "pódio com os dois jogadores");
  ok(app().textContent.includes("Palavras da rodada"), "tabela de palavras presente");
  const seusPontos = doc.querySelectorAll(".podio-linha .total").length;
  ok(seusPontos >= 2, "pontuação calculada");

  console.log("6) ajustes");
  clicar('[data-acao="ir:home"]');
  clicar('[data-acao="ir:ajustes"]');
  ok(app().textContent.includes("Letras do sorteio"), "tela de ajustes abre");
  const antes = doc.querySelector('[data-acao="toggle-letra"][data-val="A"]').getAttribute("aria-pressed");
  clicar('[data-acao="toggle-letra"][data-val="A"]');
  const depois = doc.querySelector('[data-acao="toggle-letra"][data-val="A"]').getAttribute("aria-pressed");
  ok(antes !== depois, "letra pode ser tirada da roleta");
  clicar('[data-acao="toggle:som"]');
  ok(doc.querySelector('[data-acao="toggle:som"]').getAttribute("aria-checked") === "false", "som desliga");
  clicar('[data-acao="toggle:som"]');
  clicar('[data-acao="toggle:tema"]');
  ok(doc.body.getAttribute("data-tema") === "escuro", "tema escuro aplica");
  clicar('[data-acao="como"]');
  ok(doc.querySelector(".modal") !== null, "modal de instruções abre");
  clicar("[data-acao='fechar-modal']");
  ok(doc.querySelector(".modal") === null, "modal fecha");

  console.log(falhas === 0 ? "\nTUDO CERTO ✅" : "\n" + falhas + " FALHA(S) ❌");
  process.exit(falhas === 0 ? 0 : 1);
})().catch((e) => { console.error("ERRO NO TESTE:", e); process.exit(1); });
