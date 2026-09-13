/* Gerador do PDF da proposta. Recebe a proposta gravada e a tabela; devolve um Blob. */
import { FINI_BANNER, BANNER_RATIO } from "./assets/banner.js";
import { categoria } from "./motores/precificacao.js";
import { brl2, dataBR } from "./ui.js";

const n = (v, pad) => (v == null || v === "" || isNaN(Number(v))) ? pad : Number(v);
export const fone = (w) => { const d = String(w || "").replace(/\D/g, ""); return d.length === 13 ? `(${d.slice(2,4)}) ${d.slice(4,9)}-${d.slice(9)}` : w; };

export function montarPDF(p, cfg){
  if (!window.jspdf) throw new Error("A biblioteca do PDF não carregou. Recarregue a página.");
  const doc = new window.jspdf.jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 16; let y = 0;
  const VERM = [205,32,51], TINTA = [35,24,29], CINZA = [122,108,114], LINHA = [227,220,224];
  const txt = (s, x, yy, o = {}) => { doc.setFont("helvetica", o.w || "normal"); doc.setFontSize(o.s || 10); doc.setTextColor(...(o.c || TINTA)); doc.text(String(s), x, yy, { align: o.a || "left" }); };
  const regua = (yy, cor) => { doc.setDrawColor(...(cor || LINHA)); doc.setLineWidth(.3); doc.line(M, yy, W - M, yy); };
  const quebra = (need) => { if (y + need > 282) { doc.addPage(); y = 20; } };
  const paragrafo = (s, x, larg, o = {}) => { doc.setFont("helvetica", o.w || "normal"); doc.setFontSize(o.s || 9.5); doc.setTextColor(...(o.c || TINTA));
    const l = doc.splitTextToSize(String(s), larg); doc.text(l, x, y); y += l.length * (o.lh || 4.6); };

  try { doc.addImage(FINI_BANNER, "PNG", 0, 0, W, W * BANNER_RATIO); } catch {}
  y = W * BANNER_RATIO + 14;

  txt("PROPOSTA COMERCIAL", M, y, { s: 8.5, w: "bold", c: VERM });
  txt("Nº " + String(p.numero).padStart(4, "0"), M, y + 9, { s: 22, w: "bold" });
  txt("Emitida em " + new Date(p.criado_em || Date.now()).toLocaleDateString("pt-BR"), W - M, y, { s: 9, a: "right", c: CINZA });
  txt("Válida até " + dataBR(p.validade), W - M, y + 5.5, { s: 9, a: "right", c: CINZA });
  y += 16; regua(y); y += 9;

  const col = (x, titulo, pares) => {
    txt(titulo, x, y, { s: 7.5, w: "bold", c: VERM }); let yy = y + 6;
    pares.forEach(([r, v]) => { if (!v) return; txt(r, x, yy, { s: 7.5, c: CINZA });
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...TINTA);
      const l = doc.splitTextToSize(String(v), 78); doc.text(l, x, yy + 4.2); yy += 4.2 + l.length * 4.4 + 2.4; });
    return yy;
  };
  const y1 = col(M, "CLIENTE", [["Responsável", p.responsavel], ["WhatsApp", p.telefone], ["E-mail", p.email]]);
  const y2 = col(W / 2, "EVENTO", [["Ocasião", p.evento], ["Local", [p.local_festa, p.cidade].filter(Boolean).join(", ")],
    ["Data e horário", dataBR(p.data_evento) + (p.horario ? " às " + p.horario : "")],
    ["Convidados e duração", (p.convidados || "—") + " pessoas · " + Number(p.horas) + " horas"]]);
  y = Math.max(y1, y2) + 4; regua(y); y += 10;

  txt("O QUE ESTÁ SENDO PROPOSTO", M, y, { s: 7.5, w: "bold", c: VERM }); y += 8;
  const cQtd = W - M - 72, cUni = W - M - 36, cTot = W - M;
  txt("ITEM", M, y, { s: 7.5, w: "bold", c: CINZA }); txt("QTD", cQtd, y, { s: 7.5, w: "bold", c: CINZA, a: "right" });
  txt("UNIT.", cUni, y, { s: 7.5, w: "bold", c: CINZA, a: "right" }); txt("TOTAL", cTot, y, { s: 7.5, w: "bold", c: CINZA, a: "right" });
  y += 2.5; regua(y); y += 6;
  const item = (nome, sub, qtd, unit, total) => { quebra(14);
    txt(nome, M, y, { s: 10, w: "bold" }); if (sub) txt(sub, M, y + 4.2, { s: 8, c: CINZA });
    if (qtd != null) txt(qtd, cQtd, y, { s: 9.5, a: "right" }); if (unit != null) txt(unit, cUni, y, { s: 9.5, a: "right" });
    txt(total, cTot, y, { s: 10, w: "bold", a: "right" }); y += (sub ? 11 : 7.5); };
  const br = (v) => Number(v).toLocaleString("pt-BR");

  item("Carrinho da Fini — " + categoria(p.categoria).nome,
       (p.pacotes || []).map(x => Number(x.kg) + " kg").join(" + ") + " de balas · monitor(a), saquinhos e montagem inclusos",
       br(p.kg_total) + " kg", null, brl2(p.valor_balas));
  (p.adicionais || []).forEach(a => item(a.nome, null, a.qtd + " un", brl2(a.unit), brl2(a.total)));
  if (Number(p.horas_extras) > 0) item("Horas adicionais", "além das " + n(cfg.horas_inclusas, 4) + " horas inclusas", br(p.horas_extras) + " h", brl2(n(cfg.hora_extra, 0)), brl2(p.valor_horas));
  if (Number(p.valor_atendentes) > 0) item("Atendentes adicionais", "além da monitora inclusa", br(p.atendentes_extras) + " pessoa(s)", brl2(n(cfg.atendente_extra_valor, 0)), brl2(p.valor_atendentes));
  if (Number(p.valor_deslocamento) > 0) item("Deslocamento", "ida e volta" + (p.duracao_texto ? " · " + p.duracao_texto + " de viagem" : ""), br(p.distancia_km) + " km", brl2(p.valor_km), brl2(p.valor_deslocamento));
  if (Number(p.desconto) > 0) item("Desconto comercial", null, null, null, "- " + brl2(p.desconto));

  quebra(30); y += 2; regua(y); y += 10;
  txt("VALOR TOTAL", M, y, { s: 9, w: "bold", c: CINZA });
  txt(brl2(p.valor_total), W - M, y + 1.5, { s: 19, w: "bold", c: VERM, a: "right" }); y += 11;
  const par = n(cfg.parcelas_cartao, 4), pct = n(cfg.desconto_avista, 10);
  txt(`Em até ${par}× de ${brl2(p.valor_total / par)} no cartão, ou ${brl2(p.valor_total * (1 - pct / 100))} à vista no Pix (-${pct}%).`, M, y, { s: 9, c: CINZA });
  y += 12;

  quebra(36); regua(y); y += 6.5;
  txt("JÁ INCLUSO NO PACOTE", M, y, { s: 7.5, w: "bold", c: VERM }); y += 6;
  (cfg.inclusos || []).forEach(i => { quebra(7); doc.setFillColor(...VERM); doc.circle(M + 1.2, y - 1.2, 1.1, "F"); txt(i, M + 5.5, y, { s: 9.5 }); y += 5.4; });
  y += 4;

  quebra(46);
  txt("CONDIÇÕES COMERCIAIS", M, y, { s: 7.5, w: "bold", c: VERM }); y += 6.5;
  ["Entrada via Pix e o restante parcelado no cartão de crédito.",
   "A data só fica reservada na agenda após a confirmação da entrada.",
   "Esta proposta é válida até " + dataBR(p.validade) + ".",
   `Quantidades de balas calculadas para ${p.convidados || "—"} convidados, na média de ${n(cfg.gramas_por_pessoa, n(cfg.gramas_saquinho, 180))} g por pessoa.`
  ].forEach(c => { quebra(8); txt("•", M, y, { s: 9.5, c: CINZA }); paragrafo(c, M + 5, W - 2 * M - 6); y += 1.6; });

  if (p.observacoes) { y += 5; quebra(24); txt("OBSERVAÇÕES", M, y, { s: 7.5, w: "bold", c: VERM }); y += 6; paragrafo(p.observacoes, M, W - 2 * M); }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i); doc.setFillColor(...VERM); doc.rect(0, 285, W, 12, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(9); doc.setTextColor(255, 255, 255); doc.text("Fini Sete Lagoas", M, 291.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5);
    doc.text([fone(cfg.whatsapp || ""), cfg.instagram || "", cfg.site || ""].filter(Boolean).join("   ·   "), W - M, 291.5, { align: "right" });
    if (total > 1) { doc.setTextColor(...CINZA); doc.setFontSize(8); doc.text(i + "/" + total, W / 2, 281, { align: "center" }); }
  }
  return doc.output("blob");
}
