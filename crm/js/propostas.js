/* Montagem de propostas: escolhe o lead, a categoria, os itens e o deslocamento;
   grava, gera o PDF, publica e abre a confirmação do WhatsApp. */
import { S, rows, admin } from "./state.js";
import * as api from "./api.js";
import { ativo } from "./etapas.js";
import { $, $$, esc, brl2, dataBR, toast, erroTexto, abrirGaveta, fecharGaveta, waLink, select } from "./ui.js";
import { go } from "./router.js";
import { recarregarComercial, recarregarLeads } from "./dados.js";
import { categoria, precificar } from "./motores/precificacao.js";
import { calcularRota, temMaps } from "./motores/rota.js";
import { montarPDFModelo, preCarregarModelo } from "./pdf-modelo.js";
import { destinoRota, localProposta } from "./lead.js";

export const STATUS = [
  { id: "rascunho", nome: "Rascunho", cor: "var(--ink-3)" }, { id: "gerada", nome: "Gerada", cor: "var(--st-novo)" },
  { id: "enviada", nome: "Enviada", cor: "var(--st-orcamento)" }, { id: "negociacao", nome: "Em negociação", cor: "var(--st-negociacao)" },
  { id: "aprovada", nome: "Aprovada", cor: "var(--st-ganho)" }, { id: "recusada", nome: "Recusada", cor: "var(--st-perdido)" },
  { id: "expirada", nome: "Expirada", cor: "var(--ink-3)" }
];
const cfgNum = (k, pad) => { const v = S.cfg[k]; return (v == null || v === "") ? pad : Number(v); };
const cfgTxt = (k, pad) => { const v = S.cfg[k]; return (v == null || v === "") ? pad : String(v); };

let np = null;
const nova = () => ({ leadId: "", lead: null, convidados: null, convAuto: false, kg: null, horas: null, atendentes: null, categoria: "misto",
                      adic: {}, km: null, kmIda: null, duracao: "", desconto: 0, obs: "", calculando: false, erro: "", salvando: false });
const tabela = () => ({ cfg: S.cfg, categorias: S.categorias, adicionais: S.adicionais });
const conta = () => precificar(np, tabela());

