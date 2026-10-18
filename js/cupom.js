// ============================================================
//  LEITURA DE CUPOM (OCR) — tudo roda dentro do celular.
//  O leitor de texto (Tesseract) é baixado só na primeira vez que
//  for usado; a foto nunca é enviada para lugar nenhum.
// ============================================================

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
let carregandoTesseract = null;

function carregarTesseract() {
  if (window.Tesseract) return Promise.resolve();
  if (!carregandoTesseract) {
    carregandoTesseract = new Promise((ok, erro) => {
      const s = document.createElement("script");
      s.src = TESSERACT_URL;
      s.onload = ok;
      s.onerror = () => { carregandoTesseract = null; erro(new Error("sem-internet")); };
      document.head.appendChild(s);
    });
  }
  return carregandoTesseract;
}

// Reduz a foto e passa para tons de cinza com mais contraste: lê melhor e mais rápido
function prepararImagem(arquivo) {
  return new Promise((ok, erro) => {
    const img = new Image();
    img.onload = () => {
      const escala = Math.min(1, 1600 / img.width);
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * escala);
      c.height = Math.round(img.height * escala);
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0, c.width, c.height);
      const px = g.getImageData(0, 0, c.width, c.height);
      const d = px.data;
      for (let i = 0; i < d.length; i += 4) {
        const cinza = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        const v = Math.max(0, Math.min(255, (cinza - 128) * 1.5 + 128));
        d[i] = d[i + 1] = d[i + 2] = v;
      }
      g.putImageData(px, 0, 0);
      URL.revokeObjectURL(img.src);
      ok(c);
    };
    img.onerror = () => erro(new Error("imagem-invalida"));
    img.src = URL.createObjectURL(arquivo);
  });
}

// progresso(0..1) é chamado enquanto lê
async function lerCupom(arquivo, progresso) {
  await carregarTesseract();
  const imagem = await prepararImagem(arquivo);
  const { data } = await Tesseract.recognize(imagem, "por", {
    logger: (m) => { if (m.status === "recognizing text") progresso(m.progress); },
  });
  return interpretarCupom(data.text);
}

// ---------- Interpretação do texto lido ----------
// Valor em reais no fim de um trecho: "1.234,56", "45,90", "45.90", "45, 90"
const RE_VALOR = /(\d{1,3}(?:[.\s]\d{3})+|\d+)\s?[,.]\s?(\d{2})(?!\d)/g;

function valoresNaLinha(linha) {
  return [...linha.matchAll(RE_VALOR)].map((m) => Number(m[1].replace(/[.\s]/g, "")) * 100 + Number(m[2]));
}

// Procura o total pelas palavras-chave, da mais confiável para a menos confiável
function acharTotal(linhas) {
  const chaves = [/VALOR\s*A\s*PAGAR/i, /VALOR\s*TOTAL/i, /TOTAL\s*R\$/i, /(^|[^B])TOTAL/i];
  for (const chave of chaves) {
    for (let i = linhas.length - 1; i >= 0; i--) {
      if (!chave.test(linhas[i]) || /SUB\s*TOTAL|TRIBUTOS|ITENS/i.test(linhas[i])) continue;
      const valores = [...valoresNaLinha(linhas[i]), ...valoresNaLinha(linhas[i + 1] || "")];
      if (valores.length) return valores[0];
    }
  }
  return null;
}

// A primeira linha "de texto" do cupom costuma ser o nome da empresa
function acharLoja(linhas) {
  const ignorar = /CNPJ|CPF|INSCRI|DANFE|DOCUMENTO|AUXILIAR|NOTA FISCAL|CONSUMIDOR|ENDERE|^\W*$/i;
  for (const l of linhas.slice(0, 6)) {
    const letras = (l.match(/[A-Za-zÀ-ú]/g) || []).length;
    if (letras < 4 || letras < l.length * 0.5 || ignorar.test(l)) continue;
    const nome = l.replace(/[^\wÀ-ú&.\-\s]/g, "").replace(/\s+/g, " ").trim();
    return nome.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).slice(0, 40);
  }
  return "";
}

function acharData(texto) {
  for (const m of texto.matchAll(/(\d{2})\/(\d{2})\/(\d{4})/g)) {
    const [, d, mes, a] = m.map(Number);
    if (d >= 1 && d <= 31 && mes >= 1 && mes <= 12 && a >= 2000 && a <= 2100) {
      return `${a}-${String(mes).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }
  return "";
}

function interpretarCupom(texto) {
  const linhas = texto.split("\n").map((l) => l.trim()).filter(Boolean);
  return { valor: acharTotal(linhas), loja: acharLoja(linhas), data: acharData(texto), texto };
}
