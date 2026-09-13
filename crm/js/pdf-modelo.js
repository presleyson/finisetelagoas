/* Proposta no modelo oficial (PDF "Fini - Carrinho").
   Páginas 1, 2, 4 e 5 vêm intactas do modelo (vetor, sem re-render).
   Página 3 recebe a tabela dinâmica: quilos do evento × três modalidades.
   Depende de window.PDFLib (pdf-lib) e window.fontkit. */

import { VERSAO } from "./config.js";
const CAMINHOS = {
  modelo: "js/assets/modelo-base.pdf?v=" + VERSAO,
  eb:     "js/assets/fonts/Montserrat-ExtraBold.ttf?v=" + VERSAO,
  sb:     "js/assets/fonts/Montserrat-SemiBold.ttf?v=" + VERSAO
};
const LINHAS = [ { id: "nacional", rotulo: "NACIONAL" }, { id: "misto", rotulo: "NACIONAL E IMPORTADO" }, { id: "importado", rotulo: "IMPORTADO" } ];

/* geometria medida no modelo original (pontos, origem no canto inferior esquerdo) */
const G = {
  cx: 320.2,                                  // centro da coluna única (121,5 → 519)
  cabecalho: { rotuloX: 43.6, rotuloY: 718.66, rotuloTam: 10.825, caixaY: 707.06, caixaH: 35.27, caixaW: 74.16, caixaR: 5.88, caixaTraco: 1.8, textoY: 715.88, textoTam: 18 },
  linha: { pilulaTopo: 676.11, pilulaH: 24.47, pilulaW: 88.56, pilulaPadMin: 10, pilulaDesloc: 12.8, pilulaTextoY: 659.32, prefixoTam: 10.08, valorTam: 12.96,
           vezesY: 657.91, vezesTam: 13.68, vezesGap: 2.24,
           totalY: 638.57, totalTam: 10.8,
           ouY: 622.23, ouTam: 10.08, tracoY: 625.37, tracoLarg: 34.31, tracoGap: 3.1, tracoEsp: 0.75,
           avistaRotuloY: 607.01, avistaRotuloTam: 10.8, avistaY: 589.73, avistaTam: 10.825 },
  passo: [0, -107.8, -216.65]                  // deslocamento vertical de cada linha
};

let recursos = null;
async function carregar(){
  if (recursos) return recursos;
  const busca = async (u) => { const r = await fetch(u, { cache: "force-cache" }); if (!r.ok) throw new Error("Não consegui carregar " + u); return new Uint8Array(await r.arrayBuffer()); };
  const [modelo, eb, sb] = await Promise.all([busca(CAMINHOS.modelo), busca(CAMINHOS.eb), busca(CAMINHOS.sb)]);
  recursos = { modelo, eb, sb };
  return recursos;
}
export function preCarregarModelo(){ carregar().catch(() => {}); }

const brNum = (v) => Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const kgTxt = (kg) => Number(kg).toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " kg";

/**
 * p: proposta gravada — precisa de kg_total e opcoes [{categoria, total, parcela, avista}]
 * cfg: config comercial (parcelas_cartao)
 */
