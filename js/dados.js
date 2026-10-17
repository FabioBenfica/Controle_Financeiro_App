// ============================================================
//  DADOS — guardados apenas no aparelho (localStorage)
//
//  lancamentos: { id, tipo: "gasto"|"entrada", valor (centavos),
//                 descricao, data "AAAA-MM-DD", categoria,
//                 cadernetaPaga (só para gastos da Caderneta) }
// ============================================================

const CHAVE = "controle-financeiro-v1";

const CATEGORIAS = ["Alimentação", "Transporte", "Casa", "Lazer", "Saúde", "Outros"];
const TIPOS_ENTRADA = ["Salário", "Extra", "Outros"];
const CADERNETA = "Caderneta"; // nome interno; o nome exibido fica em dados.caderneta.nome

const DADOS_INICIAIS = {
  lancamentos: [],
  contas: [],
  entradasFixas: [], // { id, valor, descricao, tipo, inicio, ativo, respondidos: [datas] }
  recorrentes: [], // { id, valor, descricao, categoria, inicio, ativo, pulados: [datas] }
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

// Lançamentos salvos + ocorrências futuras dos recorrentes (previstas) até a data "ate"
function todosAte(ate) {
  return [...dados.lancamentos, ...recorrentesFuturos(ate)];
}

function lancamentosEntre(inicio, fim) {
  return todosAte(fim).filter((l) => l.data >= inicio && l.data <= fim);
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
  return totais(todosAte(data).filter((l) => l.data < data)).saldo;
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
    const jaLancadas = new Set([
      ...dados.lancamentos.filter((l) => l.recorrente === r.id).map((l) => l.data),
      ...(r.pulados || []),
    ]);
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

// Ocorrências dos recorrentes depois de hoje (até "ate"). Não são salvas:
// viram lançamentos de verdade quando o dia chega (gerarRecorrentes).
function recorrentesFuturos(ate) {
  const hoje = hojeTexto();
  const lista = [];
  for (const r of dados.recorrentes) {
    if (!r.ativo) continue;
    for (let i = 0, data = r.inicio; data <= ate; data = somarMeses(r.inicio, ++i)) {
      if (data <= hoje || r.pulados?.includes(data)) continue;
      lista.push({
        id: `${r.id}-${data}`, tipo: "gasto", valor: r.valor, descricao: r.descricao,
        data, categoria: r.categoria, recorrente: r.id, previsto: true,
      });
    }
  }
  return lista;
}

// ---------- Entradas ----------
function lancarEntrada({ valor, descricao, data, tipo, fixa }) {
  dados.lancamentos.push({
    id: novoId(), tipo: "entrada", valor, descricao, data, categoria: tipo,
    ...(fixa && { fixa }),
  });
}

function salvarEntrada({ valor, descricao, data, tipo, fixa }) {
  if (fixa) {
    const f = { id: novoId(), valor, descricao, tipo, inicio: data, ativo: true, respondidos: [] };
    dados.entradasFixas.push(f);
    lancarEntrada({ valor, descricao, data, tipo, fixa: f.id });
  } else {
    lancarEntrada({ valor, descricao, data, tipo });
  }
  salvar();
}

// Dias de pagamento (15 e 30/último dia de fevereiro) depois de "inicio" até "fim"
function diasDePagamento(inicio, fim) {
  const dias = [];
  let [a, m] = inicio.split("-").map(Number);
  m -= 1;
  while (true) {
    for (const d of [15, diaSegundoPagamento(a, m)]) {
      const t = paraTexto(new Date(a, m, d));
      if (t > fim) return dias;
      if (t > inicio) dias.push(t);
    }
    if (++m > 11) { m = 0; a++; }
  }
}

// Salários fixos aguardando confirmação: [{ fixa, data }]
function entradasPendentes() {
  const hoje = hojeTexto();
  const lista = [];
  for (const f of dados.entradasFixas) {
    if (!f.ativo) continue;
    for (const data of diasDePagamento(f.inicio, hoje)) {
      if (!f.respondidos.includes(data)) lista.push({ fixa: f, data });
    }
  }
  return lista.sort((x, y) => x.data.localeCompare(y.data));
}

// Responde o cartão "entrou?": valor = centavos recebidos, ou null se não entrou
function responderEntrada(fixa, data, valor) {
  if (valor) lancarEntrada({ valor, descricao: fixa.descricao, data, tipo: fixa.tipo, fixa: fixa.id });
  fixa.respondidos.push(data);
  salvar();
}

// ---------- Exclusão ----------
function excluirLancamento(l) {
  if (l.recorrente) {
    // Marca o mês como pulado para a recorrência não recriá-lo
    const r = dados.recorrentes.find((x) => x.id === l.recorrente);
    if (r) r.pulados = [...(r.pulados || []), l.data];
  }
  dados.lancamentos = dados.lancamentos.filter((x) => x.id !== l.id);
  salvar();
}

function excluirTodasParcelas(grupo) {
  dados.lancamentos = dados.lancamentos.filter((x) => x.grupo !== grupo);
  salvar();
}

// Para a recorrência: apaga o lançamento desta data e os seguintes; os anteriores ficam
function pararRecorrencia(id, aPartirDe) {
  const r = dados.recorrentes.find((x) => x.id === id);
  if (r) r.ativo = false;
  dados.lancamentos = dados.lancamentos.filter((x) => !(x.recorrente === id && x.data >= aPartirDe));
  salvar();
}

// Total "pendurado" na Caderneta (gastos ainda não pagos)
function totalCaderneta() {
  return dados.lancamentos
    .filter((l) => l.categoria === CADERNETA && !l.cadernetaPaga)
    .reduce((soma, l) => soma + l.valor, 0);
}
