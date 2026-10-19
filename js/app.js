// ============================================================
//  TELAS
// ============================================================

const $tela = document.getElementById("tela");
let quinzenaVista = quinzenaDe(hojeTexto());

function avisoRapido(texto) {
  const el = document.getElementById("aviso-rapido");
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(avisoRapido.timer);
  avisoRapido.timer = setTimeout(() => (el.hidden = true), 2500);
}

// ---------- Tela principal ----------
function telaInicio() {
  gerarRecorrentes(); // caso o dia de algum recorrente tenha chegado com o app aberto
  const q = quinzenaVista;
  const ehAtual = q.inicio === quinzenaDe(hojeTexto()).inicio;
  const tq = totais(lancamentosEntre(q.inicio, q.fim));
  const sobra = sobraAntesDe(q.inicio);
  const saldo = sobra + tq.saldo;

  // Mês do calendário em que a quinzena começa
  const [ano, mes] = q.inicio.split("-").map(Number);
  const inicioMes = `${ano}-${String(mes).padStart(2, "0")}-01`;
  const fimMes = `${ano}-${String(mes).padStart(2, "0")}-${ultimoDiaDoMes(ano, mes - 1)}`;
  const tm = totais(lancamentosEntre(inicioMes, fimMes));

  const ultimos = lancamentosEntre(q.inicio, q.fim)
    .sort((a, b) => b.data.localeCompare(a.data))
    .slice(0, 5);

  $tela.innerHTML = `
    <h1 class="marca"><img src="icones/icone-192.png" alt=""><span>FAROL</span></h1>
    <div id="avisos-contas"></div>
    <div id="avisos"></div>

    <section class="cartao">
      <div class="periodo">
        <button id="q-anterior" aria-label="Quinzena anterior">◀</button>
        <span>Quinzena ${diaMes(q.inicio)} a ${diaMes(q.fim)}</span>
        <button id="q-seguinte" aria-label="Próxima quinzena">▶</button>
      </div>
      ${ehAtual ? "" : `<div style="text-align:center"><button class="link" id="q-hoje">voltar para a quinzena atual</button></div>`}
      <div class="saldo">
        <small>Saldo</small>
        <strong class="${saldo < 0 ? "negativo" : ""}">${reais(saldo)}</strong>
      </div>
      <div class="linha"><span>Sobra anterior</span><span class="${sobra < 0 ? "gasto" : ""}">${reais(sobra)}</span></div>
      <div class="linha"><span>Entrou</span><span class="entrada">${reais(tq.entrou)}</span></div>
      <div class="linha clicavel" data-ver-gastos><span>Saiu ›</span><span class="gasto">${reais(tq.saiu)}</span></div>
      <div class="linha"><span>Na ${dados.caderneta.nome}</span><span class="cad">${reais(totalCaderneta())}</span></div>
    </section>

    <section class="cartao">
      <h2>Mês: ${MESES[mes - 1]}</h2>
      <div class="mes">
        <div><small>Entrou</small><strong class="entrada">${reais(tm.entrou)}</strong></div>
        <div class="clicavel" data-ver-gastos><small>Saiu ›</small><strong class="gasto">${reais(tm.saiu)}</strong></div>
      </div>
    </section>

    <section class="cartao">
      <h2>Últimos lançamentos</h2>
      ${ultimos.length ? `<ul class="lista">${ultimos.map(itemLancamento).join("")}</ul>`
        : `<p class="vazio">Nenhum lançamento nesta quinzena.</p>`}
    </section>

    <div class="acoes">
      <button class="botao" id="novo-gasto">+ Gasto</button>
      <button class="botao secundario" id="nova-entrada">+ Entrada</button>
    </div>`;

  document.getElementById("q-anterior").onclick = () => { quinzenaVista = quinzenaAnterior(quinzenaVista); telaInicio(); };
  document.getElementById("q-seguinte").onclick = () => { quinzenaVista = quinzenaSeguinte(quinzenaVista); telaInicio(); };
  const hoje = document.getElementById("q-hoje");
  if (hoje) hoje.onclick = () => { quinzenaVista = quinzenaDe(hojeTexto()); telaInicio(); };

  const lista = $tela.querySelector(".lista");
  if (lista) lista.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    const l = li && ultimos.find((x) => x.id === li.dataset.id);
    if (l) painelLancamento(l, telaInicio);
  });

  // "Saiu" abre o Histórico do mês, já filtrado em Gastos
  $tela.querySelectorAll("[data-ver-gastos]").forEach((el) => el.onclick = () => {
    mesHistorico = mesDe(q.inicio);
    filtroHistorico = "gasto";
    abrir("historico");
  });

  document.getElementById("novo-gasto").onclick = () => telaNovoGasto();
  document.getElementById("nova-entrada").onclick = telaNovaEntrada;

  mostrarAvisosContas();
  mostrarSalariosPendentes();
}