export async function montarPDFModelo(p, cfg){
  const L = window.PDFLib; if (!L || !window.fontkit) throw new Error("A biblioteca do PDF não carregou. Recarregue a página.");
  const { PDFDocument, rgb, pushGraphicsState, popGraphicsState, setFillingColor, moveTo, lineTo, appendBezierCurve, closePath, fill } = L;
  const rec = await carregar();
  const doc = await PDFDocument.load(rec.modelo);
  doc.registerFontkit(window.fontkit);
  const EB = await doc.embedFont(rec.eb, { subset: true });
  const SB = await doc.embedFont(rec.sb, { subset: true });
  const pg = doc.getPage(2);
  const VERM = rgb(0.804, 0.125, 0.2), BRANCO = rgb(1, 1, 1);
  const larg = (t, f, s) => f.widthOfTextAtSize(t, s);
  const texto = (t, x, y, f, s, cor) => pg.drawText(t, { x, y, size: s, font: f, color: cor || VERM });
  const centrado = (t, cx, y, f, s, cor) => { const w = larg(t, f, s); texto(t, cx - w / 2, y, f, s, cor); return { x: cx - w / 2, w }; };
  /* "R$ " em SemiBold + valor em ExtraBold, como no modelo, centrado em cx */
  const preco = (valor, cx, y, sPre, sVal, cor) => {
    const a = "R$ ", b = brNum(valor); const wa = larg(a, SB, sPre), wb = larg(b, EB, sVal); const x = cx - (wa + wb) / 2;
    texto(a, x, y, SB, sPre, cor); texto(b, x + wa, y, EB, sVal, cor); return { x, w: wa + wb };
  };
  /* rounded rect: caminho explícito para evitar depender de helpers de versão */
  const caminhoArred = (x, y, w, h, r) => {
    const k = 0.5523 * r, x2 = x + w, y2 = y + h;
    return [
      moveTo(x + r, y),
      lineTo(x2 - r, y), appendBezierCurve(x2 - r + k, y, x2, y + r - k, x2, y + r),
      lineTo(x2, y2 - r), appendBezierCurve(x2, y2 - r + k, x2 - r + k, y2, x2 - r, y2),
      lineTo(x + r, y2), appendBezierCurve(x + r - k, y2, x, y2 - r + k, x, y2 - r),
      lineTo(x, y + r), appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y),
      closePath()
    ];
  };
  const pilula = (x, y, w, h) => pg.pushOperators(pushGraphicsState(), setFillingColor(VERM), ...caminhoArred(x, y, w, h, h / 2), fill(), popGraphicsState());
  const caixa  = (x, y, w, h, r) => pg.pushOperators(pushGraphicsState(), L.setStrokingColor(VERM), L.setLineWidth(G.cabecalho.caixaTraco), ...caminhoArred(x, y, w, h, r), L.stroke(), popGraphicsState());
  const traco  = (x1, x2, y) => pg.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: G.linha.tracoEsp, color: BRANCO });

  /* ---- cabeçalho: BALEIRO + caixa com os quilos ---- */
  const C = G.cabecalho;
  texto("BALEIRO:", C.rotuloX, C.rotuloY, EB, C.rotuloTam);
  const tKg = kgTxt(p.kg_total), wKg = larg(tKg, EB, C.textoTam);
  const caixaW = Math.max(C.caixaW, wKg + 26);
  caixa(G.cx - caixaW / 2, C.caixaY, caixaW, C.caixaH, C.caixaR);
  centrado(tKg, G.cx, C.textoY, EB, C.textoTam);

  /* ---- três linhas ---- */
  const parcelas = Number(cfg.parcelas_cartao) || 4;
  const R = G.linha;
  LINHAS.forEach((ln, i) => {
    const o = (p.opcoes || []).find(x => x.categoria === ln.id); if (!o) return;
    const dy = G.passo[i];
    const parcela = o.parcela != null ? o.parcela : o.total / parcelas;
    const avista  = o.avista  != null ? o.avista  : o.total;
    // pílula de largura fixa (88,56 pt no modelo), deslocada 12,8 pt à direita do centro; "4x" encostado à esquerda
    const pre = "R$ ", val = brNum(parcela);
    const wPre = larg(pre, SB, R.prefixoTam), wVal = larg(val, EB, R.valorTam);
    const pilW = Math.max(R.pilulaW, wPre + wVal + 2 * R.pilulaPadMin), vezes = parcelas + "x", wVezes = larg(vezes, EB, R.vezesTam);
    const pilX = G.cx + R.pilulaDesloc - pilW / 2, pilY = R.pilulaTopo - R.pilulaH + dy, gx = pilX - R.vezesGap - wVezes;
    const padTxt = (pilW - wPre - wVal) / 2;
    pilula(pilX, pilY, pilW, R.pilulaH);
    texto(vezes, gx, R.vezesY + dy, EB, R.vezesTam);
    texto(pre, pilX + padTxt, R.pilulaTextoY + dy, SB, R.prefixoTam, BRANCO);
    texto(val, pilX + padTxt + wPre, R.pilulaTextoY + dy, EB, R.valorTam, BRANCO);
    // total
    preco(o.total, G.cx, R.totalY + dy, R.totalTam, R.totalTam);
    // ou + traços
    const ou = centrado("ou", G.cx, R.ouY + dy, SB, R.ouTam);
    traco(ou.x - R.tracoGap - R.tracoLarg, ou.x - R.tracoGap, R.tracoY + dy);
    traco(ou.x + ou.w + R.tracoGap, ou.x + ou.w + R.tracoGap + R.tracoLarg, R.tracoY + dy);
    // à vista
    const pct = Number(cfg.desconto_avista) || 0;
    centrado((pct ? pct + "% " : "") + "à vista:", G.cx, R.avistaRotuloY + dy, SB, R.avistaRotuloTam);
    preco(avista, G.cx, R.avistaY + dy, R.avistaTam, R.avistaTam);
  });

  doc.setTitle("Proposta Carrinho da Fini" + (p.numero ? " nº " + String(p.numero).padStart(4, "0") : ""));
  doc.setAuthor("Fini Sete Lagoas");
  const bytes = await doc.save({ useObjectStreams: true });
  return new Blob([bytes], { type: "application/pdf" });
}
