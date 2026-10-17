// ============================================================
//  DATAS E QUINZENAS
//  Salário cai nos dias 15 e 30 (em fevereiro, no último dia).
//  Quinzena A: dia 15 até o dia anterior ao 2º pagamento.
//  Quinzena B: dia do 2º pagamento até o dia 14 do mês seguinte.
//  Datas são guardadas como texto "AAAA-MM-DD".
// ============================================================

const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function ultimoDiaDoMes(ano, mes) { // mes: 0-11
  return new Date(ano, mes + 1, 0).getDate();
}

// Dia do 2º pagamento: 30, ou o último dia em fevereiro
function diaSegundoPagamento(ano, mes) {
  return Math.min(30, ultimoDiaDoMes(ano, mes));
}

function paraTexto(data) {
  const m = String(data.getMonth() + 1).padStart(2, "0");
  const d = String(data.getDate()).padStart(2, "0");
  return `${data.getFullYear()}-${m}-${d}`;
}

function deTexto(texto) {
  const [a, m, d] = texto.split("-").map(Number);
  return new Date(a, m - 1, d);
}

function hojeTexto() { return paraTexto(new Date()); }

function somarDias(texto, dias) {
  const d = deTexto(texto);
  d.setDate(d.getDate() + dias);
  return paraTexto(d);
}

// Soma meses mantendo o dia; se o dia não existir (ex.: 31), usa o último dia do mês
function somarMeses(texto, meses) {
  const [a, m, d] = texto.split("-").map(Number);
  const alvo = new Date(a, m - 1 + meses, 1);
  const dia = Math.min(d, ultimoDiaDoMes(alvo.getFullYear(), alvo.getMonth()));
  return paraTexto(new Date(alvo.getFullYear(), alvo.getMonth(), dia));
}

// "2026-10-17" → "17/10/2026"
function dataCompleta(texto) {
  const [a, m, d] = texto.split("-");
  return `${d}/${m}/${a}`;
}

// Retorna { inicio, fim } da quinzena que contém a data (textos AAAA-MM-DD)
function quinzenaDe(texto) {
  const d = deTexto(texto);
  const ano = d.getFullYear(), mes = d.getMonth(), dia = d.getDate();
  const pag2 = diaSegundoPagamento(ano, mes);

  if (dia >= pag2) {
    return { inicio: paraTexto(new Date(ano, mes, pag2)), fim: paraTexto(new Date(ano, mes + 1, 14)) };
  }
  if (dia >= 15) {
    return { inicio: paraTexto(new Date(ano, mes, 15)), fim: paraTexto(new Date(ano, mes, pag2 - 1)) };
  }
  const pag2Anterior = diaSegundoPagamento(ano, mes - 1 < 0 ? 11 : mes - 1);
  return { inicio: paraTexto(new Date(ano, mes - 1, pag2Anterior)), fim: paraTexto(new Date(ano, mes, 14)) };
}

function quinzenaAnterior(q) { return quinzenaDe(somarDias(q.inicio, -1)); }
function quinzenaSeguinte(q) { return quinzenaDe(somarDias(q.fim, 1)); }

// "2026-10-15" → "15/10"
function diaMes(texto) {
  const [, m, d] = texto.split("-");
  return `${d}/${m}`;
}

// Valores são guardados em centavos (inteiros) para evitar erros de arredondamento
const formatoReal = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
function reais(centavos) { return formatoReal.format(centavos / 100); }