// ---------- Cartões "O salário entrou?" ----------
function mostrarSalariosPendentes() {
  const $avisos = document.getElementById("avisos");
  $avisos.innerHTML = entradasPendentes().map(({ fixa, data }, i) => `
    <section class="cartao aviso-salario" data-i="${i}">
      <p>💰 <strong>${fixa.descricao || fixa.tipo}</strong> de <strong>${reais(fixa.valor)}</strong> entrou? <span class="suave">(${dataCompleta(data)})</span></p>
      <div class="acoes-aviso">
        <button class="botao" data-acao="confirmar">✅ Confirmar</button>
        <button class="botao secundario" data-acao="outro">✏️ Outro valor</button>
        <button class="botao secundario" data-acao="nao">Não entrou</button>
      </div>
    </section>`).join("");

  const pendentes = entradasPendentes();
  $avisos.querySelectorAll(".aviso-salario").forEach(($c) => {
    const { fixa, data } = pendentes[$c.dataset.i];
    $c.querySelector('[data-acao="confirmar"]').onclick = () => {
      responderEntrada(fixa, data, fixa.valor);
      telaInicio();
      avisoRapido(`Entrada de ${reais(fixa.valor)} lançada`);
    };
    $c.querySelector('[data-acao="nao"]').onclick = () => {
      responderEntrada(fixa, data, null);
      telaInicio();
    };
    $c.querySelector('[data-acao="outro"]').onclick = () => {
      $c.querySelector(".acoes-aviso").innerHTML = `
        <input class="valor-aviso" inputmode="numeric" placeholder="R$ 0,00">
        <button class="botao" data-acao="salvar">Salvar</button>
        <button class="botao secundario" data-acao="voltar">Voltar</button>`;
      const $v = $c.querySelector(".valor-aviso");
      ligarCampoValor($v);
      $v.focus();
      $c.querySelector('[data-acao="voltar"]').onclick = telaInicio;
      $c.querySelector('[data-acao="salvar"]').onclick = () => {
        const valor = Number($v.dataset.centavos) || 0;
        if (!valor) { avisoRapido("Digite o valor"); return; }
        responderEntrada(fixa, data, valor);
        telaInicio();
        avisoRapido(`Entrada de ${reais(valor)} lançada`);
      };
    };
  });
}

// ---------- Nova entrada ----------
function telaNovaEntrada() {
  let tipo = null;
  let freq = "unica"; // "unica" | "quinzenal" | "mensal"

  $tela.innerHTML = `
    <div class="topo-form">
      <button class="voltar" id="voltar" aria-label="Voltar">←</button>
      <h1>Nova entrada</h1>
    </div>

    <section class="cartao form">
      <label class="campo">Valor
        <input id="valor" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off">
      </label>

      <label class="campo">Descrição
        <input id="descricao" placeholder="ex.: freela" maxlength="60" autocomplete="off">
      </label>

      <label class="campo">Data
        <input id="data" type="date" value="${hojeTexto()}">
      </label>

      <div class="campo">Tipo
        <div class="chips" id="tipos">
          ${TIPOS_ENTRADA.map((t) => `<button type="button" class="chip" data-tipo="${t}">${t}</button>`).join("")}
        </div>
      </div>

      <div class="campo">Repetição
        <div class="chips" id="freqs">
          <button type="button" class="chip ativo" data-freq="unica">Única</button>
          <button type="button" class="chip" data-freq="quinzenal">Quinzenal (15 e 30)</button>
          <button type="button" class="chip" data-freq="mensal">🔁 Mensal</button>
        </div>
        <div class="detalhe" id="detalhe-freq" hidden></div>
      </div>

      <button class="botao" id="salvar">SALVAR</button>
    </section>`;

  const $valor = document.getElementById("valor");
  const $data = document.getElementById("data");
  ligarCampoValor($valor);

  function atualizarFreq() {
    document.querySelectorAll("#freqs .chip").forEach((c) => c.classList.toggle("ativo", c.dataset.freq === freq));
    const $d = document.getElementById("detalhe-freq");
    $d.hidden = freq === "unica";
    const dia = $data.value ? Number($data.value.slice(8)) : "?";
    $d.textContent = freq === "quinzenal"
      ? "Repete nos dias 15 e 30. Aparece prevista ⏳ e, no dia, o app pergunta se entrou."
      : `🔁 Repete todo dia ${dia}. Aparece prevista ⏳ e, no dia, o app pergunta se entrou.`;
  }
  document.getElementById("freqs").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (b) { freq = b.dataset.freq; atualizarFreq(); }
  });
  $data.addEventListener("change", atualizarFreq);

  document.getElementById("tipos").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    tipo = b.dataset.tipo;
    document.querySelectorAll("#tipos .chip").forEach((c) => c.classList.toggle("ativo", c === b));
  });

  document.getElementById("voltar").onclick = () => abrir("inicio");

  document.getElementById("salvar").onclick = () => {
    const valor = Number($valor.dataset.centavos) || 0;
    const data = document.getElementById("data").value;
    if (!valor) { avisoRapido("Digite o valor"); $valor.focus(); return; }
    if (!data) { avisoRapido("Escolha a data"); return; }
    if (!tipo) { avisoRapido("Escolha o tipo"); return; }

    salvarEntrada({ valor, data, tipo, freq, descricao: document.getElementById("descricao").value.trim() });
    quinzenaVista = quinzenaDe(data);
    abrir("inicio");
    avisoRapido({
      unica: "Entrada salva",
      quinzenal: "Entrada quinzenal salva: dias 15 e 30",
      mensal: `Entrada mensal salva: todo dia ${Number(data.slice(8))}`,
    }[freq]);
  };

  window.scrollTo(0, 0);
  $valor.focus();
}