export function renderPropostas(){
  const host = $("#view-propostas");
  if (!S.comercialOk) { host.innerHTML = '<div class="empty" style="padding:70px">Carregando a tabela comercial…</div>'; recarregarComercial(); return; }
  if (!np) np = nova();
  preCarregarModelo();
  if (S.propostaLead) { escolherLead(S.propostaLead); S.propostaLead = null; }
  const r = conta();
  const leadsDisp = rows().filter(ativo).sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));

  let h = `<div class="bar"><div><p class="eyebrow">Propostas</p><h1 style="font-size:26px;margin:2px 0 0">Montar uma proposta</h1></div><div class="grow"></div>
    ${admin() ? '<button class="iconbtn" data-go="tabela">Tabela comercial</button>' : ""}</div>
    <div class="dsgrid"><div style="display:flex;flex-direction:column;gap:18px">
    <div class="paper"><div class="paper-sec"><header><h3>1. De quem é a festa</h3><span>puxa tudo do cadastro</span></header>
      ${select("np-lead", [["", "Escolha um lead do pipeline…"], ...leadsDisp.map(l => [l.id, `${l.responsavel || "—"} · ${l.evento || ""} · ${dataBR(l.data)}`])], np.leadId)}`;

  if (np.lead) {
    const l = np.lead;
    h += `<dl class="readout"><dt>Responsável</dt><dd>${esc(l.responsavel)} · <a href="${waLink(l.telefone)}" target="_blank" rel="noopener">${esc(l.telefone || "")}</a></dd>
      <dt>Evento</dt><dd>${esc(l.evento || "—")}</dd><dt>Local</dt><dd>${esc(destinoRota(l) || "—")}</dd>
      <dt>Data</dt><dd>${dataBR(l.data)}${l.horario ? " às " + esc(l.horario) : ""}</dd>${l.obs ? `<dt>Observações</dt><dd>${esc(l.obs)}</dd>` : ""}
      <dd style="grid-column:1/-1"><button class="linkbtn" data-go="lead/${esc(l.id)}">abrir a página do lead</button></dd></dl>
      <div class="grid3">
        <div class="field"><label for="np-conv">Convidados</label><input id="np-conv" type="number" min="1" step="1" value="${np.convidados == null ? "" : np.convidados}"><span class="hint">${np.convAuto ? "veio do cadastro" : "informe para calcular"}</span></div>
        <div class="field"><label for="np-horas">Duração (horas)</label><input id="np-horas" type="number" min="1" step="0.5" value="${np.horas == null ? r.inclusas : np.horas}"><span class="hint">${r.inclusas}h inclusas</span></div>
        <div class="field"><label for="np-atend">Atendentes</label><input id="np-atend" type="number" min="1" step="1" value="${np.atendentes == null ? r.atInclusos : np.atendentes}"><span class="hint">${r.atInclusos} inclus${r.atInclusos === 1 ? "a" : "as"}${cfgNum("atendente_extra_valor", 0) ? " · extra " + brl2(cfgNum("atendente_extra_valor", 0)) : " · extra sem preço na tabela"}</span></div>
      </div>`;
  }
  h += `</div></div>`;

  if (np.lead) {
    const rotKg = cfgTxt("rotulo_quantidade", "Quantidade de balas");
    h += `<div class="paper"><div class="paper-sec"><header><h3>2. ${esc(rotKg)}</h3><span>${np.kg ? "ajustada por você" : "calculada pelo sistema"}</span></header>
      <div style="display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap">
        <div class="field" style="max-width:150px"><label for="np-kg">${esc(rotKg)} (kg)</label><input id="np-kg" type="number" min="1" step="1" value="${r.kg}"></div>
        <p style="margin:0 0 6px;font-size:13.5px;color:var(--ink-2)">${np.convidados ? `<b>${np.convidados} convidados</b> × ${cfgNum("gramas_por_pessoa", cfgNum("gramas_saquinho", 150))} g = <b>${r.kgNec.toLocaleString("pt-BR")} kg</b>${r.kg > r.kgNec ? " → arredondado para <b>" + r.kg + " kg</b>" + (r.kgMin >= r.kg && r.kgNec < r.kg - 1 ? " (mínimo da tabela)" : "") : ""}.` : "Informe os convidados para o sistema calcular."}${np.kg ? ' · <button class="linkbtn" id="np-kg-auto">voltar ao cálculo</button>' : ""}</p>
      </div></div>
    <div class="paper-sec"><header><h3>3. As três categorias de balas</h3><span>vão todas para a proposta — marque a que vale para o pipeline</span></header><div style="display:flex;flex-direction:column;gap:8px">${
      r.opcoes.map(o => `<button class="catbtn${np.categoria === o.categoria ? " on" : ""}" data-cat="${o.categoria}"><span class="catn">${esc(o.nome)}</span>
        <span class="cats">${esc(o.descricao)}${o.descricao ? "<br>" : ""}${r.kg} kg × ${brl2(o.porKg)}/kg = ${brl2(o.balas)}</span>
        <span class="catv">${brl2(o.total)} <small>${r.parcelas}× ${brl2(o.parcela)} · à vista ${brl2(o.avista)}</small></span></button>`).join("")}</div>
      <p style="margin:10px 0 0;font-size:12.5px;color:var(--ink-3)">Os valores já incluem adicionais, horas e atendentes extras, deslocamento e desconto — do jeito que aparecem na página 3 do PDF. Preço por quilo: aba Tabela comercial.</p></div>
    <div class="paper-sec"><header><h3>4. Produtos adicionais</h3><span>vendidos em lotes fechados</span></header><div class="adics">${
      S.adicionais.map(a => { const qtd = Number(np.adic[a.id]) || 0, lotes = qtd ? Math.round(qtd / a.qtd_minima) : 0;
        return `<div class="adicrow${qtd ? " on" : ""}"><span class="adicn">${esc(a.nome)}<small>lote de ${a.qtd_minima} · ${brl2(a.valor_unit)} cada</small></span>
          <span class="stepper"><button data-adic="${a.id}" data-d="-1" aria-label="menos">−</button><b>${lotes}</b><button data-adic="${a.id}" data-d="1" aria-label="mais">+</button></span>
          <span class="adicv mono">${qtd ? brl2(qtd * Number(a.valor_unit)) : "—"}</span></div>`; }).join("")}</div></div>
    <div class="paper-sec"><header><h3>5. Deslocamento</h3><span>${brl2(r.vKm)} por km rodado</span></header>
      <p style="margin:0;font-size:12.5px;color:var(--ink-3)">De <b>${esc(cfgTxt("origem_endereco", "—"))}</b> até <b>${esc(destinoRota(np.lead) || "—")}</b>${!np.lead.logradouro ? ' <span style="color:var(--warn)">— sem endereço completo; cadastre o CEP na página do lead para uma rota exata.</span>' : ""}</p>
      <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap">
        <div class="field" style="max-width:170px"><label for="np-km">Distância ida e volta (km)</label><input id="np-km" type="number" min="0" step="0.1" value="${np.km == null ? "" : np.km}"></div>
        <button class="btn ghost sm" id="np-calc"${np.calculando ? " disabled" : ""}>${np.calculando ? "Consultando o Maps…" : "Calcular pelo Maps"}</button></div>
      ${np.kmIda ? `<p style="margin:0;font-size:12.5px;color:var(--ink-3)">Ida: ${np.kmIda.toLocaleString("pt-BR")} km · total considerado: ${Number(np.km).toLocaleString("pt-BR")} km · ${esc(np.duracao)} de viagem · regra: R$ ${cfgNum("km_valor", 0).toFixed(2)}/km desde o primeiro km.</p>` : ""}
      ${np.erro ? `<p class="err">${esc(np.erro)}</p>` : ""}</div>
    <div class="paper-sec"><header><h3>6. Fechamento</h3><span>desconto e observações</span></header>
      <div class="grid2"><div class="field"><label for="np-desc">Desconto autorizado (R$)</label><input id="np-desc" type="number" min="0" step="10" value="${np.desconto || ""}"></div>
        <div class="field"><label>Validade</label><input type="text" value="${cfgNum("validade_dias", 30)} dias" disabled></div></div>
      <div class="field"><label for="np-obs">Observações na proposta</label><textarea id="np-obs" placeholder="Combinações especiais, restrições alimentares, pedidos do cliente…">${esc(np.obs || "")}</textarea></div></div></div>`;
  }
  h += `</div><div>${memoria(r)}</div></div>` + historico();
  host.innerHTML = h;
  ligar();
}

