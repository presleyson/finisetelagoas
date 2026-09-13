/* Relatórios por cidade, período e resultado. */
import { S, rows } from "./state.js";
import { classe, etapa } from "./etapas.js";
import { $, $$, esc, brl, dataBR, mesKey, mesLabel, ligarTooltips, select } from "./ui.js";
import { go } from "./router.js";

const rf = { base: "data", de: "", ate: "", cidade: "__all", range: "tudo" };
function aplicaPeriodo(){
  const h = new Date(), y = h.getFullYear(), m = h.getMonth();
  const d = (yy, mm, dd) => new Date(Date.UTC(yy, mm, dd)).toISOString().slice(0, 10);
  if (rf.range === "mes") { rf.de = d(y, m, 1); rf.ate = d(y, m + 1, 0); }
  else if (rf.range === "tri") { rf.de = d(y, m - 2, 1); rf.ate = d(y, m + 1, 0); }
  else if (rf.range === "ano") { rf.de = y + "-01-01"; rf.ate = y + "-12-31"; }
  else if (rf.range === "tudo") { rf.de = ""; rf.ate = ""; }
}
function filtrados(){
  return rows().filter(l => {
    if (rf.cidade !== "__all" && l.cidade !== rf.cidade) return false;
    const d = rf.base === "data" ? String(l.data || "").slice(0, 10) : String(l.criado_em || "").slice(0, 10);
    return (!rf.de || d >= rf.de) && (!rf.ate || d <= rf.ate);
  });
}
const tile = (k, v, s, hero) => `<div class="tile${hero ? " hero" : ""}"><span class="k">${k}</span><span class="v">${v}</span><span class="s">${esc(s)}</span></div>`;
const legend = () => `<div class="legend"><span><i style="background:var(--c-ganho)"></i>Ganhos</span><span><i style="background:var(--c-andamento)"></i>Em andamento</span><span><i style="background:var(--c-perdido)"></i>Perdidos</span></div>`;
function agrupa(L, keyf){
  const m = {};
  L.forEach(l => { const k = keyf(l); if (!k) return;
    m[k] = m[k] || { k, ganho: 0, andamento: 0, perdido: 0, total: 0, receita: 0 };
    const c = classe(l); m[k][c]++; m[k].total++; if (c === "ganho") m[k].receita += Number(l.valor) || 0; });
  return Object.values(m);
}
const seg = (v, max, cor, nome, ctx) => v ? `<span class="seg" style="width:${(v / max * 100).toFixed(2)}%;background:${cor}" data-tip="${esc(ctx)} · ${nome}: ${v}">${v / max * 100 > 7 ? v : ""}</span>` : "";
const vseg = (v, max, cor, nome, ctx) => v ? `<span class="seg" style="height:${(v / max * 100).toFixed(2)}%;background:${cor}" data-tip="${esc(ctx)} · ${nome}: ${v}"></span>` : "";

