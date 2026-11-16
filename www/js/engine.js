/* ============================================================
   STOP! — motor do jogo (regras, sorteio, pontuação, dicas)
   Sem dependências. Roda em qualquer navegador.
   ============================================================ */
window.STOP_ENGINE = (function () {
  var DATA = window.STOP_DATA;
  var CAT_BY_ID = {};
  DATA.CATS.forEach(function (c) { CAT_BY_ID[c.id] = c; });

  var ALFABETO = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  var DIFICEIS = ["K", "W", "X", "Y", "Z"];
  var CHAVE_CUSTOM = "stop.custom.v1";

  /* ---------- utilidades ---------- */
  function normalizar(txt) {
    return String(txt == null ? "" : txt)
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().replace(/\s+/g, " ").trim();
  }
  function semAcento(txt) { return normalizar(txt); }
  function capitalizar(txt) { return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : txt; }

  /* ---------- palavras extras criadas pelo jogador ---------- */
  function carregarCustom() {
    try { return JSON.parse(localStorage.getItem(CHAVE_CUSTOM) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function salvarCustom(obj) {
    try { localStorage.setItem(CHAVE_CUSTOM, JSON.stringify(obj)); } catch (e) {}
  }
  function adicionarPalavra(catId, bruta) {
    var palavra = String(bruta || "").trim().replace(/\s+/g, " ");
    if (palavra.length < 2) return { ok: false, motivo: "Escreva uma palavra de verdade 🙂" };
    if (!CAT_BY_ID[catId]) return { ok: false, motivo: "Categoria desconhecida" };
    var letra = normalizar(palavra).charAt(0).toUpperCase();
    if (ALFABETO.indexOf(letra) < 0) return { ok: false, motivo: "A palavra precisa começar com uma letra de A a Z" };

    var store = carregarCustom();
    var cat = store[catId] || (store[catId] = {});
    var lista = cat[letra] || (cat[letra] = []);
    var jaExiste = lista.some(function (w) { return normalizar(w) === normalizar(palavra); }) ||
      palavras(catId, letra, { semCustom: true }).some(function (w) { return normalizar(w) === normalizar(palavra); });
    if (jaExiste) return { ok: false, motivo: "Essa palavra já está no dicionário" };
    lista.push(palavra);
    salvarCustom(store);
    return { ok: true, letra: letra, palavra: palavra };
  }
  function removerPalavra(catId, palavra) {
    var store = carregarCustom();
    var letra = normalizar(palavra).charAt(0).toUpperCase();
    if (!store[catId] || !store[catId][letra]) return false;
    var antes = store[catId][letra].length;
    store[catId][letra] = store[catId][letra].filter(function (w) { return normalizar(w) !== normalizar(palavra); });
    if (!store[catId][letra].length) delete store[catId][letra];
    if (!Object.keys(store[catId] || {}).length) delete store[catId];
    salvarCustom(store);
    return store[catId] ? antes !== (store[catId][letra] || []).length : true;
  }
  function palavrasCustom(catId) {
    var store = carregarCustom();
    return (store && store[catId]) || {};
  }

  /* ---------- acesso ao dicionário ---------- */
  function categoria(catId) { return CAT_BY_ID[catId] || null; }
  function dictDaCategoria(cat) {
    if (!cat) return {};
    return cat.ref ? (DATA.DICS[cat.ref] || {}) : (cat.d || {});
  }
  function palavras(catId, letra, opcoes) {
    opcoes = opcoes || {};
    var cat = categoria(catId);
    if (!cat) return [];
    var L = String(letra || "").toUpperCase();
    var base = dictDaCategoria(cat)[L];
    var lista = base ? base.split("|").map(function (w) { return w.trim(); }).filter(Boolean) : [];
    if (!opcoes.semCustom) {
      var extra = palavrasCustom(catId)[L] || [];
      extra.forEach(function (w) { if (lista.indexOf(w) < 0) lista.push(w); });
    }
    return lista;
  }
  function totalDePalavras() {
    var total = 0;
    DATA.CATS.forEach(function (c) {
      var dict = dictDaCategoria(c);
      Object.keys(dict).forEach(function (L) {
        total += dict[L].split("|").filter(Boolean).length;
      });
    });
    return total;
  }
  function totalPalavrasCategoria(catId) {
    var cat = categoria(catId), dict = dictDaCategoria(cat), total = 0;
    Object.keys(dict).forEach(function (L) { total += dict[L].split("|").filter(Boolean).length; });
    Object.keys(palavrasCustom(catId)).forEach(function (L) { total += (palavrasCustom(catId)[L] || []).length; });
    return total;
  }
  function letrasComPalavras(catId) {
    var cat = categoria(catId), dict = dictDaCategoria(cat);
    return ALFABETO.filter(function (L) { return dict[L] && dict[L].trim(); });
  }

  /* ---------- validação de uma palavra ---------- */
  function comecaCom(palavra, letra) {
    return normalizar(palavra).charAt(0) === String(letra).toLowerCase();
  }
  function classificar(catId, palavra, letra) {
    var txt = String(palavra || "").trim();
    if (!txt) return { status: "vazia", base: 0, normalizada: "" };
    var norm = normalizar(txt);
    if (norm.length < 2) return { status: "invalida", base: 0, motivo: "curta", normalizada: norm };
    if (!comecaCom(txt, letra)) return { status: "invalida", base: 0, motivo: "letra", normalizada: norm };

    var doDicionario = palavras(catId, letra).some(function (w) { return normalizar(w) === norm; });
    if (doDicionario) return { status: "dicionario", base: 10, normalizada: norm };
    var custom = palavrasCustom(catId)[String(letra).toUpperCase()] || [];
    var ehPropria = (custom || []).some(function (w) { return normalizar(w) === norm; });
    if (ehPropria) return { status: "propria", base: 10, normalizada: norm };
    return { status: "nao-verificada", base: 5, normalizada: norm };
  }

  /* ---------- sorteio da letra ---------- */
  function universoDeLetras(opcoes) {
    opcoes = opcoes || {};
    var universo = ALFABETO.slice();
    if (Array.isArray(opcoes.apenas) && opcoes.apenas.length) {
      universo = universo.filter(function (L) { return opcoes.apenas.indexOf(L) >= 0; });
    }
    if (opcoes.incluirDificeis === false) {
      universo = universo.filter(function (L) { return DIFICEIS.indexOf(L) < 0; });
    }
    return universo.length ? universo : ALFABETO.slice();
  }
  function sortearLetra(opcoes) {
    opcoes = opcoes || {};
    var universo = universoDeLetras(opcoes);
    var evitar = (opcoes.evitar || []).map(function (l) { return String(l).toUpperCase(); });
    var candidatas = universo.filter(function (L) { return evitar.indexOf(L) < 0; });
    if (!candidatas.length) candidatas = universo;
    return candidatas[Math.floor(Math.random() * candidatas.length)];
  }
  function roleta(opcoes) {
    // sequência de letras para a animação da roleta (termina na sorteada)
    var final = sortearLetra(opcoes);
    var universo = universoDeLetras(opcoes);
    var passos = 16 + Math.floor(Math.random() * 8);
    var seq = [];
    for (var i = 0; i < passos; i++) {
      seq.push(universo[Math.floor(Math.random() * universo.length)]);
    }
    seq.push(final);
    return { letra: final, sequencia: seq };
  }

  /* ---------- dica ---------- */
  function mascarar(palavra) {
    var letras = palavra.split("");
    return letras.map(function (ch, i) {
      if (ch === " " || ch === "-") return ch;
      if (i < 2) return ch;
      return "•";
    }).join(" ");
  }
  function dica(catId, letra, evitar) {
    var usadas = (evitar || []).map(normalizar);
    var lista = palavras(catId, letra).filter(function (w) { return usadas.indexOf(normalizar(w)) < 0; });
    if (!lista.length) lista = palavras(catId, letra);
    if (!lista.length) return null;
    // prefere palavras mais "curiosas": tamanho médio, sem repetir as já usadas
    var escolhida = lista[Math.floor(Math.random() * lista.length)];
    return {
      palavra: escolhida,
      inicio: escolhida.slice(0, 2),
      tamanho: escolhida.replace(/\s/g, "").length,
      mascara: mascarar(escolhida)
    };
  }

  /* ---------- pontuação da rodada ---------- */
  var CUSTO_DICA = 6;
  var BONUS_LONGA = 2;
  var TAMANHO_LONGA = 9;

  function avaliar(rodada) {
    var letra = rodada.letra;
    var catIds = rodada.categorias;
    var jogadores = rodada.jogadores || [];

    // mapa de repetições: "catId|palavra" -> quantidade de jogadores
    var contagem = {};
    jogadores.forEach(function (j) {
      catIds.forEach(function (catId) {
        var resp = (j.respostas || {})[catId] || {};
        var cls = classificar(catId, resp.palavra, letra);
        if (cls.base > 0) {
          var chave = catId + "|" + cls.normalizada;
          contagem[chave] = (contagem[chave] || 0) + 1;
        }
      });
    });

    var resultado = { letra: letra, categorias: catIds, jogadores: [], ranking: [] };

    jogadores.forEach(function (j) {
      var itens = [], total = 0, acertos = 0;
      catIds.forEach(function (catId) {
        var cat = categoria(catId) || { nome: catId, emoji: "❔" };
        var resp = (j.respostas || {})[catId] || {};
        var palavra = (resp.palavra || "").trim();
        var usouDica = !!resp.dica;
        var cls = classificar(catId, palavra, letra);
        var base = cls.base;
        var bonus = 0, motivo = "";
        var repetida = 0;

        if (base > 0) {
          var chave = catId + "|" + cls.normalizada;
          repetida = (contagem[chave] || 1) - 1;
          if (repetida > 0) {
            base = Math.floor(base / 2);
            motivo = "repetida com outro jogador";
          }
          if (normalizar(palavra).replace(/\s/g, "").length >= TAMANHO_LONGA) {
            bonus = BONUS_LONGA;
          }
          acertos++;
        }

        var custoDica = usouDica ? CUSTO_DICA : 0;
        var pontos = Math.max(0, base + bonus - custoDica);
        total += pontos;

        itens.push({
          catId: catId,
          nome: cat.nome,
          emoji: cat.emoji,
          palavra: palavra,
          pontos: pontos,
          base: cls.base,
          bonus: bonus,
          custoDica: custoDica,
          status: cls.status,
          motivo: motivo,
          repetida: repetida,
          dica: usouDica
        });
      });
      resultado.jogadores.push({ nome: j.nome, total: total, acertos: acertos, itens: itens });
    });

    // ranking
    var ordenado = resultado.jogadores.slice().sort(function (a, b) { return b.total - a.total; });
    ordenado.forEach(function (j, i) {
      var empate = i > 0 && ordenado[i - 1].total === j.total;
      j.posicao = empate ? ordenado[i - 1].posicao : i + 1;
    });
    resultado.ranking = ordenado;

    // tabela por categoria (para a tela de resultado)
    resultado.tabela = catIds.map(function (catId) {
      var cat = categoria(catId) || { nome: catId, emoji: "❔" };
      return {
        catId: catId,
        nome: cat.nome,
        emoji: cat.emoji,
        celulas: resultado.jogadores.map(function (j) {
          var item = j.itens.filter(function (i) { return i.catId === catId; })[0];
          return { jogador: j.nome, palavra: item.palavra, pontos: item.pontos, status: item.status, repetida: item.repetida > 0 };
        })
      };
    });

    return resultado;
  }

  function sugestoesDeDica(catId, letra, quantidade) {
    var lista = palavras(catId, letra).slice();
    var out = [];
    quantidade = quantidade || 3;
    while (lista.length && out.length < quantidade) {
      out.push(lista.splice(Math.floor(Math.random() * lista.length), 1)[0]);
    }
    return out;
  }

  return {
    ALFABETO: ALFABETO,
    DIFICEIS: DIFICEIS,
    CUSTO_DICA: CUSTO_DICA,
    BONUS_LONGA: BONUS_LONGA,
    TAMANHO_LONGA: TAMANHO_LONGA,
    categorias: DATA.CATS,
    packs: DATA.PACKS,
    categoria: categoria,
    normalizar: normalizar,
    capitalizar: capitalizar,
    palavras: palavras,
    palavrasCustom: palavrasCustom,
    adicionarPalavra: adicionarPalavra,
    removerPalavra: removerPalavra,
    totalDePalavras: totalDePalavras,
    totalPalavrasCategoria: totalPalavrasCategoria,
    letrasComPalavras: letrasComPalavras,
    comecaCom: comecaCom,
    classificar: classificar,
    universoDeLetras: universoDeLetras,
    sortearLetra: sortearLetra,
    roleta: roleta,
    dica: dica,
    sugestoesDeDica: sugestoesDeDica,
    avaliar: avaliar
  };
})();
