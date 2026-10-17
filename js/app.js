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
    <h1>Controle Financeiro</h1>
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
      <div class="linha"><span>Saiu</span><span class="gasto">${reais(tq.saiu)}</span></div>
      <div class="linha"><span>Na ${dados.caderneta.nome}</span><span class="cad">${reais(totalCaderneta())}</span></div>
    </section>

    <section class="cartao">
      <h2>Mês: ${MESES[mes - 1]}</h2>
      <div class="mes">
        <div><small>Entrou</small><strong class="entrada">${reais(tm.entrou)}</strong></div>
        <div><small>Saiu</small><strong class="gasto">${reais(tm.saiu)}</strong></div>
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

  document.getElementById("novo-gasto").onclick = telaNovoGasto;
  document.getElementById("nova-entrada").onclick = () => avisoRapido("Nova entrada: chega na fase 3");
}

function itemLancamento(l) {
  const sinal = l.tipo === "entrada" ? "+" : "−";
  const classe = l.tipo === "entrada" ? "entrada" : "gasto";
  const cad = l.categoria === CADERNETA ? " 📒" : "";
  const parc = l.totalParcelas ? ` ${l.parcela}/${l.totalParcelas}` : l.recorrente ? " 🔁" : "";
  return `<li>
    <span>${l.descricao || l.categoria}${parc}${cad}<span class="data">${diaMes(l.data)}</span></span>
    <span class="${classe}">${sinal} ${reais(l.valor)}</span>
  </li>`;
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
          <button type="button" class="chip chip-cad" data-cat="${CADERNETA}">📒 ${dados.caderneta.nome}</button>
        </div>
      </div>

      <button class="botao" id="salvar">SALVAR</button>
    </section>`;

  const $valor = document.getElementById("valor");
  const $data = document.getElementById("data");
  const $detalhe = document.getElementById("detalhe-parcelas");

  function atualizarParcelas() {
    // Caderneta é sempre paga de uma vez: sem opções de repetição
    if (categoria === CADERNETA) repeticao = "unica";
    document.getElementById("bloco-repeticao").hidden = categoria === CADERNETA;
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
    atualizarParcelas();
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

// ---------- Telas das próximas fases ----------
function telaEmConstrucao(nome, fase) {
  $tela.innerHTML = `
    <h1>${nome}</h1>
    <section class="cartao"><p class="vazio">🚧 Esta tela chega na fase ${fase}.</p></section>`;
}

// ---------- Menu inferior ----------
const TELAS = {
  inicio: telaInicio,
  caderneta: () => telaEmConstrucao(`📒 ${dados.caderneta.nome}`, 4),
  contas: () => telaEmConstrucao("📄 Contas", 5),
  historico: () => telaEmConstrucao("📋 Histórico", 6),
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

gerarRecorrentes();
abrir("inicio");