function memoria(r){
  if (!np || !np.lead) return `<div id="np-memo"><div class="panel" style="margin:0"><div class="pad"><p class="eyebrow" style="margin:0 0 10px">Memória de cálculo</p><p style="margin:0;color:var(--ink-3);font-size:13.5px">Escolha um lead para o sistema montar a proposta.</p></div></div></div>`;
  const linha = (rot, val, sub) => `<div class="memrow"><span>${rot}${sub ? `<small>${sub}</small>` : ""}</span><b class="mono">${val}</b></div>`;
  return `<div id="np-memo"><div class="panel" style="margin:0;position:sticky;top:78px"><div class="pad">
    <p class="eyebrow" style="margin:0 0 4px">Total da proposta</p><p class="memtotal">${brl2(r.total)}</p>
    <p style="margin:2px 0 16px;font-size:12.5px;color:var(--ink-3);font-family:var(--mono)">${r.parcelas}× ${brl2(r.parcela)} &nbsp;·&nbsp; à vista ${brl2(r.avista)} (−${r.pctAvista}%)</p>
    <div class="mem">${linha("Balas", brl2(r.balas), r.kg + " kg × " + brl2(r.porKg) + " · " + categoria(S.categorias, np.categoria).nome + " (destaque)")}
      ${r.adic.map(a => linha(esc(a.nome), brl2(a.total), a.qtd + " un × " + brl2(a.unit))).join("")}
      ${r.extras > 0 ? linha("Horas extras", brl2(r.vHoras), r.extras + "h além das " + r.inclusas + "h") : ""}
      ${r.atExtras > 0 ? linha("Atendentes extras", brl2(r.vAtend), r.atExtras + " além da inclusa") : ""}
      ${r.vDesl > 0 ? linha("Deslocamento", brl2(r.vDesl), r.km + " km × " + brl2(r.vKm)) : ""}
      ${r.desc > 0 ? linha("Desconto", "− " + brl2(r.desc), "autorizado") : ""}</div>
    <div class="mem" style="margin-top:10px;border-top:1px dashed var(--line);padding-top:8px">${r.opcoes.map(o => linha(esc(o.nome), brl2(o.total), r.kg + " kg")).join("")}</div>
    <div class="memfoot"><button class="btn" id="np-gerar"${np.salvando ? " disabled" : ""}>${np.salvando ? "Gerando…" : "Gerar proposta em PDF"}</button><button class="btn ghost sm" id="np-limpar">Recomeçar</button></div></div>
    <div class="pad" style="border-top:1px solid var(--line);padding-top:13px"><p style="margin:0;font-size:12px;color:var(--ink-3)">Já incluso: ${(S.cfg.inclusos || []).map(esc).join(" · ")}.</p></div></div></div>`;
}

