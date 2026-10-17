// ============================================================
//  DADOS — guardados apenas no aparelho (localStorage)
//
//  lancamentos: { id, tipo: "gasto"|"entrada", valor (centavos),
//                 descricao, data "AAAA-MM-DD", categoria,
//                 cadernetaPaga (só para gastos da Caderneta) }
// ============================================================

const CHAVE = "controle-financeiro-v1";

const DADOS_INICIAIS = {
  lancamentos: [],
  contas: [],
  entradasFixas: [],
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

// Total "pendurado" na Caderneta (gastos ainda não pagos)
function totalCaderneta() {
  return dados.lancamentos
    .filter((l) => l.categoria === "Caderneta" && !l.cadernetaPaga)
    .reduce((soma, l) => soma + l.valor, 0);
}