// Nome exibido: descrição, ou "📒 <nome da Caderneta>", ou a categoria
function nomeLancamento(l) {
  if (l.categoria === CADERNETA) return `📒 ${l.descricao || dados.caderneta.nome}`;
  return l.descricao || l.categoria;
}

// Marca ao lado do nome: parcela, 🔁 recorrente ou ⏳ previsto (conta ou entrada fixa)
function marcaLancamento(l) {
  if (l.totalParcelas) return ` ${l.parcela}/${l.totalParcelas}`;
  if (l.recorrente) return " 🔁";
  if (l.contaPrevista || l.fixaPrevista) return " ⏳";
  return "";
}

function itemLancamento(l) {
  const sinal = l.tipo === "entrada" ? "+" : "−";
  const classe = l.tipo === "entrada" ? "entrada" : "gasto";
  const parc = marcaLancamento(l);
  return `<li class="clicavel" data-id="${l.id}">
    <span>${nomeLancamento(l)}${parc}<span class="data">${diaMes(l.data)}</span></span>
    <span class="${classe}">${sinal} ${reais(l.valor)}</span>
  </li>`;
}

// ---------- Painel de um lançamento (editar / excluir) ----------
// aoTerminar: função que redesenha a tela depois de editar ou excluir
function painelLancamento(l, aoTerminar) {
  // Conta prevista (⏳): abre as opções da conta (Paguei, Editar, Excluir)
  if (l.contaPrevista) {
    const item = contasDoMes(l.contaPrevista.am).find((i) => i.conta.id === l.contaPrevista.id);
    if (item) painelConta(item, aoTerminar);
    return;
  }
  // Entrada fixa prevista (⏳): confirmar se entrou, alterar ou parar
  if (l.fixaPrevista) {
    painelEntradaPrevista(l, aoTerminar);
    return;
  }

  const fundo = document.createElement("div");
  fundo.className = "painel-fundo";
  document.body.appendChild(fundo);
  const fechar = () => fundo.remove();
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });

  const categoria = l.categoria === CADERNETA ? `📒 ${dados.caderneta.nome}` : l.categoria;
  const cabecalho = `
    <h3>${nomeLancamento(l)}${l.totalParcelas ? ` ${l.parcela}/${l.totalParcelas}` : ""}${l.recorrente ? " 🔁" : ""}</h3>
    <p class="${l.tipo === "entrada" ? "entrada" : "gasto"}"><strong>${reais(l.valor)}</strong></p>
    <p class="suave">${dataCompleta(l.data)} · ${categoria}</p>`;

  const editar = (modo) => () => { fechar(); telaEditarLancamento(l, modo, aoTerminar); };
  const fixa = l.fixa && dados.entradasFixas.find((f) => f.id === l.fixa && f.ativo);

  // Edições: [texto do botão, ação]
  const edicoes = [];
  if (l.grupo) {
    edicoes.push(["✏️ Editar só esta parcela", editar("um")]);
    edicoes.push([`✏️ Editar todas as ${l.totalParcelas} parcelas`, editar("parcelas")]);
  } else if (l.recorrente) {
    edicoes.push(["✏️ Editar deste mês em diante", editar("recorrente")]);
  } else {
    edicoes.push(["✏️ Editar", editar("um")]);
  }
  if (fixa) edicoes.push(["💰 Alterar valor da entrada fixa", () => alterarSalario(fixa)]);

  // Exclusões: [texto do botão, pergunta de confirmação, ação, botão "sim", mensagem]
  const exclusoes = [];
  if (l.grupo) {
    exclusoes.push(["Excluir só esta parcela", `Excluir a parcela ${l.parcela}/${l.totalParcelas}?`, () => excluirLancamento(l)]);
    exclusoes.push([`Excluir todas as ${l.totalParcelas} parcelas`, `Excluir as ${l.totalParcelas} parcelas desta compra?`, () => excluirTodasParcelas(l.grupo)]);
  } else if (l.recorrente) {
    exclusoes.push(["Excluir só este mês", `Excluir o lançamento de ${dataCompleta(l.data)}? Os outros meses continuam.`, () => excluirLancamento(l)]);
    exclusoes.push(["Parar recorrência", "Parar a recorrência? Este mês e os próximos serão apagados. Os meses anteriores ficam.", () => pararRecorrencia(l.recorrente, l.data)]);
  } else {
    exclusoes.push(["🗑️ Excluir", "Excluir este lançamento?", () => excluirLancamento(l)]);
  }
  if (fixa) {
    exclusoes.push(["⏹️ Parar entrada fixa",
      `Parar a entrada fixa "${fixa.descricao || fixa.tipo}"? Ela deixa de aparecer nos próximos meses. As entradas já lançadas continuam.`,
      () => pararSalarioFixo(fixa.id), "Sim, parar", "Entrada fixa parada"]);
  }

  function mostrarOpcoes() {
    fundo.innerHTML = `<div class="painel">${cabecalho}
      ${edicoes.map(([texto], i) => `<button class="botao secundario" data-e="${i}">${texto}</button>`).join("")}
      ${exclusoes.map(([texto], i) => `<button class="botao perigo" data-x="${i}">${texto}</button>`).join("")}
      <button class="botao secundario" data-cancelar>Cancelar</button></div>`;
    fundo.querySelectorAll("[data-e]").forEach((b) => (b.onclick = edicoes[b.dataset.e][1]));
    fundo.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => confirmar(exclusoes[b.dataset.x])));
    fundo.querySelector("[data-cancelar]").onclick = fechar;
  }

  function confirmar([, pergunta, acao, sim = "Sim, excluir", mensagem = "Excluído"]) {
    fundo.innerHTML = `<div class="painel">${cabecalho}
      <p><strong>${pergunta}</strong></p>
      <button class="botao perigo" data-sim>${sim}</button>
      <button class="botao secundario" data-voltar>Voltar</button></div>`;
    fundo.querySelector("[data-sim]").onclick = () => {
      acao();
      fechar();
      aoTerminar();
      avisoRapido(mensagem);
    };
    fundo.querySelector("[data-voltar]").onclick = mostrarOpcoes;
  }

  function alterarSalario(f) {
    fundo.innerHTML = `<div class="painel">
      <h3>💰 ${f.descricao || f.tipo}</h3>
      <p class="suave">Valor atual: ${reais(f.valor)}. O novo valor vale para os próximos cartões "entrou?".</p>
      <label class="campo">Novo valor
        <input id="novo-salario" inputmode="numeric" placeholder="R$ 0,00">
      </label>
      <button class="botao" data-salvar>Salvar</button>
      <button class="botao secundario" data-voltar>Voltar</button></div>`;
    const $v = fundo.querySelector("#novo-salario");
    ligarCampoValor($v);
    $v.focus();
    fundo.querySelector("[data-voltar]").onclick = mostrarOpcoes;
    fundo.querySelector("[data-salvar]").onclick = () => {
      const valor = Number($v.dataset.centavos) || 0;
      if (!valor) { avisoRapido("Digite o valor"); return; }
      alterarSalarioFixo(f.id, valor);
      fechar();
      aoTerminar();
      avisoRapido(`Entrada fixa agora é ${reais(valor)}`);
    };
  }

  mostrarOpcoes();
}

