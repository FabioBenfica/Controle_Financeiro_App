// ============================================================
//  CONTAS A PAGAR — telas
// ============================================================

let mesContasVisto = mesDe(hojeTexto());

const STATUS_CONTA = {
  vencida: { icone: "🔴", texto: "VENCIDA", classe: "gasto" },
  hoje:    { icone: "🟡", texto: "vence hoje", classe: "cad" },
  amanha:  { icone: "🟡", texto: "vence amanhã", classe: "cad" },
  aberta:  { icone: "⚪", texto: "", classe: "" },
  paga:    { icone: "✅", texto: "", classe: "entrada" },
};

function nomeMes(am) {
  const [a, m] = am.split("-").map(Number);
  return `${MESES[m - 1]}${a !== new Date().getFullYear() ? ` ${a}` : ""}`;
}

// ---------- Tela Contas ----------
function telaContas() {
  const itens = contasDoMes(mesContasVisto);
  const aPagar = itens.filter((i) => !i.gasto).reduce((s, i) => s + i.conta.valor, 0);
  const pagas = itens.filter((i) => i.gasto).reduce((s, i) => s + i.gasto.valor, 0);

  $tela.innerHTML = `
    <h1>📄 Contas</h1>

    <section class="cartao">
      <div class="periodo">
        <button id="m-anterior" aria-label="Mês anterior">◀</button>
        <span>${nomeMes(mesContasVisto)}</span>
        <button id="m-seguinte" aria-label="Próximo mês">▶</button>
      </div>
      <div class="mes">
        <div><small>A pagar</small><strong class="gasto">${reais(aPagar)}</strong></div>
        <div><small>Pagas</small><strong class="entrada">${reais(pagas)}</strong></div>
      </div>
    </section>

    <section class="cartao">
      ${itens.length ? `<ul class="lista" id="lista-contas">${itens.map((item, i) => {
        const s = STATUS_CONTA[item.status];
        const detalhe = item.gasto
          ? `paga em ${diaMes(item.gasto.data)} · ${reais(item.gasto.valor)}`
          : s.texto;
        return `<li class="clicavel conta" data-i="${i}">
          <span>${s.icone} <strong>${diaMes(item.venc)}</strong> ${item.conta.descricao}
            ${item.conta.repete ? "" : `<small class="suave">(única)</small>`}
            <span class="data ${s.classe}">${detalhe}</span></span>
          <span>${item.gasto ? "" : reais(item.conta.valor)}
            ${item.gasto ? "" : `<button class="botao mini" data-pagar="${i}">Paguei</button>`}</span>
        </li>`;
      }).join("")}</ul>` : `<p class="vazio">Nenhuma conta neste mês.</p>`}
    </section>

    <button class="botao largo" id="nova-conta">+ Nova conta</button>`;

  document.getElementById("m-anterior").onclick = () => { mesContasVisto = somarMesesAM(mesContasVisto, -1); telaContas(); };
  document.getElementById("m-seguinte").onclick = () => { mesContasVisto = somarMesesAM(mesContasVisto, 1); telaContas(); };
  document.getElementById("nova-conta").onclick = () => telaFormConta();

  const $lista = document.getElementById("lista-contas");
  if ($lista) $lista.addEventListener("click", (e) => {
    const pagar = e.target.closest("[data-pagar]");
    if (pagar) { painelPagarConta(itens[pagar.dataset.pagar], telaContas); return; }
    const li = e.target.closest("li[data-i]");
    if (li) painelConta(itens[li.dataset.i]);
  });
}