function historico(){
  if (!S.propostas.length) return "";
  return `<div class="panel" style="margin-top:26px"><header><h3>Propostas geradas</h3><p>${S.propostas.length} no total</p></header><div class="pad"><div class="tablewrap">
    <table class="data"><thead><tr><th>Nº</th><th>Cliente</th><th>Evento</th><th>Data</th><th>Conv.</th><th>Balas</th><th>Total</th><th>Status</th><th>PDF</th></tr></thead><tbody>${
    S.propostas.map(p => { const st = STATUS.find(s => s.id === p.status) || STATUS[0];
      return `<tr><td class="n">${String(p.numero).padStart(4, "0")}</td><td>${p.lead_id ? `<button class="linkbtn" data-go="lead/${esc(p.lead_id)}">${esc(p.responsavel || "—")}</button>` : esc(p.responsavel || "—")}</td>
        <td>${esc(p.evento || "—")}</td><td class="n">${dataBR(p.data_evento)}</td><td class="n">${p.convidados || "—"}</td><td class="n">${p.kg_total || 0} kg</td><td class="n"><b>${brl2(p.valor_total)}</b></td>
        <td>${select("", STATUS.map(s => [s.id, s.nome]), p.status, `class="ministatus" data-st-prop="${esc(p.id)}" style="--stc:${st.cor}"`)}</td>
        <td style="white-space:nowrap">${p.pdf_url ? `<a href="${esc(p.pdf_url)}" target="_blank" rel="noopener">abrir</a> · ` : ""}<button class="linkbtn" data-del-prop="${esc(p.id)}">excluir</button>${p.pdf_url ? ` · <button class="linkbtn" data-wa-prop="${esc(p.id)}">WhatsApp</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div></div></div>`;
}

function escolherLead(id){
  const l = rows().find(x => x.id === id);
  np = nova(); if (!l) return;
  np.leadId = l.id; np.lead = l;
  const c = (Number(l.criancas) || 0) + (Number(l.adultos) || 0);
  if (c > 0) { np.convidados = c; np.convAuto = true; }
}

function ligar(){
  const host = $("#view-propostas");
  const re = () => { $("#np-memo").outerHTML = memoria(conta()); ligarMemo(); };
  $("#np-lead").addEventListener("change", e => { escolherLead(e.target.value); renderPropostas(); });
  const campo = (id, prop, numero) => { const n = $("#" + id); if (!n) return;
    n.addEventListener("input", () => { np[prop] = n.value === "" ? (numero ? null : "") : (numero ? Number(n.value) : n.value);
      if (prop === "convidados") { np.convAuto = false; np.kg = null; renderPropostas(); return; }
      if (prop === "kg") { renderPropostas(); const n2 = $("#np-kg"); if (n2) { n2.focus(); } return; } re(); }); };
  campo("np-conv", "convidados", true); campo("np-kg", "kg", true); campo("np-horas", "horas", true); campo("np-atend", "atendentes", true);
  campo("np-km", "km", true); campo("np-desc", "desconto", true); campo("np-obs", "obs", false);
  $$("[data-cat]", host).forEach(b => b.addEventListener("click", () => { np.categoria = b.dataset.cat; renderPropostas(); }));
  const auto = $("#np-kg-auto"); if (auto) auto.addEventListener("click", () => { np.kg = null; renderPropostas(); });
  $$("[data-adic]", host).forEach(b => b.addEventListener("click", () => {
    const a = S.adicionais.find(x => x.id === b.dataset.adic); const novo = (Number(np.adic[a.id]) || 0) + Number(b.dataset.d) * a.qtd_minima;
    if (novo <= 0) delete np.adic[a.id]; else np.adic[a.id] = novo; renderPropostas(); }));
  const calc = $("#np-calc"); if (calc) calc.addEventListener("click", async () => {
    np.erro = ""; if (!temMaps()) { np.erro = "Sem chave do Google Maps. Digite a distância à mão."; renderPropostas(); return; }
    np.calculando = true; renderPropostas();
    try { const r = await calcularRota(cfgTxt("origem_endereco", ""), destinoRota(np.lead)); np.km = r.kmTotal; np.kmIda = r.kmIda; np.duracao = r.duracao; }
    catch (e) { np.erro = String(e.message || e); }
    np.calculando = false; renderPropostas(); });
  $$("[data-go]", host).forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  $$("[data-st-prop]", host).forEach(s => s.addEventListener("change", async () => {
    try {
      await api.salvarProposta(s.dataset.stProp, { status: s.value }); toast("Status atualizado.");
      const p = S.propostas.find(x => x.id === s.dataset.stProp);
      if (p && p.lead_id && ["aprovada", "enviada", "negociacao"].includes(s.value)) await atualizarValorLead(p.lead_id, p.valor_total);
      recarregarComercial();
    } catch (e) { toast(erroTexto(e)); } }));
  $$("[data-wa-prop]", host).forEach(b => b.addEventListener("click", () => { const p = S.propostas.find(x => x.id === b.dataset.waProp); if (p) abrirEnvio(p); }));
  $$("[data-del-prop]", host).forEach(b => b.addEventListener("click", () => { const p = S.propostas.find(x => x.id === b.dataset.delProp); if (p) confirmarExclusao(p); }));
  ligarMemo();
}
function ligarMemo(){
  const g = $("#np-gerar"); if (g) g.addEventListener("click", gerar);
  const l = $("#np-limpar"); if (l) l.addEventListener("click", () => { np = nova(); renderPropostas(); });
}

/* Valor da negociação: o total em destaque da proposta vai para o lead (leads.valor) e aparece no pipeline. Nunca derruba a geração. */
async function atualizarValorLead(leadId, valor){
  if (!leadId || !(Number(valor) > 0)) return;
  try { await api.salvarLead(leadId, { valor: Math.round(Number(valor) * 100) / 100 }); recarregarLeads(); } catch { /* valor é informativo */ }
}

async function gerar(){
  const r = conta();
  if (!np.lead) { toast("Escolha um lead primeiro."); return; }
  if (!np.convidados) { toast("Informe a quantidade de convidados."); return; }
  if (!(r.kg > 0)) { toast("Informe a quantidade de balas em kg."); return; }
  np.salvando = true; renderPropostas();
  try {
    const l = np.lead, val = new Date(); val.setDate(val.getDate() + cfgNum("validade_dias", 30));
    const linha = {
      lead_id: l.id, responsavel: l.responsavel, telefone: l.telefone, email: l.email || null, evento: l.evento,
      local_festa: localProposta(l), cidade: l.cidade, data_evento: l.data || null, horario: l.horario || null,
      convidados: np.convidados, horas: r.horas, categoria: np.categoria, kg_total: r.kg,
      pacotes: [{ kg: r.kg, valor: r.balas, valor_kg: r.porKg }], valor_balas: r.balas,
      opcoes: r.opcoes.map(o => ({ categoria: o.categoria, nome: o.nome, rotulo_pdf: o.rotulo_pdf, valor_kg: o.porKg, balas: o.balas, total: o.total, parcela: o.parcela, avista: o.avista })),
      adicionais: r.adic.map(a => ({ nome: a.nome, qtd: a.qtd, unit: a.unit, total: a.total })), valor_adicionais: r.vAdic,
      horas_extras: r.extras, valor_horas: r.vHoras,
      distancia_km: r.km || null, duracao_texto: np.duracao || null, valor_km: r.vKm, valor_deslocamento: r.vDesl,
      desconto: r.desc, valor_total: r.total, observacoes: np.obs || null, validade: val.toISOString().slice(0, 10), status: "gerada"
    };
    const prop = await api.criarProposta(linha);
    const blob = await montarPDFModelo(prop, S.cfg);
    const nome = `proposta-${String(prop.numero).padStart(4, "0")}-${prop.id.slice(0, 8)}.pdf`;
    const url = await api.publicarPDF(nome, blob);
    await api.salvarProposta(prop.id, { pdf_url: url }); prop.pdf_url = url;
    await atualizarValorLead(l.id, r.total);   // o valor negociado passa a aparecer no pipeline
    np.salvando = false; await recarregarComercial(); np = nova(); renderPropostas(); abrirEnvio(prop);
  } catch (e) { np.salvando = false; renderPropostas(); toast(erroTexto(e)); }
}

/* Exclusão com confirmação explícita: nada muda até "Confirmar exclusão". */
function confirmarExclusao(p){
  abrirGaveta(`
    <div class="drawer-head"><div><p class="eyebrow">Proposta ${String(p.numero).padStart(4, "0")}</p><h2>Excluir esta proposta?</h2>
      <p style="margin:2px 0 0;color:var(--ink-2);font-size:13.5px">Tem certeza de que deseja excluir esta proposta?</p></div><button class="x" data-fechar aria-label="Fechar">×</button></div>
    <div class="drawer-body">
      <dl class="readout"><dt>Cliente</dt><dd><b>${esc(p.responsavel || "—")}</b></dd><dt>Evento</dt><dd>${esc(p.evento || "—")} · ${dataBR(p.data_evento)}</dd>
        <dt>Valor</dt><dd>${brl2(p.valor_total)}</dd><dt>Status</dt><dd>${esc((STATUS.find(s => s.id === p.status) || STATUS[0]).nome)}</dd></dl>
      <div class="banner">A proposta some da lista e o PDF publicado deixa de existir. Não tem volta — se precisar, gere outra.</div></div>
    <div class="drawer-foot"><button class="btn danger" id="del-ok">Confirmar exclusão</button><button class="btn ghost sm" data-fechar>Cancelar</button></div>`);
  $("#del-ok").addEventListener("click", async () => {
    const btn = $("#del-ok"); btn.disabled = true; btn.textContent = "Excluindo…";
    try {
      await api.apagarProposta(p);
      S.propostas = S.propostas.filter(x => x.id !== p.id);   // some da tela na hora
      fecharGaveta(); renderPropostas(); toast("Proposta excluída com sucesso.");
      recarregarComercial();                                    // e confirma com o banco em segundo plano
    } catch (e) { btn.disabled = false; btn.textContent = "Confirmar exclusão"; toast(erroTexto(e)); }
  });
}

export function mensagemWA(p){
  const primeiro = String(p.responsavel || "").split(" ")[0];
  return `Olá, ${primeiro}! Tudo bem?\n\nSegue a proposta comercial do Carrinho da Fini para ${p.evento || "a sua festa"}${p.data_evento ? ", no dia " + dataBR(p.data_evento) : ""}.\n\n` +
    `Baleiro de ${p.kg_total} kg de balas Fini, nas três modalidades:\n` +
    (p.opcoes && p.opcoes.length ? p.opcoes.map(o => `• ${o.nome}: ${brl2(o.total)}`).join("\n") : `• Valor: ${brl2(p.valor_total)}`) +
    `\n\nProposta completa em PDF: ${p.pdf_url || "(link indisponível)"}\n\nA proposta vale até ${dataBR(p.validade)}. Qualquer dúvida, é só me chamar por aqui!`;
}
export function abrirEnvio(p){
  abrirGaveta(`
    <div class="drawer-head"><div><p class="eyebrow">Proposta ${String(p.numero).padStart(4, "0")}</p><h2>Enviar para o cliente</h2>
      <p style="margin:2px 0 0;color:var(--ink-2);font-size:13.5px">Confira antes de mandar.</p></div><button class="x" data-fechar aria-label="Fechar">×</button></div>
    <div class="drawer-body">
      <dl class="readout"><dt>Cliente</dt><dd><b>${esc(p.responsavel || "—")}</b></dd><dt>WhatsApp</dt><dd class="mono">${esc(p.telefone || "—")}</dd>
        <dt>Evento</dt><dd>${esc(p.evento || "—")} · ${dataBR(p.data_evento)}</dd><dt>Valores</dt><dd>${(p.opcoes && p.opcoes.length ? p.opcoes : [{ nome: "Total", total: p.valor_total }]).map(o => `<span style="display:block"><b style="color:var(--accent)">${brl2(o.total)}</b> <small style="color:var(--ink-3)">${esc(o.nome)}</small></span>`).join("")}</dd>
        <dt>Validade</dt><dd>${dataBR(p.validade)}</dd></dl>
      ${p.pdf_url ? `<div class="banner"><span>O PDF está publicado. <a href="${esc(p.pdf_url)}" target="_blank" rel="noopener">Abrir para conferir</a> antes de enviar.</span></div>` : '<div class="banner">Esta proposta ainda não tem PDF publicado.</div>'}
      <div class="field"><label for="wa-msg">Mensagem que o cliente vai receber</label><textarea id="wa-msg" style="min-height:150px">${esc(mensagemWA(p))}</textarea>
        <span class="hint">O link do PDF vai dentro da mensagem — o WhatsApp mostra a prévia do arquivo.</span></div></div>
    <div class="drawer-foot"><button class="btn" id="wa-go"${p.telefone ? "" : " disabled"}>Abrir WhatsApp e enviar</button><button class="btn ghost sm" data-fechar>Agora não</button></div>`);
  $("#wa-go").addEventListener("click", async () => {
    window.open(waLink(p.telefone, $("#wa-msg").value), "_blank", "noopener");
    if (p.status === "gerada") { try { await api.salvarProposta(p.id, { status: "enviada" }); } catch {} recarregarComercial(); }
    fecharGaveta(); toast("Marcada como enviada.");
  });
}