// ---------- Painel de uma entrada fixa prevista (⏳) ----------
function painelEntradaPrevista(l, aoTerminar) {
  const f = dados.entradasFixas.find((x) => x.id === l.fixaPrevista.id);
  const data = l.fixaPrevista.data;
  const fundo = document.createElement("div");
  fundo.className = "painel-fundo";
  document.body.appendChild(fundo);
  const fechar = () => fundo.remove();
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });
  const terminar = (mensagem) => { fechar(); aoTerminar(); avisoRapido(mensagem); };

  const cabecalho = `
    <h3>${nomeLancamento(l)} ⏳</h3>
    <p class="entrada"><strong>${reais(f.valor)}</strong></p>
    <p class="suave">Prevista para ${dataCompleta(data)} · ${f.freq === "mensal" ? "mensal" : "quinzenal (15 e 30)"}</p>`;

  // Valor: confirmar quanto entrou, ou alterar o valor da entrada fixa
  function pedirValor(titulo, explicacao, aoSalvar) {
    fundo.innerHTML = `<div class="painel">${cabecalho}
      <p class="suave">${explicacao}</p>
      <label class="campo">${titulo}
        <input id="valor-fixa" inputmode="numeric">
      </label>
      <button class="botao" data-salvar>Salvar</button>
      <button class="botao secundario" data-voltar>Voltar</button></div>`;
    const $v = fundo.querySelector("#valor-fixa");
    ligarCampoValor($v);
    $v.value = reais(f.valor);
    $v.dataset.centavos = f.valor;
    fundo.querySelector("[data-voltar]").onclick = opcoes;
    fundo.querySelector("[data-salvar]").onclick = () => {
      const valor = Number($v.dataset.centavos) || 0;
      if (!valor) { avisoRapido("Digite o valor"); return; }
      aoSalvar(valor);
    };
  }

  function opcoes() {
    fundo.innerHTML = `<div class="painel">${cabecalho}
      <button class="botao" data-entrou>✅ Entrou</button>
      <button class="botao secundario" data-nao>Não entrou</button>
      <button class="botao secundario" data-alterar>💰 Alterar valor da entrada fixa</button>
      <button class="botao perigo" data-parar>⏹️ Parar entrada fixa</button>
      <button class="botao secundario" data-cancelar>Cancelar</button></div>`;
    fundo.querySelector("[data-entrou]").onclick = () =>
      pedirValor("Valor que entrou", "Confirme ou ajuste o valor.", (valor) => {
        responderEntrada(f, data, valor);
        terminar(`Entrada de ${reais(valor)} lançada`);
      });
    fundo.querySelector("[data-nao]").onclick = () => {
      responderEntrada(f, data, null);
      terminar("Marcado como não entrou");
    };
    fundo.querySelector("[data-alterar]").onclick = () =>
      pedirValor("Novo valor", "O novo valor vale para esta e as próximas.", (valor) => {
        alterarSalarioFixo(f.id, valor);
        terminar(`Entrada fixa agora é ${reais(valor)}`);
      });
    fundo.querySelector("[data-parar]").onclick = () => {
      fundo.innerHTML = `<div class="painel">${cabecalho}
        <p><strong>Parar a entrada fixa "${f.descricao || f.tipo}"? Ela deixa de aparecer nos próximos meses. As entradas já lançadas continuam.</strong></p>
        <button class="botao perigo" data-sim>Sim, parar</button>
        <button class="botao secundario" data-voltar>Voltar</button></div>`;
      fundo.querySelector("[data-sim]").onclick = () => { pararSalarioFixo(f.id); terminar("Entrada fixa parada"); };
      fundo.querySelector("[data-voltar]").onclick = opcoes;
    };
    fundo.querySelector("[data-cancelar]").onclick = fechar;
  }

  opcoes();
}