// ---------- Painel "Paguei": confirma ou ajusta o valor ----------
function painelPagarConta(item, aoTerminar) {
  const fundo = document.createElement("div");
  fundo.className = "painel-fundo";
  fundo.innerHTML = `<div class="painel">
    <h3>${item.conta.descricao}</h3>
    <p class="suave">Vencimento ${dataCompleta(item.venc)} · ${item.conta.categoria}</p>
    <label class="campo">Valor pago
      <input id="valor-pago" inputmode="numeric">
    </label>
    <button class="botao" data-sim>✅ Confirmar pagamento</button>
    <button class="botao secundario" data-nao>Cancelar</button>
  </div>`;
  document.body.appendChild(fundo);

  const $v = fundo.querySelector("#valor-pago");
  ligarCampoValor($v);
  $v.value = reais(item.conta.valor);
  $v.dataset.centavos = item.conta.valor;

  const fechar = () => fundo.remove();
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });
  fundo.querySelector("[data-nao]").onclick = fechar;
  fundo.querySelector("[data-sim]").onclick = () => {
    const valor = Number($v.dataset.centavos) || 0;
    if (!valor) { avisoRapido("Digite o valor"); return; }
    pagarConta(item.conta, item.am, valor);
    fechar();
    aoTerminar();
    avisoRapido(`${item.conta.descricao}: ${reais(valor)} lançado nos gastos`);
  };
}

// ---------- Painel ao tocar numa conta: editar / excluir ----------
// aoTerminar: tela redesenhada depois de pagar ou excluir
function painelConta(item, aoTerminar = telaContas) {
  const { conta, am } = item;
  const fundo = document.createElement("div");
  fundo.className = "painel-fundo";
  document.body.appendChild(fundo);
  const fechar = () => fundo.remove();
  fundo.addEventListener("click", (e) => { if (e.target === fundo) fechar(); });

  const cabecalho = `
    <h3>${conta.descricao}</h3>
    <p><strong>${reais(conta.valor)}</strong></p>
    <p class="suave">${conta.repete ? `Todo dia ${conta.dia}` : `Só uma vez · ${dataCompleta(item.venc)}`} · ${conta.categoria}</p>`;

  const exclusoes = conta.repete
    ? [
        ["Excluir só deste mês", `Tirar "${conta.descricao}" só de ${nomeMes(am)}?`, "mes"],
        ["Excluir deste mês em diante", `Encerrar "${conta.descricao}" a partir de ${nomeMes(am)}? Os meses anteriores ficam.`, "seguintes"],
      ]
    : [["🗑️ Excluir conta", `Excluir "${conta.descricao}"?`, "tudo"]];

  function opcoes() {
    fundo.innerHTML = `<div class="painel">${cabecalho}
      ${item.gasto ? "" : `<button class="botao" data-pagar>✅ Paguei</button>`}
      <button class="botao secundario" data-editar>✏️ Editar</button>
      ${exclusoes.map(([texto], i) => `<button class="botao perigo" data-excluir="${i}">${texto}</button>`).join("")}
      <button class="botao secundario" data-cancelar>Cancelar</button></div>`;
    fundo.querySelector("[data-pagar]")?.addEventListener("click", () => { fechar(); painelPagarConta(item, aoTerminar); });
    fundo.querySelector("[data-editar]").onclick = () => { fechar(); telaFormConta(conta); };
    fundo.querySelector("[data-cancelar]").onclick = fechar;
    fundo.querySelectorAll("[data-excluir]").forEach((b) => (b.onclick = () => confirmar(exclusoes[b.dataset.excluir])));
  }

  function confirmar([, pergunta, modo]) {
    fundo.innerHTML = `<div class="painel">${cabecalho}
      <p><strong>${pergunta}</strong></p>
      ${item.gasto ? `<p class="suave">O pagamento já lançado nos gastos continua lá.</p>` : ""}
      <button class="botao perigo" data-sim>Sim, excluir</button>
      <button class="botao secundario" data-voltar>Voltar</button></div>`;
    fundo.querySelector("[data-sim]").onclick = () => {
      excluirConta(conta, am, modo);
      fechar();
      aoTerminar();
      avisoRapido("Conta excluída");
    };
    fundo.querySelector("[data-voltar]").onclick = opcoes;
  }

  opcoes();
}