function cidadeChart(L){
  const d = agrupa(L, l => l.cidade).sort((x, y) => y.total - x.total || y.receita - x.receita);
  if (!d.length) return '<p style="color:var(--ink-3);font-size:13.5px;margin:0">Nenhum lead no período.</p>';
  const max = Math.max(...d.map(r => r.total));
  return `<div class="citybars">${d.map(r => `<div class="cityrow"><span class="cn" title="${esc(r.k)}">${esc(r.k)}</span><span class="track">
    ${seg(r.ganho, max, "var(--c-ganho)", "Ganhos", r.k)}${seg(r.andamento, max, "var(--c-andamento)", "Em andamento", r.k)}${seg(r.perdido, max, "var(--c-perdido)", "Perdidos", r.k)}
    </span><span class="cv">${r.receita ? brl(r.receita) : "—"}</span></div>`).join("")}</div>
    <p style="margin:14px 0 0;font-size:12px;color:var(--ink-3)">Barras: número de leads (máximo ${max}). Coluna à direita: receita das vendas fechadas na cidade.</p>`;
}
function mesChart(L){
  let d = agrupa(L, l => mesKey(rf.base === "data" ? String(l.data || "") : String(l.criado_em || ""))).sort((x, y) => x.k.localeCompare(y.k));
  if (!d.length) return '<p style="color:var(--ink-3);font-size:13.5px;margin:0">Nenhum lead no período.</p>';
  if (d.length > 14) d = d.slice(-14);
  const max = Math.max(...d.map(r => r.total)), nice = Math.max(4, Math.ceil(max / 4) * 4);
  return `<div class="yaxis"><span>escala 0–${nice}</span><span>leads por mês</span></div><div class="months">${d.map(r =>
    `<div class="mcol"><div class="mplot">${vseg(r.ganho, nice, "var(--c-ganho)", "Ganhos", mesLabel(r.k))}${vseg(r.andamento, nice, "var(--c-andamento)", "Em andamento", mesLabel(r.k))}${vseg(r.perdido, nice, "var(--c-perdido)", "Perdidos", mesLabel(r.k))}</div><span class="mlab">${mesLabel(r.k)}</span></div>`).join("")}</div>`;
}
function perdidosTabela(p){
  if (!p.length) return '<p style="color:var(--ink-3);font-size:13.5px;margin:0">Nenhuma perda no período — bom sinal.</p>';
  const s = p.slice().sort((a, b) => String(b.data || "").localeCompare(String(a.data || "")));
  return `<div class="tablewrap"><table class="data"><thead><tr><th>Responsável</th><th>Evento</th><th>Cidade</th><th>Data da festa</th><th>Valor</th><th>Motivo</th></tr></thead><tbody>${
    s.map(l => `<tr><td><button class="linkbtn" data-lead="${esc(l.id)}">${esc(l.responsavel || "—")}</button></td><td>${esc(l.evento || "—")}</td><td>${esc(l.cidade || "—")}</td>
      <td class="n">${dataBR(l.data)}</td><td class="n">${brl(l.valor)}</td><td><span class="dot" style="background:var(--c-perdido)"></span>${esc(l.motivo || "sem motivo registrado")}</td></tr>`).join("")}</tbody></table></div>`;
}
function origemTabela(L){
  const m = {}; L.forEach(l => { const k = l.origem || "site"; m[k] = m[k] || { n: 0, g: 0 }; m[k].n++; if (classe(l) === "ganho") m[k].g++; });
  const nomes = { site: "Site", whatsapp: "WhatsApp", instagram: "Instagram", indicacao: "Indicação", presencial: "Presencial", outro: "Outro" };
  return `<div class="tablewrap"><table class="data"><thead><tr><th>Origem</th><th>Leads</th><th>Fechados</th><th>Conversão</th></tr></thead><tbody>${
    Object.entries(m).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `<tr><td>${nomes[k] || k}</td><td class="n">${v.n}</td><td class="n">${v.g}</td><td class="n">${v.n ? Math.round(v.g / v.n * 100) : 0}%</td></tr>`).join("")}</tbody></table></div>`;
}
function csv(L){
  const cols = ["Responsável","WhatsApp","E-mail","Evento","Crianças","Adultos","Local","Cidade","Data da festa","Horário","Etapa","Origem","Valor","Motivo da perda","Observações","Anotações","Recebida em"];
  const linhas = [cols, ...L.map(l => [l.responsavel, l.telefone, l.email, l.evento, l.criancas, l.adultos, l.local_festa, l.cidade, dataBR(l.data), l.horario, etapa(l.etapa).nome, l.origem, l.valor, l.motivo, l.obs, l.notas, l.criado_em ? new Date(l.criado_em).toLocaleDateString("pt-BR") : ""])];
  const txt = "﻿" + linhas.map(r => r.map(c => '"' + String(c == null ? "" : c).replace(/"/g, '""') + '"').join(";")).join("\r\n");
  const url = URL.createObjectURL(new Blob([txt], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a"); a.href = url; a.download = "carrinho-fini-" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export function renderRelatorios(){
  const host = $("#view-relatorios"), all = rows();
  if (!all.length) { host.innerHTML = `<p class="eyebrow">Relatórios</p><h1 style="font-size:30px;margin:8px 0 14px">Sem dados ainda.</h1>`; return; }
  const cidades = [...new Set(all.map(l => l.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const L = filtrados();
  const g = L.filter(l => classe(l) === "ganho"), p = L.filter(l => classe(l) === "perdido"), a = L.filter(l => classe(l) === "andamento");
  const receita = g.reduce((s, l) => s + (Number(l.valor) || 0), 0), perdida = p.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const fechadas = g.length + p.length, conv = fechadas ? Math.round(g.length / fechadas * 100) : 0;
  const comValor = g.filter(l => Number(l.valor) > 0), ticket = comValor.length ? Math.round(receita / comValor.length) : 0;
  const props = S.propostas || [], vProps = props.reduce((s, x) => s + (Number(x.valor_total) || 0), 0);

  host.innerHTML = `
    <div class="bar"><div><p class="eyebrow">Relatórios</p><h1 style="font-size:26px;margin:2px 0 0">Onde está o resultado</h1></div><div class="grow"></div>
      ${select("rbase", [["data","Por data da festa"],["criado_em","Por data de entrada"]], rf.base, 'style="width:auto"')}
      ${select("rrange", [["tudo","Todo o período"],["mes","Este mês"],["tri","Últimos 3 meses"],["ano","Este ano"],["custom","Datas específicas"]], rf.range, 'style="width:auto"')}
      ${rf.range === "custom" ? `<input id="rde" type="date" style="width:auto" value="${esc(rf.de)}"><input id="rate" type="date" style="width:auto" value="${esc(rf.ate)}">` : ""}
      ${select("rcid", [["__all","Todas as cidades"], ...cidades.map(c => [c, c])], rf.cidade, 'style="width:auto"')}
      <button class="iconbtn" id="csv">Baixar CSV</button></div>
    <div class="tiles">
      ${tile("Leads", L.length, rf.base === "data" ? "pela data da festa" : "pela data de entrada")}
      ${tile("Fechados", g.length, "venda fechada + realizado")}
      ${tile("Perdidos", p.length, p.length ? brl(perdida) + " não fechados" : "nenhum")}
      ${tile("Em andamento", a.length, "do novo lead ao aguardando")}
      ${tile("Conversão", conv + "%", fechadas + " decididos")}
      ${tile("Receita", brl(receita), ticket ? "ticket médio " + brl(ticket) : "sem valores lançados", true)}
    </div>
    <div class="tiles" style="grid-template-columns:repeat(3,1fr)">
      ${tile("Propostas geradas", props.length, "todas as versões")}
      ${tile("Enviadas / aprovadas", props.filter(x => x.status === "enviada").length + " / " + props.filter(x => x.status === "aprovada").length, "no histórico")}
      ${tile("Valor em propostas", brl(vProps), "soma do total proposto")}
    </div>
    <div class="panel"><header><h3>Por cidade</h3><p>onde os leads chegam e onde fecham</p>${legend()}</header><div class="pad">${cidadeChart(L)}</div></div>
    <div class="panel"><header><h3>Por mês</h3><p>${rf.base === "data" ? "pela data da festa" : "pela data de entrada"}</p>${legend()}</header><div class="pad">${mesChart(L)}</div></div>
    <div class="dsgrid">
      <div class="panel"><header><h3>Origem dos leads</h3><p>de onde vem quem fecha</p></header><div class="pad">${origemTabela(L)}</div></div>
      <div class="panel"><header><h3>Motivos de perda</h3><p>o que mais derruba negócio</p></header><div class="pad">${(() => {
        const m = {}; p.forEach(l => { const k = l.motivo || "sem motivo"; m[k] = (m[k] || 0) + 1; });
        const e = Object.entries(m).sort((a, b) => b[1] - a[1]);
        return e.length ? `<div class="citybars">${e.map(([k, v]) => `<div class="cityrow" style="grid-template-columns:1fr auto"><span class="cn">${esc(k)}</span><span class="cv">${v}</span></div>`).join("")}</div>` : '<p style="margin:0;color:var(--ink-3);font-size:13.5px">Nenhuma perda no período.</p>'; })()}</div></div>
    </div>
    <div class="panel"><header><h3>Oportunidades a retrabalhar</h3><p>perdidos do período, com o motivo</p></header><div class="pad">${perdidosTabela(p)}</div></div>`;

  $("#rbase").addEventListener("change", e => { rf.base = e.target.value; renderRelatorios(); });
  $("#rrange").addEventListener("change", e => { rf.range = e.target.value; aplicaPeriodo(); renderRelatorios(); });
  $("#rcid").addEventListener("change", e => { rf.cidade = e.target.value; renderRelatorios(); });
  if (rf.range === "custom") { $("#rde").addEventListener("change", e => { rf.de = e.target.value; renderRelatorios(); }); $("#rate").addEventListener("change", e => { rf.ate = e.target.value; renderRelatorios(); }); }
  $("#csv").addEventListener("click", () => csv(L));
  $$("[data-lead]", host).forEach(b => b.addEventListener("click", () => go("lead/" + b.dataset.lead)));
  ligarTooltips(host);
}
aplicaPeriodo();