// ---------- Editar lançamento ----------
// modo: "um" (só este) | "parcelas" (todas as parcelas) | "recorrente" (deste mês em diante)
function telaEditarLancamento(l, modo, aoTerminar) {
  const ehCaderneta = l.categoria === CADERNETA;
  const ehEntrada = l.tipo === "entrada";
  const opcoesCategoria = ehCaderneta ? [] : ehEntrada ? TIPOS_ENTRADA : CATEGORIAS;
  const mostraData = modo === "um";
  let categoria = l.categoria;

  const titulo = { um: ehEntrada ? "Editar entrada" : "Editar gasto", parcelas: "Editar parcelas", recorrente: "Editar recorrente" }[modo];
  const explicacao = {
    parcelas: `A mudança vale para as ${l.totalParcelas} parcelas. Cada uma mantém sua data.`,
    recorrente: `A mudança vale a partir de ${dataCompleta(l.data)}. Os meses anteriores ficam como estavam.`,
  }[modo];

  $tela.innerHTML = `
    <div class="topo-form">
      <button class="voltar" id="voltar" aria-label="Voltar">←</button>
      <h1>${titulo}</h1>
    </div>

    <section class="cartao form">
      ${explicacao ? `<p class="suave">${explicacao}</p>` : ""}
      <label class="campo">${modo === "parcelas" ? "Valor de cada parcela" : "Valor"}
        <input id="valor" inputmode="numeric" autocomplete="off">
      </label>

      <label class="campo" ${ehCaderneta ? "hidden" : ""}>Descrição
        <input id="descricao" maxlength="60" autocomplete="off">
      </label>

      <label class="campo" ${mostraData ? "" : "hidden"}>Data
        <input id="data" type="date">
      </label>

      <div class="campo" ${opcoesCategoria.length ? "" : "hidden"}>${ehEntrada ? "Tipo" : "Categoria"}
        <div class="chips" id="categorias">
          ${opcoesCategoria.map((c) => `<button type="button" class="chip ${c === categoria ? "ativo" : ""}" data-cat="${c}">${c}</button>`).join("")}
        </div>
      </div>

      <button class="botao" id="salvar">SALVAR</button>
    </section>`;

  const $valor = document.getElementById("valor");
  const $descricao = document.getElementById("descricao");
  const $data = document.getElementById("data");
  ligarCampoValor($valor);
  $valor.value = reais(l.valor);
  $valor.dataset.centavos = l.valor;
  $descricao.value = l.descricao || "";
  $data.value = l.data;

  document.getElementById("categorias").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    categoria = b.dataset.cat;
    document.querySelectorAll("#categorias .chip").forEach((c) => c.classList.toggle("ativo", c === b));
  });
  document.getElementById("voltar").onclick = aoTerminar;

  document.getElementById("salvar").onclick = () => {
    const valor = Number($valor.dataset.centavos) || 0;
    if (!valor) { avisoRapido("Digite o valor"); $valor.focus(); return; }
    if (mostraData && !$data.value) { avisoRapido("Escolha a data"); return; }
    const campos = { valor, descricao: ehCaderneta ? "" : $descricao.value.trim(), categoria };

    if (modo === "parcelas") editarTodasParcelas(l.grupo, campos);
    else if (modo === "recorrente") editarRecorrenciaDesde(l.recorrente, l.data, campos);
    else editarLancamento(l.id, { ...campos, data: $data.value });

    aoTerminar();
    avisoRapido("Alterado");
  };

  window.scrollTo(0, 0);
}