// ---------- Nova conta / Editar conta ----------
function telaFormConta(conta = null) {
  let repete = conta ? conta.repete : true;
  let categoria = conta ? conta.categoria : null;

  $tela.innerHTML = `
    <div class="topo-form">
      <button class="voltar" id="voltar" aria-label="Voltar">←</button>
      <h1>${conta ? "Editar conta" : "Nova conta"}</h1>
    </div>

    <section class="cartao form">
      <label class="campo">Descrição
        <input id="descricao" placeholder="ex.: conta de luz" maxlength="40" autocomplete="off">
      </label>

      <label class="campo">Valor (aproximado)
        <input id="valor" inputmode="numeric" placeholder="R$ 0,00" autocomplete="off">
      </label>

      <label class="campo">Dia do vencimento
        <input id="dia" type="number" inputmode="numeric" min="1" max="31" placeholder="ex.: 10">
      </label>

      <div class="campo">Repetição
        <div class="chips" id="repeticao-conta">
          <button type="button" class="chip" data-rep="1">Todo mês</button>
          <button type="button" class="chip" data-rep="0">Só uma vez</button>
        </div>
      </div>

      <label class="campo" id="bloco-mes">Mês do vencimento
        <input id="mes" type="month">
      </label>

      <div class="campo">Categoria
        <div class="chips" id="categorias">
          ${CATEGORIAS.map((c) => `<button type="button" class="chip" data-cat="${c}">${c}</button>`).join("")}
        </div>
      </div>

      <button class="botao" id="salvar">SALVAR</button>
    </section>`;

  const $descricao = document.getElementById("descricao");
  const $valor = document.getElementById("valor");
  const $dia = document.getElementById("dia");
  const $mes = document.getElementById("mes");
  ligarCampoValor($valor);

  // Preenche ao editar
  $mes.value = conta?.mes || mesContasVisto;
  if (conta) {
    $descricao.value = conta.descricao;
    $valor.value = reais(conta.valor);
    $valor.dataset.centavos = conta.valor;
    $dia.value = conta.dia;
  }

  function atualizar() {
    document.querySelectorAll("#repeticao-conta .chip").forEach((c) =>
      c.classList.toggle("ativo", c.dataset.rep === (repete ? "1" : "0")));
    document.getElementById("bloco-mes").hidden = repete;
    document.querySelectorAll("#categorias .chip").forEach((c) =>
      c.classList.toggle("ativo", c.dataset.cat === categoria));
  }

  document.getElementById("repeticao-conta").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (b) { repete = b.dataset.rep === "1"; atualizar(); }
  });
  document.getElementById("categorias").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (b) { categoria = b.dataset.cat; atualizar(); }
  });
  document.getElementById("voltar").onclick = telaContas;

  document.getElementById("salvar").onclick = () => {
    const descricao = $descricao.value.trim();
    const valor = Number($valor.dataset.centavos) || 0;
    const dia = Number($dia.value);
    if (!descricao) { avisoRapido("Digite a descrição"); $descricao.focus(); return; }
    if (!valor) { avisoRapido("Digite o valor"); $valor.focus(); return; }
    if (!Number.isInteger(dia) || dia < 1 || dia > 31) { avisoRapido("Dia do vencimento: de 1 a 31"); $dia.focus(); return; }
    if (!repete && !$mes.value) { avisoRapido("Escolha o mês"); return; }
    if (!categoria) { avisoRapido("Escolha a categoria"); return; }

    const novo = { descricao, valor, dia, categoria, repete };
    if (repete) {
      novo.inicio = conta?.inicio || mesDe(hojeTexto());
      novo.mes = undefined;
    } else {
      novo.mes = $mes.value;
      mesContasVisto = $mes.value;
    }
    salvarConta(novo, conta?.id);
    telaContas();
    avisoRapido(conta ? "Conta alterada" : "Conta salva");
  };

  atualizar();
  window.scrollTo(0, 0);
  if (!conta) $descricao.focus();
}

// ---------- Avisos de vencimento na tela principal ----------
function mostrarAvisosContas() {
  const $a = document.getElementById("avisos-contas");
  const avisos = avisosDeContas();
  $a.innerHTML = avisos.map((item) => {
    const s = STATUS_CONTA[item.status];
    const quando = item.status === "vencida" ? `venceu em ${diaMes(item.venc)}` : s.texto;
    return `<button class="aviso-conta ${item.status === "vencida" ? "vencida" : ""}">
      ${s.icone} <strong>${item.conta.descricao}</strong> ${quando} – ${reais(item.conta.valor)}</button>`;
  }).join("");
  $a.querySelectorAll(".aviso-conta").forEach((b, i) => (b.onclick = () => {
    mesContasVisto = avisos[i].am;
    abrir("contas");
  }));
}
