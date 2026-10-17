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
        <strong class="${tq.saldo < 0 ? "negativo" : ""}">${reais(tq.saldo)}</strong>
      </div>
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

  document.getElementById("novo-gasto").onclick = () => avisoRapido("Novo gasto: chega na fase 2");
  document.getElementById("nova-entrada").onclick = () => avisoRapido("Nova entrada: chega na fase 3");
}

function itemLancamento(l) {
  const sinal = l.tipo === "entrada" ? "+" : "−";
  const classe = l.tipo === "entrada" ? "entrada" : "gasto";
  const cad = l.categoria === "Caderneta" ? " 📒" : "";
  return `<li>
    <span>${l.descricao || l.categoria}${cad}<span class="data">${diaMes(l.data)}</span></span>
    <span class="${classe}">${sinal} ${reais(l.valor)}</span>
  </li>`;
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

abrir("inicio");