// ---------- Campo de valor: digita só números, preenche da direita (centavos) ----------
function ligarCampoValor(input, aoMudar) {
  input.addEventListener("input", () => {
    const centavos = Number(input.value.replace(/\D/g, "").slice(0, 11)) || 0;
    input.value = centavos ? reais(centavos) : "";
    input.dataset.centavos = centavos;
    aoMudar?.();
  });
}

// ---------- Novo gasto ----------
function telaNovoGasto() {
  const MAX_PARCELAS = 48;
  let categoria = null;
  let repeticao = "unica"; // "unica" | "parcelada" | "recorrente"
  let parcelas = 2;

  $tela.innerHTML = `
    <div class="topo-form">
      <button class="voltar" id="voltar" aria-label="Voltar">←</button>
      <h1>Novo gasto</h1>
    </div>

    <label class="botao secundario largo ler-cupom" id="ler-cupom">📷 Ler cupom
      <input type="file" id="foto-cupom" accept="image/*" capture="environment" hidden>
    </label>
    <div class="cartao leitura" id="leitura" hidden></div>

    <section class="cartao form">
      <label class="campo">Valor total
        <input id="valor" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off">
      </label>

      <label class="campo">Descrição
        <input id="descricao" placeholder="ex.: mercado" maxlength="60" autocomplete="off">
      </label>

      <label class="campo">Data
        <input id="data" type="date" value="${hojeTexto()}">
      </label>

      <div class="campo" id="bloco-repeticao">Repetição
        <div class="chips" id="repeticoes">
          <button type="button" class="chip ativo" data-rep="unica">Única</button>
          <button type="button" class="chip" data-rep="parcelada">Parcelada</button>
          <button type="button" class="chip" data-rep="recorrente">🔁 Recorrente</button>
        </div>

        <div id="bloco-parcelas" hidden>
          <div class="contador">
            <button type="button" id="menos" aria-label="Menos parcelas">−</button>
            <strong id="n-parcelas"></strong>
            <button type="button" id="mais" aria-label="Mais parcelas">+</button>
          </div>
          <div class="detalhe" id="detalhe-parcelas"></div>
        </div>

        <div class="detalhe" id="detalhe-recorrente" hidden></div>
      </div>

      <div class="campo">Categoria
        <div class="chips" id="categorias">
          ${CATEGORIAS.map((c) => `<button type="button" class="chip" data-cat="${c}">${c}</button>`).join("")}
        </div>
      </div>

      <button class="botao" id="salvar">SALVAR</button>
    </section>`;

  const $valor = document.getElementById("valor");
  const $data = document.getElementById("data");
  const $detalhe = document.getElementById("detalhe-parcelas");

  function atualizarParcelas() {
    document.querySelectorAll("#repeticoes .chip").forEach((c) =>
      c.classList.toggle("ativo", c.dataset.rep === repeticao));
    document.getElementById("bloco-parcelas").hidden = repeticao !== "parcelada";

    const $rec = document.getElementById("detalhe-recorrente");
    $rec.hidden = repeticao !== "recorrente";
    if ($data.value) {
      $rec.textContent = `🔁 Todo dia ${Number($data.value.slice(8))}, a partir de ${dataCompleta($data.value)}`;
    }

    document.getElementById("n-parcelas").textContent = parcelas;
    document.getElementById("menos").disabled = parcelas <= 2;
    document.getElementById("mais").disabled = parcelas >= MAX_PARCELAS;

    const total = Number($valor.dataset.centavos) || 0;
    if (!total || !$data.value) { $detalhe.textContent = `${parcelas}× (digite o valor)`; return; }
    const valores = dividirParcelas(total, parcelas);
    const datas = datasParcelas($data.value, parcelas);
    const iguais = valores.every((v) => v === valores[0]);
    $detalhe.innerHTML = (iguais
      ? `→ ${parcelas}× de ${reais(valores[0])}`
      : `→ 1× de ${reais(valores[0])} + ${parcelas - 1}× de ${reais(valores[1])}`)
      + `<br><small>${datas.map(diaMes).join(", ")}</small>`;
  }

  ligarCampoValor($valor, atualizarParcelas);

  // 📷 Ler cupom: preenche valor, descrição (loja) e data com o que o OCR encontrar
  document.getElementById("foto-cupom").addEventListener("change", async (e) => {
    const arquivo = e.target.files[0];
    e.target.value = "";
    if (!arquivo) return;
    const $leitura = document.getElementById("leitura");
    const $botao = document.getElementById("ler-cupom");
    $botao.classList.add("ocupado");
    $leitura.hidden = false;
    $leitura.innerHTML = `<p>🔎 Lendo cupom... <span id="pct">0%</span></p><div class="barra"><div id="barra"></div></div>`;
    try {
      const r = await lerCupom(arquivo, (p) => {
        document.getElementById("pct").textContent = `${Math.round(p * 100)}%`;
        document.getElementById("barra").style.width = `${p * 100}%`;
      });
      if (r.valor) { $valor.value = reais(r.valor); $valor.dataset.centavos = r.valor; }
      if (r.loja) document.getElementById("descricao").value = r.loja;
      if (r.data) $data.value = r.data;
      atualizarParcelas();
      const achou = [r.valor && "valor", r.loja && "loja", r.data && "data"].filter(Boolean);
      $leitura.innerHTML = achou.length === 3
        ? `<p>✅ Cupom lido. <strong>Confira os campos</strong> antes de salvar.</p>`
        : `<p>⚠️ Encontrei: ${achou.join(", ") || "nada"}. Complete o que faltar.</p>
           <p class="suave">Dica: cupom esticado, boa luz e foto reta e de perto.</p>`;
    } catch (erro) {
      $leitura.innerHTML = erro.message === "sem-internet"
        ? `<p>📶 Na primeira vez, o leitor precisa de internet para ser baixado. Conecte e tente de novo.</p>`
        : `<p>❌ Não consegui ler a foto. Tente outra, com mais luz.</p>`;
    } finally {
      $botao.classList.remove("ocupado");
    }
  });
  $data.addEventListener("change", atualizarParcelas);
  document.getElementById("menos").onclick = () => { parcelas--; atualizarParcelas(); };
  document.getElementById("mais").onclick = () => { parcelas++; atualizarParcelas(); };

  document.getElementById("repeticoes").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    repeticao = b.dataset.rep;
    atualizarParcelas();
  });

  document.getElementById("categorias").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (!b) return;
    categoria = b.dataset.cat;
    document.querySelectorAll("#categorias .chip").forEach((c) => c.classList.toggle("ativo", c === b));
  });

  document.getElementById("voltar").onclick = () => abrir("inicio");

  document.getElementById("salvar").onclick = () => {
    const valor = Number($valor.dataset.centavos) || 0;
    if (!valor) { avisoRapido("Digite o valor"); $valor.focus(); return; }
    if (!$data.value) { avisoRapido("Escolha a data"); return; }
    if (!categoria) { avisoRapido("Escolha a categoria"); return; }

    const gasto = { valor, data: $data.value, categoria, descricao: document.getElementById("descricao").value.trim() };
    let mensagem = "Gasto salvo";
    if (repeticao === "recorrente") {
      salvarRecorrente(gasto);
      mensagem = `Recorrente salvo: todo dia ${Number(gasto.data.slice(8))}`;
    } else if (repeticao === "parcelada") {
      salvarGasto({ ...gasto, parcelas });
      mensagem = `Gasto salvo em ${parcelas} parcelas`;
    } else {
      salvarGasto({ ...gasto, parcelas: 1 });
    }
    quinzenaVista = quinzenaDe($data.value);
    abrir("inicio");
    avisoRapido(mensagem);
  };

  atualizarParcelas();
  window.scrollTo(0, 0);
  $valor.focus();
}

