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
  entradasFixas: [], // { id, valor, descricao, tipo, inicio, freq: "quinzenal"|"mensal", ativo, respondidos: [datas] }
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

// Lançamentos salvos + previstos (recorrentes futuros e contas não pagas) até a data "ate"
function todosAte(ate) {
  return [...dados.lancamentos, ...recorrentesFuturos(ate), ...contasPrevistas(ate), ...entradasPrevistas(ate)];
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

// freq: "unica" | "quinzenal" (dias 15 e 30) | "mensal" (mesmo dia todo mês)
function salvarEntrada({ valor, descricao, data, tipo, freq }) {
  if (freq !== "unica") {
    const f = { id: novoId(), valor, descricao, tipo, inicio: data, freq, ativo: true, respondidos: [] };
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

// Datas em que a entrada fixa se repete, depois do início até "fim"
function diasDaEntradaFixa(f, fim) {
  if (f.freq !== "mensal") return diasDePagamento(f.inicio, fim); // quinzenal (padrão)
  const dias = [];
  for (let i = 1, d = somarMeses(f.inicio, 1); d <= fim; d = somarMeses(f.inicio, ++i)) dias.push(d);
  return dias;
}

// Entradas fixas aguardando confirmação ("entrou?"): [{ fixa, data }]
function entradasPendentes() {
  const hoje = hojeTexto();
  const lista = [];
  for (const f of dados.entradasFixas) {
    if (!f.ativo) continue;
    for (const data of diasDaEntradaFixa(f, hoje)) {
      if (!f.respondidos.includes(data)) lista.push({ fixa: f, data });
    }
  }
  return lista.sort((x, y) => x.data.localeCompare(y.data));
}

// Entradas fixas ainda não confirmadas viram entradas previstas (⏳) até "ate".
// Não são salvas: ao confirmar o "entrou?", a entrada de verdade toma o lugar.
function entradasPrevistas(ate) {
  const lista = [];
  for (const f of dados.entradasFixas) {
    if (!f.ativo) continue;
    for (const data of diasDaEntradaFixa(f, ate)) {
      if (f.respondidos.includes(data)) continue;
      lista.push({
        id: `fixa-${f.id}-${data}`, tipo: "entrada", valor: f.valor, descricao: f.descricao,
        data, categoria: f.tipo, previsto: true, fixaPrevista: { id: f.id, data },
      });
    }
  }
  return lista;
}

// Responde o cartão "entrou?": valor = centavos recebidos, ou null se não entrou
function responderEntrada(fixa, data, valor) {
  if (valor) lancarEntrada({ valor, descricao: fixa.descricao, data, tipo: fixa.tipo, fixa: fixa.id });
  fixa.respondidos.push(data);
  salvar();
}

// ---------- Edição ----------
// campos: { valor, descricao, data, categoria } (só os que mudam)
function editarLancamento(id, campos) {
  Object.assign(dados.lancamentos.find((l) => l.id === id), campos);
  salvar();
}

// Todas as parcelas: valor, descrição e categoria iguais; cada uma mantém sua data
function editarTodasParcelas(grupo, { valor, descricao, categoria }) {
  dados.lancamentos.filter((l) => l.grupo === grupo)
    .forEach((l) => Object.assign(l, { valor, descricao, categoria }));
  salvar();
}

// Recorrente: muda deste mês em diante (os lançamentos anteriores ficam como estavam)
function editarRecorrenciaDesde(id, data, { valor, descricao, categoria }) {
  const r = dados.recorrentes.find((x) => x.id === id);
  Object.assign(r, { valor, descricao, categoria });
  dados.lancamentos.filter((l) => l.recorrente === id && l.data >= data)
    .forEach((l) => Object.assign(l, { valor, descricao, categoria }));
  salvar();
}

function alterarSalarioFixo(id, valor) {
  dados.entradasFixas.find((f) => f.id === id).valor = valor;
  salvar();
}

function pararSalarioFixo(id) {
  dados.entradasFixas.find((f) => f.id === id).ativo = false;
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

// ---------- Contas a pagar ----------
// conta: { id, descricao, valor, dia, categoria, repete,
//          inicio "AAAA-MM" (mensal) | mes "AAAA-MM" (só uma vez),
//          fim "AAAA-MM" (mensal encerrada: não aparece desse mês em diante),
//          pulados: ["AAAA-MM"], pagamentos: { "AAAA-MM": id do gasto lançado } }

function mesDe(texto) { return texto.slice(0, 7); }

function somarMesesAM(am, n) { return mesDe(somarMeses(`${am}-01`, n)); }

function vencimentoDe(conta, am) {
  const [a, m] = am.split("-").map(Number);
  const dia = Math.min(conta.dia, ultimoDiaDoMes(a, m - 1));
  return `${am}-${String(dia).padStart(2, "0")}`;
}

function contaNoMes(conta, am) {
  if (!conta.repete) return conta.mes === am;
  return conta.inicio <= am && (!conta.fim || am < conta.fim) && !conta.pulados.includes(am);
}

// Pagamento vale enquanto o gasto lançado existir (se o gasto for excluído, a conta volta a ficar aberta)
function gastoDaConta(conta, am) {
  const id = conta.pagamentos[am];
  return id ? dados.lancamentos.find((l) => l.id === id) : null;
}

// status: "paga" | "vencida" | "hoje" | "amanha" | "aberta"
function statusConta(conta, am) {
  if (gastoDaConta(conta, am)) return "paga";
  const venc = vencimentoDe(conta, am), hoje = hojeTexto();
  if (venc < hoje) return "vencida";
  if (venc === hoje) return "hoje";
  if (venc === somarDias(hoje, 1)) return "amanha";
  return "aberta";
}

function contasDoMes(am) {
  return dados.contas
    .filter((c) => contaNoMes(c, am))
    .map((c) => ({ conta: c, am, venc: vencimentoDe(c, am), status: statusConta(c, am), gasto: gastoDaConta(c, am) }))
    .sort((x, y) => x.venc.localeCompare(y.venc));
}

// Contas ainda não pagas viram gastos previstos (⏳) na data do vencimento.
// Não são salvas: quando a conta é paga, o gasto de verdade toma o lugar.
function contasPrevistas(ate) {
  if (!dados.contas.length) return [];
  const lista = [];
  let am = dados.contas.map((c) => c.inicio || c.mes).sort()[0];
  for (; am <= mesDe(ate); am = somarMesesAM(am, 1)) {
    for (const c of dados.contas) {
      if (!contaNoMes(c, am) || gastoDaConta(c, am)) continue;
      const venc = vencimentoDe(c, am);
      if (venc > ate) continue;
      lista.push({
        id: `conta-${c.id}-${am}`, tipo: "gasto", valor: c.valor, descricao: c.descricao,
        data: venc, categoria: c.categoria, previsto: true, contaPrevista: { id: c.id, am },
      });
    }
  }
  return lista;
}

// Avisos da tela principal: vencidas (de qualquer mês), vencendo hoje ou amanhã
function avisosDeContas() {
  const hoje = hojeTexto();
  if (!dados.contas.length) return [];
  let am = dados.contas.map((c) => c.inicio || c.mes).sort()[0];
  const ate = somarMesesAM(mesDe(hoje), 1);
  const lista = [];
  for (; am <= ate; am = somarMesesAM(am, 1)) {
    for (const item of contasDoMes(am)) {
      if (["vencida", "hoje", "amanha"].includes(item.status)) lista.push(item);
    }
  }
  return lista;
}

function salvarConta(dadosConta, id) {
  if (id) {
    Object.assign(dados.contas.find((c) => c.id === id), dadosConta);
  } else {
    dados.contas.push({ id: novoId(), pulados: [], pagamentos: {}, ...dadosConta });
  }
  salvar();
}

function pagarConta(conta, am, valor) {
  const gasto = {
    id: novoId(), tipo: "gasto", valor, descricao: conta.descricao,
    data: hojeTexto(), categoria: conta.categoria, conta: conta.id,
  };
  dados.lancamentos.push(gasto);
  conta.pagamentos[am] = gasto.id;
  salvar();
}

// Excluir: "mes" = só este mês | "seguintes" = este e os próximos | "tudo" = a conta inteira
function excluirConta(conta, am, modo) {
  if (modo === "mes") conta.pulados.push(am);
  else if (modo === "seguintes") conta.fim = am;
  else dados.contas = dados.contas.filter((c) => c !== conta);
  salvar();
}

// ---------- Caderneta ----------
// pagamentos: { id, data, valor, itens: [ids dos lançamentos pagos] }

function renomearCaderneta(nome) {
  dados.caderneta.nome = nome;
  salvar();
}

function cadernetaEmAberto() {
  return dados.lancamentos
    .filter((l) => l.categoria === CADERNETA && !l.cadernetaPaga)
    .sort((a, b) => a.data.localeCompare(b.data));
}

// Fecha a Caderneta: marca os lançamentos como pagos e guarda o pagamento.
// Não lança gasto novo: cada lançamento já descontou do saldo quando foi feito.
function pagarCaderneta() {
  const abertos = cadernetaEmAberto();
  if (!abertos.length) return null;
  const pagamento = {
    id: novoId(), data: hojeTexto(),
    valor: abertos.reduce((s, l) => s + l.valor, 0),
    itens: abertos.map((l) => l.id),
  };
  abertos.forEach((l) => { l.cadernetaPaga = true; l.pagamento = pagamento.id; });
  dados.caderneta.pagamentos.push(pagamento);
  salvar();
  return pagamento;
}

// Total "pendurado" na Caderneta (gastos ainda não pagos)
function totalCaderneta() {
  return dados.lancamentos
    .filter((l) => l.categoria === CADERNETA && !l.cadernetaPaga)
    .reduce((soma, l) => soma + l.valor, 0);
}
