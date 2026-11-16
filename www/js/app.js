/* ============================================================
   STOP! — interface e fluxo do jogo
   ============================================================ */
(function () {
  "use strict";

  var E = window.STOP_ENGINE;
  var app = document.getElementById("app");
  var toastEl = document.getElementById("toast");

  var CHAVE_CFG = "stop.cfg.v1";
  var CHAVE_STATS = "stop.stats.v1";

  var CATS_SUGERIDAS = ["pais", "nome", "objeto", "profissao", "esporte", "praia", "cozinha", "cantor", "animal", "marca", "cor", "sogra"];

  var CFG_PADRAO = {
    modo: "solo",
    nomes: ["Você", "Bia"],
    tempo: 120,
    categorias: CATS_SUGERIDAS.slice(),
    incluirDificeis: true,
    letrasFora: [],
    som: true,
    tema: "claro"
  };

  /* ---------------- utilidades ---------------- */
  function esc(txt) {
    return String(txt == null ? "" : txt).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function formatarTempo(seg) {
    if (seg == null) return "∞";
    seg = Math.max(0, Math.round(seg));
    var m = Math.floor(seg / 60), s = seg % 60;
    return m + ":" + (s < 10 ? "0" : "") + s;
  }
  function plural(n, sing, plur) { return n === 1 ? sing : (plur || sing + "s"); }

  var toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("mostra");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove("mostra"); }, 2600);
  }

  /* ---------------- armazenamento ---------------- */
  function carregarCfg() {
    try {
      var salvo = JSON.parse(localStorage.getItem(CHAVE_CFG) || "null");
      if (!salvo) return clone(CFG_PADRAO);
      var cfg = Object.assign(clone(CFG_PADRAO), salvo);
      if (!Array.isArray(cfg.categorias) || !cfg.categorias.length) cfg.categorias = CFG_PADRAO.categorias.slice();
      cfg.categorias = cfg.categorias.filter(function (id) { return !!E.categoria(id); });
      if (!Array.isArray(cfg.nomes) || !cfg.nomes.length) cfg.nomes = CFG_PADRAO.nomes.slice();
      return cfg;
    } catch (e) { return clone(CFG_PADRAO); }
  }
  function salvarCfg() {
    try { localStorage.setItem(CHAVE_CFG, JSON.stringify(estado.cfg)); } catch (e) {}
  }
  function carregarStats() {
    try { return Object.assign({ rodadas: 0, melhor: 0, palavras: 0 }, JSON.parse(localStorage.getItem(CHAVE_STATS) || "{}")); }
    catch (e) { return { rodadas: 0, melhor: 0, palavras: 0 }; }
  }
  function salvarStats(stats) {
    try { localStorage.setItem(CHAVE_STATS, JSON.stringify(stats)); } catch (e) {}
  }

  /* ---------------- som ---------------- */
  var audioCtx = null;
  function contextoAudio() {
    if (!audioCtx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      audioCtx = new AC();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }
  function bipo(freq, dur, tipo, vol, atraso) {
    var ctx = contextoAudio();
    if (!ctx) return;
    var t0 = ctx.currentTime + (atraso || 0);
    var osc = ctx.createOscillator();
    var ganho = ctx.createGain();
    osc.type = tipo || "sine";
    osc.frequency.setValueAtTime(freq, t0);
    ganho.gain.setValueAtTime(0.0001, t0);
    ganho.gain.exponentialRampToValueAtTime(vol == null ? 0.14 : vol, t0 + 0.012);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(ganho).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  function som(tipo) {
    if (!estado.cfg.som) return;
    if (tipo === "toque") bipo(620, 0.07, "triangle", 0.1);
    else if (tipo === "tick") bipo(880, 0.035, "square", 0.045);
    else if (tipo === "letra") { bipo(520, 0.09, "triangle", 0.1); bipo(780, 0.12, "triangle", 0.1, 0.07); }
    else if (tipo === "dica") { bipo(700, 0.06, "sine", 0.09); bipo(560, 0.08, "sine", 0.08, 0.06); }
    else if (tipo === "stop") { bipo(420, 0.12, "square", 0.1); bipo(300, 0.2, "square", 0.1, 0.1); }
    else if (tipo === "erro") bipo(150, 0.2, "sawtooth", 0.07);
    else if (tipo === "vitoria") {
      [523, 659, 784, 1046].forEach(function (f, i) { bipo(f, 0.22, "triangle", 0.1, i * 0.1); });
    }
  }

  /* ---------------- estado ---------------- */
  var estado = {
    tela: "home",
    cfg: carregarCfg(),
    stats: carregarStats(),
    sessao: null,
    jogo: null,
    resultado: null,
    dic: { letra: "", busca: "", categoria: "" },
    instalar: null
  };

  function iniciarSessao() {
    var nomes = nomesAtivos();
    estado.sessao = {
      rodada: 0,
      letras: [],
      jogadores: nomes.map(function (n) { return { nome: n, pontos: 0 }; })
    };
  }
  function nomesAtivos() {
    var nomes = (estado.cfg.nomes || []).map(function (n) { return String(n || "").trim(); }).filter(Boolean);
    if (!nomes.length) nomes = ["Você"];
    return estado.cfg.modo === "solo" ? nomes.slice(0, 1) : nomes.slice(0, 6).length >= 2 ? nomes.slice(0, 6) : nomes.concat(["Jogador 2"]).slice(0, 2);
  }

  /* ---------------- confete ---------------- */
  var confeteAtivo = false;
  function confete() {
    var cv = document.getElementById("confetti");
    if (!cv || !cv.getContext) return;
    var ctx = cv.getContext("2d");
    if (!ctx) return;
    var L = (cv.width = window.innerWidth * devicePixelRatio);
    var A = (cv.height = window.innerHeight * devicePixelRatio);
    ctx.scale(devicePixelRatio, devicePixelRatio);
    var cores = ["#f6c453", "#b8234a", "#2f8f5b", "#ffffff", "#2b6cb0", "#e0335f"];
    var particulas = [];
    for (var i = 0; i < 130; i++) {
      particulas.push({
        x: Math.random() * window.innerWidth,
        y: -Math.random() * window.innerHeight * 0.4,
        vx: (Math.random() - 0.5) * 2.6,
        vy: 2 + Math.random() * 4,
        g: 0.035 + Math.random() * 0.03,
        w: 4 + Math.random() * 7,
        h: 6 + Math.random() * 10,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 0.2,
        cor: cores[(Math.random() * cores.length) | 0]
      });
    }
    var inicio = performance.now();
    confeteAtivo = true;
    function quadro(t) {
      if (!confeteAtivo) return;
      var passado = t - inicio;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      particulas.forEach(function (p) {
        p.vy += p.g * 16;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.cor;
        ctx.globalAlpha = Math.max(0, 1 - passado / 3600);
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      });
      if (passado < 3800) requestAnimationFrame(quadro);
      else { ctx.clearRect(0, 0, window.innerWidth, window.innerHeight); confeteAtivo = false; }
    }
    requestAnimationFrame(quadro);
  }

  /* ---------------- navegação ---------------- */
  function ir(tela) {
    if (estado.tela === "rodada" && tela !== "rodada" && tela !== "passe") pararCronometro();
    estado.tela = tela;
    render();
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
  }

  function render() {
    switch (estado.tela) {
      case "home": htmlHome(); break;
      case "jogadores": htmlJogadores(); break;
      case "categorias": htmlCategorias(); break;
      case "ajustes": htmlAjustes(); break;
      case "dicionario": htmlDicionario(); break;
      case "rodada": htmlRodada(); break;
      case "passe": htmlPasse(); break;
      case "resultado": htmlResultado(); break;
      default: htmlHome();
    }
  }

  /* ---------------- HOME ---------------- */
  function htmlHome() {
    var nomes = nomesAtivos();
    var nCats = estado.cfg.categorias.length;
    var s = estado.sessao;
    var placar = "";
    if (s) {
      placar = '<div class="card entra" style="margin-top:16px">' +
        '<h2>Placar da sessão</h2><p class="sub">Rodada ' + s.rodada + ' já jogada' + (s.rodada === 1 ? "" : "s") + '</p>' +
        '<div class="podio">' + s.jogadores.slice().sort(function (a, b) { return b.pontos - a.pontos; }).map(function (j, i) {
          return '<div class="podio-linha' + (i === 0 && j.pontos > 0 ? " primeiro" : "") + '">' +
            '<div class="pos">' + (i + 1) + 'º</div>' +
            '<div class="nomej">' + esc(j.nome) + '</div>' +
            '<div class="total">' + j.pontos + '<small>pts</small></div></div>';
        }).join("") + '</div>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap">' +
        '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="zerar-placar">Zerar placar</button>' +
        '</div></div>';
    }

    app.innerHTML =
      '<h1 class="logo">STOP<span>!</span></h1>' +
      '<p class="tagline">O clássico das palavras — agora com dicas e dicionário.</p>' +
      '<section class="roda-letra">' +
        '<div class="letra-display" id="letra-grande">?</div>' +
        '<button class="btn btn-primary btn-grande btn-bloco" data-acao="sorteio">SORTEAR LETRA</button>' +
        '<div class="resumo-rodada">' +
          '<span>👥 ' + nomes.length + ' ' + plural(nomes.length, "jogador", "jogadores") + '</span>' +
          '<span>🗂️ ' + nCats + ' categorias</span>' +
          '<span>⏱️ ' + (estado.cfg.tempo ? formatarTempo(estado.cfg.tempo) : "sem limite") + '</span>' +
        '</div>' +
      '</section>' +
      '<div class="atalhos">' +
        '<button class="btn btn-ghost" data-acao="ir:jogadores">👥 Jogadores</button>' +
        '<button class="btn btn-ghost" data-acao="ir:categorias">🗂️ Categorias</button>' +
        '<button class="btn btn-ghost" data-acao="ir:dicionario">📖 Dicionário</button>' +
        '<button class="btn btn-ghost" data-acao="ir:ajustes">⚙️ Ajustes</button>' +
      '</div>' +
      (estado.instalar ? '<button class="btn btn-yellow btn-bloco" style="margin-top:16px" data-acao="instalar">⬇️ Instalar o app no dispositivo</button>' : '') +
      placar +
      '<div style="text-align:center"><button class="link" data-acao="como">Como jogar?</button></div>' +
      '<div class="rodape-info">' + E.totalDePalavras().toLocaleString("pt-BR") + ' palavras no dicionário · ' +
        estado.stats.rodadas + ' ' + plural(estado.stats.rodadas, "rodada") + ' jogada' + (estado.stats.rodadas === 1 ? "" : "s") +
        (estado.stats.melhor > 0 ? ' · recorde ' + estado.stats.melhor + ' pts' : '') + '</div>';
  }

  function animarSorteio() {
    if (estado.cfg.categorias.length < 3) { toast("Escolha pelo menos 3 categorias 🗂️"); ir("categorias"); return; }
    var nomes = nomesAtivos();
    if (estado.cfg.modo === "festa" && nomes.length < 2) { toast("Modo festa precisa de 2+ jogadores"); ir("jogadores"); return; }
    if (!estado.sessao || estado.sessao.jogadores.length !== nomes.length ||
        estado.sessao.jogadores.some(function (j, i) { return j.nome !== nomes[i]; })) {
      iniciarSessao();
    }

    var display = document.getElementById("letra-grande");
    var r = E.roleta({
      apenas: letrasPermitidas(),
      incluirDificeis: estado.cfg.incluirDificeis,
      evitar: (estado.sessao.letras || []).slice(-3)
    });
    var seq = r.sequencia, i = 0;
    display.classList.add("girando");
    som("tick");
    var intervalo = setInterval(function () {
      display.textContent = seq[i];
      if (i % 2 === 0) som("tick");
      i++;
      if (i >= seq.length) {
        clearInterval(intervalo);
        display.classList.remove("girando");
        display.classList.add("saiu");
        display.textContent = r.letra;
        som("letra");
        if (navigator.vibrate) navigator.vibrate(25);
        setTimeout(function () { começarRodada(r.letra); }, 620);
      }
    }, 62);
  }

  function começarRodada(letra) {
    if (!estado.sessao) iniciarSessao();
    if (estado.sessao.letras.length > 12) estado.sessao.letras.shift();
    estado.sessao.letras.push(letra);
    estado.sessao.rodada++;

    var jogadores = estado.sessao.jogadores;
    estado.jogo = {
      letra: letra,
      catIds: estado.cfg.categorias.slice(),
      jogadores: jogadores.map(function (j) { return { nome: j.nome }; }),
      turno: 0,
      respostas: jogadores.map(function () { return {}; }),
      total: estado.cfg.tempo,
      restante: estado.cfg.tempo,
      inicioTurno: 0
    };
    estado.resultado = null;
    estado.tela = "rodada";
    render();
    iniciarCronometro();
  }

  /* ---------------- CRONÔMETRO ---------------- */
  var cronometroId = null;
  var ultimoSegundo = null;

  function iniciarCronometro(reiniciar) {
    pararCronometro();
    var jogo = estado.jogo;
    if (!jogo) return;
    if (reiniciar !== false) jogo.restante = jogo.total;
    ultimoSegundo = null;
    atualizarCronometro();
    if (!jogo.total) return;
    cronometroId = setInterval(function () {
      var j = estado.jogo;
      if (!j) return;
      j.restante = Math.max(0, j.restante - 1);
      atualizarCronometro();
      if (j.restante <= 5 && j.restante > 0) som("tick");
      if (j.restante <= 0) {
        pararCronometro();
        som("erro");
        toast("⏰ Tempo esgotado!");
        finalizarTurno(true);
      }
    }, 1000);
  }
  function retomarCronometro() {
    if (!estado.jogo || !estado.jogo.total || estado.jogo.restante <= 0) return;
    iniciarCronometro(false);
  }
  function pararCronometro() {
    if (cronometroId) clearInterval(cronometroId);
    cronometroId = null;
  }
  function atualizarCronometro() {
    var jogo = estado.jogo;
    if (!jogo) return;
    var elTempo = document.getElementById("cronometro");
    var elBarra = document.querySelector("#barra-tempo i");
    var perigo = jogo.total > 0 && jogo.restante <= 15;
    if (elTempo) {
      elTempo.textContent = jogo.total ? formatarTempo(jogo.restante) : "∞";
      elTempo.classList.toggle("perigo", !!perigo);
    }
    if (elBarra) {
      elBarra.style.width = (jogo.total ? (jogo.restante / jogo.total) * 100 : 100) + "%";
      elBarra.classList.toggle("perigo", !!perigo);
    }
  }

  /* ---------------- RODADA ---------------- */
  function htmlRodada() {
    var jogo = estado.jogo;
    if (!jogo) { ir("home"); return; }
    var resp = jogo.respostas[jogo.turno] || {};
    var preenchidas = jogo.catIds.filter(function (id) { return (resp[id] && resp[id].palavra || "").trim().length > 0; }).length;

    var linhas = jogo.catIds.map(function (catId, idx) {
      var cat = E.categoria(catId);
      if (!cat) return "";
      var r = resp[catId] || {};
      var palavra = r.palavra || "";
      var classe = "";
      if (palavra.trim()) classe = E.classificar(catId, palavra, jogo.letra).base > 0 ? " ok" : " erro";
      return '<div class="cat-linha' + classe + '" data-linha="' + catId + '">' +
        '<div class="num">' + (idx + 1) + '</div>' +
        '<div class="topo-cat"><div class="nome">' + cat.emoji + " " + esc(cat.nome) + '</div>' +
          (cat.obs ? '<div class="obs">' + esc(cat.obs) + '</div>' : '') + '</div>' +
        '<div class="linha-input">' +
          '<input type="text" inputmode="text" autocomplete="off" autocapitalize="words" spellcheck="false" ' +
            'data-campo="palavra" data-cat="' + catId + '" placeholder="' + jogo.letra + '..." value="' + esc(palavra) + '" ' +
            'aria-label="' + esc(cat.nome) + '">' +
          '<button class="btn-dica" data-acao="dica" data-val="' + catId + '" title="Dica custa ' + E.CUSTO_DICA + ' pontos">💡 DICA<small>−' + E.CUSTO_DICA + '</small></button>' +
        '</div>' +
        (r.dicaTexto ? '<div class="dica-texto">💡 ' + esc(r.dicaTexto) + '</div>' : '') +
      '</div>';
    }).join("");

    var multi = jogo.jogadores.length > 1;
    var vez = multi ? 'Vez de ' + esc(jogo.jogadores[jogo.turno].nome) : 'Rodada solo';

    app.innerHTML =
      '<div class="topo-rodada">' +
        '<button class="btn-icone" data-acao="sair-rodada" aria-label="Sair">✕</button>' +
        '<div class="letra-pill"><span class="rot">Letra</span><strong>' + jogo.letra + '</strong>' +
          '<span class="vez">' + vez + '</span></div>' +
        '<div class="cronometro" id="cronometro">' + (jogo.total ? formatarTempo(jogo.restante) : "∞") + '</div>' +
      '</div>' +
      '<div class="barra-tempo" id="barra-tempo"><i style="width:' + (jogo.total ? (jogo.restante / jogo.total) * 100 : 100) + '%"></i></div>' +
      '<div class="lista-cats">' + linhas + '</div>' +
      '<div class="rodape-fixo"><div class="interno">' +
        '<div class="contador">' + preenchidas + '/' + jogo.catIds.length + '</div>' +
        '<button class="btn btn-stop" data-acao="parar" style="flex:1">STOP!</button>' +
      '</div></div>';

    var primeiro = app.querySelector('input[data-campo="palavra"]');
    if (primeiro && window.innerWidth > 720) primeiro.focus({ preventScroll: true });
  }

  function atualizarContador() {
    var jogo = estado.jogo;
    var resp = jogo.respostas[jogo.turno] || {};
    var preenchidas = jogo.catIds.filter(function (id) { return (resp[id] && resp[id].palavra || "").trim().length > 0; }).length;
    var el = document.querySelector(".contador");
    if (el) el.textContent = preenchidas + "/" + jogo.catIds.length;
  }

  function aoDigitar(catId, valor) {
    var jogo = estado.jogo;
    if (!jogo) return;
    var resp = jogo.respostas[jogo.turno];
    var item = resp[catId] || (resp[catId] = {});
    item.palavra = valor;
    var linha = document.querySelector('[data-linha="' + catId + '"]');
    if (linha) {
      linha.classList.remove("ok", "erro");
      if (valor.trim()) {
        linha.classList.add(E.classificar(catId, valor, jogo.letra).base > 0 ? "ok" : "erro");
      }
    }
    var el = document.querySelector(".contador");
    if (el) {
      var preenchidas = jogo.catIds.filter(function (id) { return (resp[id] && resp[id].palavra || "").trim().length > 0; }).length;
      el.textContent = preenchidas + "/" + jogo.catIds.length;
    }
  }

  function usarDica(catId) {
    var jogo = estado.jogo;
    var resp = jogo.respostas[jogo.turno];
    var item = resp[catId] || (resp[catId] = {});
    var usadas = jogo.catIds.map(function (id) { return (resp[id] && resp[id].palavra) || ""; }).filter(Boolean);
    var d = E.dica(catId, jogo.letra, usadas);
    if (!d) { toast("Essa categoria não tem dica para a letra " + jogo.letra + " 🤷"); return; }
    item.dica = true;
    item.dicaTexto = "Começa com “" + d.inicio + "” e tem " + d.tamanho + " letras · custa " + E.CUSTO_DICA + " pts";
    item.dicaMascara = d.mascara;
    som("dica");
    render();
    var campo = document.querySelector('input[data-cat="' + catId + '"]');
    if (campo) { campo.focus({ preventScroll: true }); campo.setSelectionRange(campo.value.length, campo.value.length); }
    toast("Dica liberada (−" + E.CUSTO_DICA + " pts nessa palavra)");
  }

  function finalizarTurno(porTempo) {
    pararCronometro();
    var jogo = estado.jogo;
    if (!jogo) return;
    // limpa campos vazios
    if (!jogo.respostas[jogo.turno]) jogo.respostas[jogo.turno] = {};
    jogo.catIds.forEach(function (id) {
      var r = jogo.respostas[jogo.turno][id];
      if (r && !String(r.palavra || "").trim()) delete jogo.respostas[jogo.turno][id];
    });

    if (jogo.turno < jogo.jogadores.length - 1) {
      som("stop");
      estado.tela = "passe";
      render();
      return;
    }
    concluirRodada();
  }

  function concluirRodada() {
    var jogo = estado.jogo;
    som("stop");
    var resultado = E.avaliar({
      letra: jogo.letra,
      categorias: jogo.catIds,
      jogadores: jogo.jogadores.map(function (j, i) {
        return { nome: j.nome, respostas: jogo.respostas[i] || {} };
      })
    });
    // acumula no placar da sessão
    resultado.jogadores.forEach(function (j) {
      var alvo = estado.sessao.jogadores.filter(function (x) { return x.nome === j.nome; })[0];
      if (alvo) alvo.pontos += j.total;
    });
    resultado.parcial = jogo.jogadores.map(function (j, i) { return { nome: j.nome, total: resultado.jogadores[i].total }; });

    // estatísticas
    var stats = estado.stats;
    stats.rodadas += 1;
    var melhorDaRodada = Math.max.apply(null, resultado.jogadores.map(function (j) { return j.total; }).concat([0]));
    if (melhorDaRodada > stats.melhor) stats.melhor = melhorDaRodada;
    salvarStats(stats);

    estado.resultado = resultado;
    estado.tela = "resultado";
    render();
    var ganhador = resultado.ranking[0];
    if (ganhador && ganhador.total > 0) { som("vitoria"); confete(); }
  }

  function htmlPasse() {
    var jogo = estado.jogo;
    if (!jogo) { ir("home"); return; }
    var proximo = jogo.jogadores[jogo.turno + 1];
    app.innerHTML =
      '<div class="intersticio entra">' +
        '<div class="emoji">📱</div>' +
        '<h2>Passe o celular</h2>' +
        '<p>É a vez de <strong style="color:#f6c453">' + esc(proximo.nome) + '</strong><br>Letra ' + jogo.letra + ' · ninguém espiou, né? 👀</p>' +
        '<button class="btn btn-primary btn-grande" data-acao="proximo-turno">ESTOU PRONTO</button>' +
        '<button class="link" data-acao="sair-rodada">cancelar rodada</button>' +
      '</div>';
  }

  function proximoTurno() {
    var jogo = estado.jogo;
    jogo.turno++;
    estado.tela = "rodada";
    render();
    iniciarCronometro();
  }

  /* ---------------- RESULTADO ---------------- */
  function htmlResultado() {
    var r = estado.resultado;
    if (!r) { ir("home"); return; }
    var multi = r.jogadores.length > 1;

    var podio = r.ranking.map(function (j, i) {
      var medalha = j.posicao === 1 ? "🥇" : j.posicao === 2 ? "🥈" : j.posicao === 3 ? "🥉" : (i + 1) + "º";
      return '<div class="podio-linha' + (j.posicao === 1 ? " primeiro" : "") + '">' +
        '<div class="pos">' + medalha + '</div>' +
        '<div class="nomej">' + esc(j.nome) + '</div>' +
        '<div class="total">' + j.total + '<small>pts</small></div>' +
      '</div>';
    }).join("");

    var linhasTab = r.tabela.map(function (t) {
      var celulas = t.celulas.map(function (c) {
        var tags = "";
        if (c.repetida) tags += ' <span class="tag tag-rep">repetida</span>';
        if (c.status === "nao-verificada") tags += ' <span class="tag tag-nv">conferir</span>';
        var palavra = c.palavra ? esc(c.palavra) + tags : '<span class="palavra-vazia">—</span>';
        var classe = c.pontos === 0 ? " pts zero" : (c.pontos >= 10 ? " pts alto" : " pts");
        return '<td>' + palavra + '</td><td class="' + classe.trim() + '" style="text-align:right">' + (c.palavra ? "+" + c.pontos : "0") + '</td>';
      }).join("");
      return '<tr><td class="cat-nome">' + t.emoji + " " + esc(t.nome) + '</td>' + celulas + '</tr>';
    }).join("");

    var cabecalho = r.jogadores.map(function (j) { return '<th colspan="2">' + esc(j.nome) + '</th>'; }).join("");

    var detalhes = r.jogadores.map(function (j) {
      var itens = j.itens.filter(function (i) { return i.dica || i.repetida > 0 || i.status === "nao-verificada"; });
      if (!itens.length) return "";
      return '<div style="margin-top:10px"><b style="font-family:var(--fonte-display)">' + esc(j.nome) + '</b><ul style="margin:4px 0 0 18px;padding:0">' +
        itens.map(function (i) {
          var nota = [];
          if (i.dica) nota.push("usou dica (−" + i.custoDica + ")");
          if (i.repetida) nota.push("repetida (−" + (i.base) + ")");
          if (i.status === "nao-verificada") nota.push("não está no dicionário, vale conferir");
          return '<li style="font-size:13px;font-weight:700;color:var(--ink-2)">' + i.emoji + " " + esc(i.nome) + ": <b>" + esc(i.palavra || "—") + "</b> — " + nota.join("; ") + '</li>';
        }).join("") + '</ul></div>';
    }).join("");

    var totalSessao = estado.sessao ? estado.sessao.jogadores.map(function (j) { return esc(j.nome) + " " + j.pontos; }).join(" · ") : "";

    app.innerHTML =
      '<div class="entra">' +
      '<div class="topo"><button class="btn-icone" data-acao="ir:home" aria-label="Início">←</button><h1>Resultado</h1></div>' +
      '<div class="selo-letra">Letra sorteada <strong>' + r.letra + '</strong> · ' + r.categorias.length + ' categorias</div>' +
      '<div class="podio">' + podio + '</div>' +
      '<div class="card">' +
        '<h2>Palavras da rodada</h2><p class="sub">Repetidas valem metade. Palavra com 9+ letras ganha +2. Dica custa ' + E.CUSTO_DICA + '.</p>' +
        '<div style="overflow-x:auto"><table class="tabela-res">' +
          '<thead><tr><th>Categoria</th>' + cabecalho + '</tr></thead><tbody>' + linhasTab + '</tbody>' +
        '</table></div>' +
        (detalhes ? '<div style="margin-top:14px;border-top:1px dashed var(--linha);padding-top:6px">' + detalhes + '</div>' : '') +
      '</div>' +
      (multi && totalSessao ? '<div class="card"><h2>Placar geral</h2><p class="sub">Somatório das rodadas desta sessão</p><div class="podio">' +
        estado.sessao.jogadores.slice().sort(function (a, b) { return b.pontos - a.pontos; }).map(function (j, i) {
          return '<div class="podio-linha"><div class="pos">' + (i + 1) + 'º</div><div class="nomej">' + esc(j.nome) + '</div><div class="total">' + j.pontos + '<small>pts</small></div></div>';
        }).join("") + '</div></div>' : '') +
      '<div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:16px">' +
        '<button class="btn btn-primary" style="flex:1;min-width:180px" data-acao="nova-rodada">🎲 Nova rodada</button>' +
        '<button class="btn btn-ghost" data-acao="compartilhar">📤 Compartilhar</button>' +
      '</div>' +
      '<div style="text-align:center"><button class="link" data-acao="ir:home">voltar ao início</button></div>' +
      '</div>';
  }

  function compartilhar() {
    var r = estado.resultado;
    if (!r) return;
    var texto = "STOP! 🎯 Letra " + r.letra + "\n" + r.ranking.map(function (j, i) {
      return (i + 1) + ". " + j.nome + " — " + j.total + " pts";
    }).join("\n") + "\n\nJogado no STOP! — " + E.totalDePalavras() + " palavras no dicionário.";
    if (navigator.share) {
      navigator.share({ title: "STOP!", text: texto }).catch(function () {});
      return;
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(texto).then(function () { toast("Resultado copiado! 📋"); }, function () { toast(texto); });
    } else { toast(texto); }
  }

  /* ---------------- JOGADORES ---------------- */
  function htmlJogadores() {
    var nomes = estado.cfg.modo === "solo" ? [estado.cfg.nomes[0] || "Você"] : estado.cfg.nomes;
    var campos = nomes.map(function (n, i) {
      return '<div style="display:flex;gap:8px;margin-bottom:10px">' +
        '<input type="text" maxlength="16" data-nome="' + i + '" value="' + esc(n || "") + '" placeholder="Jogador ' + (i + 1) + '">' +
        (nomes.length > 1 ? '<button class="btn-icone" style="background:rgba(0,0,0,.07);border-color:var(--linha);color:var(--red)" data-acao="remover-jogador" data-val="' + i + '" aria-label="Remover">✕</button>' : '') +
      '</div>';
    }).join("");

    var tempos = [30, 60, 90, 120, 180, 0];
    var chipsTempo = tempos.map(function (t) {
      return '<button class="chip" data-acao="tempo" data-val="' + t + '" aria-pressed="' + (estado.cfg.tempo === t) + '">' +
        (t ? formatarTempo(t) : "sem limite") + '</button>';
    }).join("");

    app.innerHTML =
      '<div class="topo"><button class="btn-icone" data-acao="ir:home" aria-label="Voltar">←</button><h1>Jogadores</h1></div>' +
      '<div class="card entra">' +
        '<h2>Quem vai jogar?</h2><p class="sub">No modo festa o celular passa de mão em mão a cada rodada.</p>' +
        '<div class="chips" style="margin-bottom:16px">' +
          '<button class="chip" data-acao="modo" data-val="solo" aria-pressed="' + (estado.cfg.modo === "solo") + '">🙋 Solo / treino</button>' +
          '<button class="chip" data-acao="modo" data-val="festa" aria-pressed="' + (estado.cfg.modo === "festa") + '">🎉 Festa (2–6)</button>' +
        '</div>' +
        campos +
        (estado.cfg.modo === "festa" && nomes.length < 6 ? '<button class="btn btn-pequeno btn-yellow" data-acao="adicionar-jogador">+ adicionar jogador</button>' : '') +
      '</div>' +
      '<div class="card">' +
        '<h2>Tempo por rodada</h2><p class="sub">Cada jogador tem esse tempo para preencher tudo.</p>' +
        '<div class="chips">' + chipsTempo + '</div>' +
      '</div>' +
      '<button class="btn btn-primary btn-bloco btn-grande" style="margin-top:16px" data-acao="ir:home">SALVAR</button>';
  }

  /* ---------------- CATEGORIAS ---------------- */
  function htmlCategorias() {
    var selecionadas = estado.cfg.categorias;
    var packs = E.packs.map(function (pack) {
      var cats = E.categorias.filter(function (c) { return c.pack === pack.id; });
      if (!cats.length) return "";
      return '<div style="margin-bottom:18px">' +
        '<div class="rotulo">' + pack.emoji + " " + esc(pack.nome) + '</div>' +
        '<div class="chips">' + cats.map(function (c) {
          var on = selecionadas.indexOf(c.id) >= 0;
          var qtd = E.totalPalavrasCategoria(c.id);
          return '<button class="chip' + (c.nicho ? " badge" : "") + '" data-acao="toggle-cat" data-val="' + c.id + '" aria-pressed="' + on + '">' +
            c.emoji + " " + esc(c.nome) + ' <small style="opacity:.55;font-weight:800">' + qtd + '</small></button>';
        }).join("") + '</div></div>';
    }).join("");

    app.innerHTML =
      '<div class="topo"><button class="btn-icone" data-acao="ir:home" aria-label="Voltar">←</button><h1>Categorias</h1></div>' +
      '<div class="card entra">' +
        '<h2>Monte sua rodada</h2>' +
        '<p class="sub">' + selecionadas.length + ' selecionadas · recomendado de 6 a 12. Os números mostram quantas palavras existem no dicionário de cada categoria.</p>' +
        '<div class="chips" style="margin-bottom:18px">' +
          '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="cats:sugeridas">✨ Sugeridas</button>' +
          '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="cats:todas">Todas</button>' +
          '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="cats:nenhuma">Limpar</button>' +
          '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="cats:classicas">Só clássicas</button>' +
          '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="cats:nicho">🤓 Só nicho</button>' +
        '</div>' +
        packs +
      '</div>' +
      '<button class="btn btn-primary btn-bloco btn-grande" style="margin-top:16px" data-acao="ir:home">SALVAR</button>';
  }

  /* ---------------- AJUSTES ---------------- */
  function htmlAjustes() {
    var cfg = estado.cfg;
    app.innerHTML =
      '<div class="topo"><button class="btn-icone" data-acao="ir:home" aria-label="Voltar">←</button><h1>Ajustes</h1></div>' +
      '<div class="card entra">' +
        '<div class="linha-config"><div class="txt"><b>Som</b><small>Bipes, letra sorteada e fanfarra</small></div>' +
          '<button class="switch" role="switch" data-acao="toggle:som" aria-checked="' + cfg.som + '"></button></div>' +
        '<div class="linha-config"><div class="txt"><b>Tema escuro</b><small>Melhor para jogar de madrugada</small></div>' +
          '<button class="switch" role="switch" data-acao="toggle:tema" aria-checked="' + (cfg.tema === "escuro") + '"></button></div>' +
        '<div class="linha-config"><div class="txt"><b>Letras difíceis</b><small>Incluir K, W, X, Y e Z no sorteio</small></div>' +
          '<button class="switch" role="switch" data-acao="toggle:dificeis" aria-checked="' + cfg.incluirDificeis + '"></button></div>' +
      '</div>' +
      '<div class="card">' +
        '<h2>Letras do sorteio</h2><p class="sub">Toque para tirar ou devolver uma letra da roleta.</p>' +
        '<div class="chips" style="margin-bottom:12px">' +
          '<button class="chip" data-acao="preset-letras" data-val="todas">↺ Todas</button>' +
          '<button class="chip" data-acao="preset-letras" data-val="dificeis">🔥 Só K W X Y Z</button>' +
          '<button class="chip" data-acao="preset-letras" data-val="sem-dificeis">😌 Sem as difíceis</button>' +
        '</div>' +
        '<div class="letras-grid">' + E.ALFABETO.map(function (L) {
          var fora = (cfg.letrasFora || []).indexOf(L) >= 0;
          return '<button data-acao="toggle-letra" data-val="' + L + '" aria-pressed="' + !fora + '">' + L + '</button>';
        }).join("") + '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h2>Minhas palavras</h2><p class="sub">Você adicionou ' + contarMinhasPalavras() + ' ' + plural(contarMinhasPalavras(), "palavra") + ' ao dicionário. Elas ficam salvas neste aparelho.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap">' +
          '<button class="btn btn-pequeno btn-yellow" data-acao="exportar">⬇️ Exportar (.json)</button>' +
          '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="importar">⬆️ Importar</button>' +
          '<input type="file" accept="application/json,.json" id="arquivo-import" hidden>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<h2>Sobre</h2><p class="sub">' + E.totalDePalavras().toLocaleString("pt-BR") + ' palavras · ' + E.categorias.length + ' categorias · v1.0</p>' +
        '<p style="font-size:13.5px;color:var(--ink-2);font-weight:600;line-height:1.5">Feito para rodar offline, no navegador, como app instalável e como pacote no Arch Linux. Sem anúncios, sem login, sem servidor.</p>' +
        '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px">' +
          '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="como">Como jogar</button>' +
          '<button class="btn btn-pequeno" style="background:#ffe0e8;color:#a01334" data-acao="reset">Apagar meus dados</button>' +
        '</div>' +
      '</div>' +
      '<div class="rodape-info">Dicionário colaborativo: adicione palavras pelo Dicionário do jogo.</div>';
  }

  function contarMinhasPalavras() {
    var total = 0;
    E.categorias.forEach(function (c) {
      var custom = E.palavrasCustom(c.id);
      Object.keys(custom).forEach(function (L) { total += (custom[L] || []).length; });
    });
    return total;
  }

  /* ---------------- DICIONÁRIO ---------------- */
  function htmlDicionario() {
    var d = estado.dic;
    var alfabeto = E.ALFABETO.map(function (L) {
      var tem = E.categorias.some(function (c) { return E.letrasComPalavras(c.id).indexOf(L) >= 0; });
      return '<button data-acao="dic-letra" data-val="' + L + '" aria-pressed="' + (d.letra === L) + '" ' + (tem ? "" : "disabled") + '>' + L + '</button>';
    }).join("");

    app.innerHTML =
      '<div class="topo"><button class="btn-icone" data-acao="ir:home" aria-label="Voltar">←</button><h1>Dicionário</h1></div>' +
      '<div class="card entra">' +
        '<div class="busca">' +
          '<input type="search" id="busca-dic" placeholder="Buscar palavra..." value="' + esc(d.busca) + '">' +
          (d.letra || d.busca ? '<button class="btn btn-pequeno btn-ghost" style="color:var(--ink);border-color:var(--linha);background:rgba(0,0,0,.05)" data-acao="dic-limpar">✕</button>' : '') +
        '</div>' +
        '<div class="alfabeto">' +
          '<button data-acao="dic-letra" data-val="" aria-pressed="' + (!d.letra) + '" style="width:auto;padding:0 10px">Todas</button>' + alfabeto +
        '</div>' +
        '<div id="dic-lista"></div>' +
      '</div>' +
      '<div class="card">' +
        '<h2>Adicionar palavra</h2><p class="sub">Ensinou? Vale para sempre neste aparelho. Ex.: “Zarabatana” em Objeto.</p>' +
        '<div class="campo"><label>Categoria</label><select id="dic-categoria">' +
          E.categorias.map(function (c) { return '<option value="' + c.id + '">' + c.emoji + " " + esc(c.nome) + '</option>'; }).join("") +
        '</select></div>' +
        '<div class="campo"><label>Palavra</label><input type="text" id="dic-nova" placeholder="Digite a palavra..."></div>' +
        '<button class="btn btn-verde btn-bloco" data-acao="dic-adicionar">+ Adicionar ao dicionário</button>' +
      '</div>';

    renderizarListaDic();
  }

  function renderizarListaDic() {
    var alvo = document.getElementById("dic-lista");
    if (!alvo) return;
    var d = estado.dic;
    var busca = E.normalizar(d.busca);
    var blocos = [];

    E.categorias.forEach(function (cat) {
      var letras = d.letra ? [d.letra] : E.ALFABETO;
      var palavras = [];
      letras.forEach(function (L) {
        E.palavras(cat.id, L).forEach(function (w) { palavras.push({ palavra: w, letra: L }); });
      });
      if (busca) palavras = palavras.filter(function (w) { return E.normalizar(w.palavra).indexOf(busca) >= 0; });
      if (!palavras.length) return;
      var custom = E.palavrasCustom(cat.id);
      blocos.push('<div class="dic-cat"><h3>' + cat.emoji + " " + esc(cat.nome) +
        ' <small>' + palavras.length + '</small></h3><div class="dic-palavras">' +
        palavras.slice(0, 120).map(function (w) {
          var minhas = (custom[w.letra] || []).indexOf(w.palavra) >= 0;
          return '<span class="' + (minhas ? "minha" : "") + '">' + esc(w.palavra) +
            (minhas ? '<button data-acao="dic-remover" data-val="' + cat.id + "||" + esc(w.palavra) + '" aria-label="Remover">✕</button>' : "") +
            '</span>';
        }).join("") + (palavras.length > 120 ? '<span style="opacity:.6">+' + (palavras.length - 120) + '…</span>' : "") +
        '</div></div>');
    });

    alvo.innerHTML = blocos.length ? blocos.join("") : '<p class="vazio">Nada encontrado por aqui. Tente outra letra ou busca.</p>';
  }

  /* ---------------- COMO JOGAR ---------------- */
  function abrirComoJogar() {
    var fundo = document.createElement("div");
    fundo.className = "modal-fundo";
    fundo.innerHTML = '<div class="modal" role="dialog" aria-modal="true">' +
      '<button class="btn-icone fechar" data-acao="fechar-modal" style="background:rgba(0,0,0,.07);border-color:var(--linha);color:var(--ink);float:right" aria-label="Fechar">✕</button>' +
      '<h2>Como jogar STOP!</h2>' +
      '<ul>' +
        '<li>Sorteie uma <b>letra</b> e preencha cada categoria com uma palavra que comece por ela.</li>' +
        '<li>Cada palavra vale <b>10 pontos</b> se estiver no dicionário e <b>5</b> se o jogo não conhecer (vale conferir na rodada).</li>' +
        '<li>Palavra com <b>9+ letras</b> ganha <b>+2</b>. Palavras <b>repetidas</b> entre jogadores valem metade.</li>' +
        '<li>A <b>dica</b> mostra as duas primeiras letras e o tamanho — e custa <b>' + E.CUSTO_DICA + ' pontos</b> naquela palavra.</li>' +
        '<li>No <b>modo festa</b>, o celular passa de mão em mão: todos jogam a mesma letra e o placar soma no final.</li>' +
        '<li>Faltou palavra? Adicione no <b>Dicionário</b> — o jogo aprende com você.</li>' +
      '</ul>' +
      '<button class="btn btn-primary btn-bloco" data-acao="fechar-modal" style="margin-top:10px">Entendi!</button>' +
      '</div>';
    document.body.appendChild(fundo);
    fundo.addEventListener("click", function (ev) {
      if (ev.target === fundo || ev.target.closest("[data-acao='fechar-modal']")) fundo.remove();
    });
  }

  function fecharModais() {
    document.querySelectorAll(".modal-fundo").forEach(function (m) { m.remove(); });
  }

  /* ---------------- AÇÕES ---------------- */
  function tratar(acao, val, el) {
    var cfg = estado.cfg;

    // ações de navegação no formato "ir:tela"
    if (acao.indexOf("ir:") === 0) {
      var destinoTela = acao.slice(3);
      if (destinoTela === "home") salvarCfg();
      fecharModais();
      ir(destinoTela);
      return;
    }

    switch (acao) {
      case "ir": {
        var destino = val;
        if (destino === "home") { saveTudo(); }
        ir(destino);
        break;
      }
      case "sorteio": animarSorteio(); break;
      case "como": abrirComoJogar(); break;
      case "fechar-modal": fecharModais(); break;

      case "instalar":
        if (estado.instalar) {
          estado.instalar.prompt();
          estado.instalar.userChoice.then(function () { estado.instalar = null; render(); });
        }
        break;

      case "zerar-placar":
        if (estado.sessao) { estado.sessao.jogadores.forEach(function (j) { j.pontos = 0; }); estado.sessao.rodada = 0; }
        render(); toast("Placar zerado");
        break;

      case "sair-rodada":
        if (confirm("Sair da rodada atual? As respostas serão perdidas.")) {
          pararCronometro();
          estado.jogo = null;
          ir("home");
        }
        break;

      case "dica": usarDica(val); break;

      case "parar":
        if (el) el.disabled = true;
        finalizarTurno(false);
        break;

      case "proximo-turno": proximoTurno(); break;

      case "nova-rodada":
        estado.resultado = null;
        ir("home");
        setTimeout(animarSorteio, 180);
        break;

      case "compartilhar": compartilhar(); break;

      /* ---- jogadores ---- */
      case "modo":
        cfg.modo = val;
        if (cfg.modo === "festa" && cfg.nomes.length < 2) cfg.nomes.push("Jogador 2");
        salvarCfg(); render();
        break;
      case "tempo":
        cfg.tempo = parseInt(val, 10) || 0;
        salvarCfg(); render();
        break;
      case "adicionar-jogador":
        if (cfg.nomes.length < 6) { cfg.nomes.push("Jogador " + (cfg.nomes.length + 1)); salvarCfg(); render(); }
        break;
      case "remover-jogador":
        if (cfg.nomes.length > 1) { cfg.nomes.splice(parseInt(val, 10), 1); salvarCfg(); render(); }
        break;

      /* ---- categorias ---- */
      case "toggle-cat": {
        var i = cfg.categorias.indexOf(val);
        if (i >= 0) {
          if (cfg.categorias.length <= 3) { toast("Deixe pelo menos 3 categorias 🙂"); break; }
          cfg.categorias.splice(i, 1);
        } else cfg.categorias.push(val);
        salvarCfg(); render();
        break;
      }
      case "cats:sugeridas": cfg.categorias = CATS_SUGERIDAS.slice(); salvarCfg(); render(); break;
      case "cats:todas": cfg.categorias = E.categorias.map(function (c) { return c.id; }); salvarCfg(); render(); break;
      case "cats:nenhuma": cfg.categorias = ["pais", "nome", "objeto"]; salvarCfg(); render(); break;
      case "cats:nicho": cfg.categorias = E.categorias.filter(function (c) { return !!c.nicho; }).map(function (c) { return c.id; }); salvarCfg(); render(); break;
      case "cats:classicas": cfg.categorias = E.categorias.filter(function (c) { return c.pack === "classico"; }).map(function (c) { return c.id; }); salvarCfg(); render(); break;

      /* ---- ajustes ---- */
      case "toggle:som": cfg.som = !cfg.som; salvarCfg(); render(); if (cfg.som) som("toque"); break;
      case "toggle:tema":
        cfg.tema = cfg.tema === "escuro" ? "claro" : "escuro";
        aplicarTema(); salvarCfg(); render();
        break;
      case "toggle:dificeis":
        cfg.incluirDificeis = !cfg.incluirDificeis;
        if (!cfg.incluirDificeis) {
          E.DIFICEIS.forEach(function (L) { if (cfg.letrasFora.indexOf(L) < 0) cfg.letrasFora.push(L); });
        } else {
          cfg.letrasFora = cfg.letrasFora.filter(function (L) { return E.DIFICEIS.indexOf(L) < 0; });
        }
        sincronizarDificeis();
        salvarCfg(); render();
        break;
      case "preset-letras": {
        if (val === "todas") cfg.letrasFora = [];
        else if (val === "dificeis") cfg.letrasFora = E.ALFABETO.filter(function (L) { return E.DIFICEIS.indexOf(L) < 0; });
        else cfg.letrasFora = E.DIFICEIS.slice();
        sincronizarDificeis();
        salvarCfg(); render();
        toast(val === "dificeis" ? "Roleta cabeluda ativada 🔥" : val === "sem-dificeis" ? "Só letras amigáveis 😌" : "Todas as letras de volta");
        break;
      }
      case "toggle-letra": {
        var pos = cfg.letrasFora.indexOf(val);
        if (pos >= 0) cfg.letrasFora.splice(pos, 1);
        else {
          if (E.ALFABETO.length - cfg.letrasFora.length <= 5) { toast("Precisa sobrar pelo menos 5 letras"); break; }
          cfg.letrasFora.push(val);
        }
        sincronizarDificeis();
        salvarCfg(); render();
        break;
      }
      case "exportar": exportarPalavras(); break;
      case "importar": {
        var inp = document.getElementById("arquivo-import");
        if (inp) inp.click();
        break;
      }
      case "reset":
        if (confirm("Apagar placar, ajustes e TODAS as palavras que você adicionou?")) {
          [CHAVE_CFG, CHAVE_STATS, "stop.custom.v1"].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) {} });
          location.reload();
        }
        break;

      /* ---- dicionário ---- */
      case "dic-letra":
        estado.dic.letra = estado.dic.letra === val ? "" : val;
        render();
        break;
      case "dic-limpar":
        estado.dic.letra = ""; estado.dic.busca = "";
        render();
        break;
      case "dic-adicionar": {
        var sel = document.getElementById("dic-categoria");
        var campo = document.getElementById("dic-nova");
        if (!sel || !campo) break;
        var palavra = campo.value;
        var r = E.adicionarPalavra(sel.value, palavra);
        if (!r.ok) { toast(r.motivo); som("erro"); break; }
        som("toque");
        toast("“" + r.palavra + "” salva em " + E.categoria(sel.value).nome + " (letra " + r.letra + ")");
        campo.value = "";
        estado.dic.letra = r.letra;
        renderizarListaDic();
        render();
        break;
      }
      case "dic-remover": {
        var partes = String(val).split("||");
        if (E.removerPalavra(partes[0], partes[1])) { toast("Palavra removida"); render(); }
        break;
      }
    }
  }

  function sincronizarDificeis() {
    var cfg = estado.cfg;
    cfg.incluirDificeis = E.DIFICEIS.every(function (L) { return cfg.letrasFora.indexOf(L) < 0; });
  }

  function letrasPermitidas() {
    var fora = estado.cfg.letrasFora || [];
    return E.ALFABETO.filter(function (L) { return fora.indexOf(L) < 0; });
  }

  function aplicarTema() {
    document.body.setAttribute("data-tema", estado.cfg.tema === "escuro" ? "escuro" : "claro");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", estado.cfg.tema === "escuro" ? "#101f2a" : "#15603f");
  }

  function saveTudo() {
    salvarCfg();
  }

  /* ---------------- exportar / importar ---------------- */
  function exportarPalavras() {
    var dados = { app: "STOP!", versao: 1, exportado: new Date().toISOString(), palavras: {} };
    E.categorias.forEach(function (c) {
      var custom = E.palavrasCustom(c.id);
      if (Object.keys(custom).length) dados.palavras[c.id] = custom;
    });
    var blob = new Blob([JSON.stringify(dados, null, 2)], { type: "application/json" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "stop-minhas-palavras.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    toast("Arquivo exportado ⬇️");
  }

  function importarPalavras(arquivo) {
    var leitor = new FileReader();
    leitor.onload = function () {
      try {
        var dados = JSON.parse(leitor.result);
        var mapa = dados.palavras || dados;
        var entraram = 0, repetidas = 0;
        Object.keys(mapa).forEach(function (catId) {
          if (!E.categoria(catId) || typeof mapa[catId] !== "object") return;
          Object.keys(mapa[catId]).forEach(function (L) {
            (mapa[catId][L] || []).forEach(function (w) {
              var r = E.adicionarPalavra(catId, w);
              if (r.ok) entraram++; else repetidas++;
            });
          });
        });
        toast(entraram + " palavra(s) importada(s)" + (repetidas ? " · " + repetidas + " já existiam" : ""));
        if (estado.tela === "dicionario") render();
      } catch (e) {
        toast("Arquivo inválido 😕");
      }
    };
    leitor.readAsText(arquivo);
  }

  /* ---------------- delegação de eventos ---------------- */
  document.addEventListener("click", function (ev) {
    var alvo = ev.target.closest("[data-acao]");
    if (alvo) {
      ev.preventDefault();
      tratar(alvo.getAttribute("data-acao"), alvo.getAttribute("data-val"), alvo);
    }
  });

  document.addEventListener("input", function (ev) {
    var el = ev.target;
    if (el.matches('input[data-campo="palavra"]')) {
      aoDigitar(el.getAttribute("data-cat"), el.value);
      return;
    }
    if (el.matches("input[data-nome]")) {
      var i = parseInt(el.getAttribute("data-nome"), 10);
      estado.cfg.nomes[i] = el.value;
      salvarCfg();
      return;
    }
    if (el.id === "busca-dic") {
      estado.dic.busca = el.value;
      renderizarListaDic();
    }
  });

  document.addEventListener("change", function (ev) {
    var el = ev.target;
    if (el.id === "arquivo-import" && el.files && el.files[0]) {
      importarPalavras(el.files[0]);
      el.value = "";
    }
  });

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { fecharModais(); return; }
    var el = ev.target;
    if (el.matches('input[data-campo="palavra"]')) {
      var campos = Array.prototype.slice.call(document.querySelectorAll('input[data-campo="palavra"]'));
      var idx = campos.indexOf(el);
      if (ev.key === "Enter") {
        ev.preventDefault();
        var prox = campos[idx + 1];
        if (prox) prox.focus();
        else if (el) { som("toque"); el.blur(); }
      }
      if (ev.key === "ArrowDown") { ev.preventDefault(); if (campos[idx + 1]) campos[idx + 1].focus(); }
      if (ev.key === "ArrowUp") { ev.preventDefault(); if (campos[idx - 1]) campos[idx - 1].focus(); }
    }
    if (el.id === "dic-nova" && ev.key === "Enter") {
      ev.preventDefault();
      tratar("dic-adicionar");
    }
  });

  /* ---------------- ciclo de vida ---------------- */
  function aoEsconder() {
    if (estado.tela === "rodada") pararCronometro();
  }
  function aoMostrar() {
    if (estado.tela === "rodada" && estado.jogo && estado.jogo.total > 0 && estado.jogo.restante > 0) {
      retomarCronometro();
    }
  }
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) aoEsconder(); else aoMostrar();
  });

  window.addEventListener("beforeinstallprompt", function (ev) {
    ev.preventDefault();
    estado.instalar = ev;
    if (estado.tela === "home") render();
  });

  if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  aplicarTema();
  estado.cfg.letrasFora = estado.cfg.letrasFora || [];
  if (estado.cfg.incluirDificeis === false) {
    E.DIFICEIS.forEach(function (L) { if (estado.cfg.letrasFora.indexOf(L) < 0) estado.cfg.letrasFora.push(L); });
  }
  render();
})();