// ---------- Lançar na Caderneta: só valor e data ----------
function telaLancarCaderneta() {
  $tela.innerHTML = `
    <div class="topo-form">
      <button class="voltar" id="voltar" aria-label="Voltar">←</button>
      <h1>Lançar na ${dados.caderneta.nome}</h1>
    </div>

    <section class="cartao form">
      <label class="campo">Valor
        <input id="valor" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off">
      </label>

      <label class="campo">Data
        <input id="data" type="date" value="${hojeTexto()}">
      </label>

      <button class="botao" id="salvar">SALVAR</button>
    </section>`;

  const $valor = document.getElementById("valor");
  ligarCampoValor($valor);
  document.getElementById("voltar").onclick = telaCaderneta;

  document.getElementById("salvar").onclick = () => {
    const valor = Number($valor.dataset.centavos) || 0;
    const data = document.getElementById("data").value;
    if (!valor) { avisoRapido("Digite o valor"); $valor.focus(); return; }
    if (!data) { avisoRapido("Escolha a data"); return; }
    salvarGasto({ valor, data, categoria: CADERNETA, descricao: "", parcelas: 1 });
    telaCaderneta();
    avisoRapido(`${reais(valor)} lançado na ${dados.caderneta.nome}`);
  };

  window.scrollTo(0, 0);
  $valor.focus();
}

