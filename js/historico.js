// ============================================================
//  HISTÓRICO — resumo do mês e lançamentos, uma linha cada
// ============================================================

let mesHistorico = mesDe(hojeTexto());
let filtroHistorico = "todos"; // "todos" | "gasto" | "entrada"

function telaHistorico() {
  const am = mesHistorico;
  const ehAtual = am === mesDe(hojeTexto());
  const [a, m] = am.split("-").map(Number);
  const todos = lancamentosEntre(`${am}-01`, `${am}-${ultimoDiaDoMes(a, m - 1)}`);
  const lista = todos
    .filter((l) => filtroHistorico === "todos" || l.tipo === filtroHistorico)
    .sort((x, y) => y.data.localeCompare(x.data));
  const t = totais(todos);

  $tela.innerHTML = `
    <h1>📋 Histórico</h1>

    <section class="cartao">
      <div class="periodo">
        <button id="h-anterior" aria-label="Mês anterior">◀</button>
        <span>${nomeMes(am)}</span>
        <button id="h-seguinte" aria-label="Próximo mês">▶</button>
      </div>
      ${ehAtual ? "" : `<div style="text-align:center"><button class="link" id="h-hoje">voltar para o mês atual</button></div>`}
      <div class="linha"><span>Entrou</span><span class="entrada">${reais(t.entrou)}</span></div>
      <div class="linha"><span>Saiu</span><span class="gasto">${reais(t.saiu)}</span></div>
      <div class="linha"><strong>Saldo do mês</strong><strong class="${t.saldo < 0 ? "gasto" : ""}">${reais(t.saldo)}</strong></div>
    </section>

    <div class="chips filtros" id="filtros">
      ${[["todos", "Todos"], ["gasto", "Gastos"], ["entrada", "Entradas"]].map(([f, nome]) =>
        `<button class="chip ${f === filtroHistorico ? "ativo" : ""}" data-f="${f}">${nome}</button>`).join("")}
    </div>

    <section class="cartao">
      ${lista.length ? `<ul class="lista compacta" id="itens">${lista.map((l) => `
        <li class="clicavel" data-id="${l.id}">
          <span><span class="dia-curto">${diaMes(l.data)}</span> ${nomeLancamento(l)}${marcaLancamento(l)}</span>
          <span class="${l.tipo === "entrada" ? "entrada" : "gasto"}">${l.tipo === "entrada" ? "+" : "−"} ${reais(l.valor)}</span>
        </li>`).join("")}</ul>`
        : `<p class="vazio">Nenhum lançamento neste mês.</p>`}
    </section>

    ${lista.some((l) => l.previsto) ? `<p class="suave legenda">🔁 recorrente · ⏳ previsto (conta não paga ou entrada não confirmada)</p>` : ""}`;

  document.getElementById("h-anterior").onclick = () => { mesHistorico = somarMesesAM(am, -1); telaHistorico(); };
  document.getElementById("h-seguinte").onclick = () => { mesHistorico = somarMesesAM(am, 1); telaHistorico(); };
  const hoje = document.getElementById("h-hoje");
  if (hoje) hoje.onclick = () => { mesHistorico = mesDe(hojeTexto()); telaHistorico(); };

  document.getElementById("filtros").addEventListener("click", (e) => {
    const b = e.target.closest(".chip");
    if (b) { filtroHistorico = b.dataset.f; telaHistorico(); }
  });

  const $itens = document.getElementById("itens");
  if ($itens) $itens.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-id]");
    const l = li && lista.find((x) => x.id === li.dataset.id);
    if (l) painelLancamento(l, telaHistorico);
  });
}
