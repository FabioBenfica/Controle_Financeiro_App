// ============================================================
//  DADOS — guardados apenas no aparelho (localStorage)
//
//  lancamentos: { id, tipo: "gasto"|"entrada", valor (centavos),
//                 descricao, data "AAAA-MM-DD", categoria,
//                 cadernetaPaga (só para gastos da Caderneta) }
// ============================================================

const CHAVE = "controle-financeiro-v1";

const CATEGORIAS = ["Alimentação", "Transporte", "Casa", "Lazer", "Saúde", "Outros"];
const CADERNETA = "Caderneta"; // nome interno; o nome exibido fica em dados.caderneta.nome

const DADOS_INICIAIS = {
  lancamentos: [],
  contas: [],
  entradasFixas: [],
  recorrentes: [], // { id, valor, descricao, categoria, inicio, ativo }
  caderneta: { nome: "Caderneta", pagamentos: [] },
};

let dados = carregar();

function carregar() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo) return { ...structuredClone(DADOS_INICIAIS), ...JSON.parse(salvo) };
  } catch (e) {
    console.error("Erro ao carregar os dados", e);
  }
  return structuredClone(DADOS_INICIAIS);
}

function salvar() {
  localStorage.setItem(CHAVE, JSON.stringify(dados));
}

function lancamentosEntre(inicio, fim) {
  return dados.lancamentos.filter((l) => l.data >= inicio && l.data <= fim);
}

function totais(lista) {
  let entrou = 0, saiu = 0;
  for (const l of lista) {
    if (l.tipo === "entrada") entrou += l.valor;
    else saiu += l.valor;
  }
  return { entrou, saiu, saldo: entrou - saiu };
}

// Saldo acumulado de tudo que aconteceu antes da data (sobra das quinzenas anteriores)
function sobraAntesDe(data) {
  return totais(dados.lancamentos.filter((l) => l.data < data)).saldo;
}

function novoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Divide o total em parcelas; os centavos que sobram vão para a 1ª
function dividirParcelas(total, n) {
  const base = Math.floor(total / n);
  const valores = Array(n).fill(base);
  valores[0] += total - base * n;
  return valores;
}

// Datas das parcelas: mesmo dia nos meses seguintes
function datasParcelas(data, n) {
  return Array.from({ length: n }, (_, i) => somarMeses(data, i));
}

// Salva um gasto (à vista ou parcelado). Cada parcela vira um lançamento.
function salvarGasto({ valor, descricao, data, categoria, parcelas }) {
  const grupo = parcelas > 1 ? novoId() : null;
  const valores = dividirParcelas(valor, parcelas);
  const datas = datasParcelas(data, parcelas);
  valores.forEach((v, i) => {
    dados.lancamentos.push({
      id: novoId(), tipo: "gasto", valor: v, descricao, data: datas[i], categoria,
      ...(grupo && { grupo, parcela: i + 1, totalParcelas: parcelas }),
      ...(categoria === CADERNETA && { cadernetaPaga: false }),
    });
  });
  salvar();
}

// Gasto recorrente: lançado sozinho todo mês, no mesmo dia, até ser cancelado
function salvarRecorrente({ valor, descricao, data, categoria }) {
  dados.recorrentes.push({ id: novoId(), valor, descricao, categoria, inicio: data, ativo: true });
  salvar();
  gerarRecorrentes();
}

// Cria os lançamentos das recorrências cujo dia já chegou (roda ao abrir o app)
function gerarRecorrentes() {
  const hoje = hojeTexto();
  let mudou = false;
  for (const r of dados.recorrentes) {
    if (!r.ativo) continue;
    const jaLancadas = new Set(
      dados.lancamentos.filter((l) => l.recorrente === r.id).map((l) => l.data));
    for (let i = 0, data = r.inicio; data <= hoje; data = somarMeses(r.inicio, ++i)) {
      if (jaLancadas.has(data)) continue;
      dados.lancamentos.push({
        id: novoId(), tipo: "gasto", valor: r.valor, descricao: r.descricao,
        data, categoria: r.categoria, recorrente: r.id,
      });
      mudou = true;
    }
  }
  if (mudou) salvar();
}

// Total "pendurado" na Caderneta (gastos ainda não pagos)
function totalCaderneta() {
  return dados.lancamentos
    .filter((l) => l.categoria === CADERNETA && !l.cadernetaPaga)
    .reduce((soma, l) => soma + l.valor, 0);
}