// ---------- Caderneta ----------
function telaCaderneta() {
  const abertos = cadernetaEmAberto();
  const total = totalCaderneta();
  const pagamentos = [...dados.caderneta.pagamentos].reverse();

  $tela.innerHTML = `
    <div class="topo-form" id="titulo-cad">
      <h1>📒 ${dados.caderneta.nome}</h1>
      <button class="voltar" id="renomear" aria-label="Renomear">✏️</button>
    </div>

    <section class="cartao">
      <div class="saldo">
        <small>Total pendurado</small>
        <strong class="cad">${reais(total)}</strong>
      </div>
      <div id="area-pagar">
        <button class="botao" id="paguei" ${total ? "" : "disabled"}>✅ PAGUEI</button>
      </div>
    </section>

    <button class="botao secundario largo" id="lancar-cad">+ Lançar na ${dados.caderneta.nome}</button>

    <section class="cartao">
      <h2>Lançamentos em aberto</h2>
      ${abertos.length ? `<ul class="lista" id="abertos">${abertos.map(itemLancamento).join("")}</ul>`
        : `<p class="vazio">Nada pendurado. 🎉</p>`}
    </section>

    <section class="cartao">
      <h2>Pagamentos anteriores</h2>
      ${pagamentos.length ? `<ul class="lista" id="pagamentos">${pagamentos.map((p) => `
        <li class="clicavel pagamento" data-id="${p.id}">
          <span>${dataCompleta(p.data)} · Pago</span>
          <span>${reais(p.valor)} <span class="seta">▸</span></span>
        </li>
        <li class="detalhes-pagamento" data-de="${p.id}" hidden>
          ${dados.lancamentos.filter((l) => l.pagamento === p.id)
            .sort((a, b) => a.data.localeCompare(b.data))
            .map((l) => `<div><span>${diaMes(l.data)} ${l.descricao || ""}</span><span>${reais(l.valor)}</span></div>`).join("")
            || `<div><span class="suave">Lançamentos excluídos</span></div>`}
        </li>`).join("")}</ul>`
        : `<p class="vazio">Nenhum pagamento ainda.</p>`}
    </section>`;

  // Renomear
  document.getElementById("renomear").onclick = () => {
    const $t = document.getElementById("titulo-cad");
    $t.innerHTML = `
      <input id="novo-nome" class="valor-aviso" maxlength="25" value="${dados.caderneta.nome.replaceAll('"', "&quot;")}">
      <button class="botao" id="salvar-nome">Salvar</button>`;
    const $n = document.getElementById("novo-nome");
    $n.focus(); $n.select();
    document.getElementById("salvar-nome").onclick = () => {
      const nome = $n.value.trim();
      if (!nome) { avisoRapido("Digite um nome"); return; }
      renomearCaderneta(nome);
      atualizarMenu();
      telaCaderneta();
      avisoRapido("Nome alterado");
    };
  };

  // Paguei → confirmação
  document.getElementById("paguei").onclick = () => {
    document.getElementById("area-pagar").innerHTML = `
      <p style="text-align:center"><strong>Confirmar pagamento de ${reais(total)}?</strong></p>
      <div class="acoes">
        <button class="botao" id="sim-paguei">Sim, paguei</button>
        <button class="botao secundario" id="nao-paguei">Voltar</button>
      </div>`;
    document.getElementById("sim-paguei").onclick = () => {
      const p = pagarCaderneta();
      telaCaderneta();
      if (p) avisoRapido(`Pagamento de ${reais(p.valor)} registrado`);
    };
    document.getElementById("nao-paguei").onclick = telaCaderneta;
  };

  document.getElementById("lancar-cad").onclick = telaLancarCaderneta;

  const $abertos = document.getElementById("abertos");
  if ($abertos) $abertos.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    const l = li && abertos.find((x) => x.id === li.dataset.id);
    if (l) painelLancamento(l, telaCaderneta);
  });

  const $pags = document.getElementById("pagamentos");
  if ($pags) $pags.addEventListener("click", (e) => {
    const li = e.target.closest("li.pagamento");
    if (!li) return;
    const det = $pags.querySelector(`[data-de="${li.dataset.id}"]`);
    det.hidden = !det.hidden;
    li.querySelector(".seta").textContent = det.hidden ? "▸" : "▾";
  });
}

// ---------- Menu inferior ----------
const TELAS = {
  inicio: telaInicio,
  caderneta: telaCaderneta,
  contas: telaContas,
  historico: telaHistorico,
};

function abrir(nome) {
  document.querySelectorAll(".menu button").forEach((b) =>
    b.classList.toggle("ativo", b.dataset.tela === nome));
  TELAS[nome]();
  window.scrollTo(0, 0);
}

document.querySelector(".menu").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (b) abrir(b.dataset.tela);
});

// O botão da Caderneta no menu mostra o nome escolhido
function atualizarMenu() {
  document.querySelector('.menu [data-tela="caderneta"]').innerHTML =
    `<span class="icone">📒</span><span class="rotulo">${dados.caderneta.nome}</span>`;
}

// Funcionamento sem internet (só no site publicado; no computador atrapalharia ver as mudanças)
if ("serviceWorker" in navigator && location.hostname !== "localhost") {
  navigator.serviceWorker.register("sw.js");
}

atualizarMenu();
gerarRecorrentes();
abrir("inicio");
