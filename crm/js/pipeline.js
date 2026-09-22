/* Pipeline comercial — kanban com as dez etapas do funil. */
import { S, rows, admin } from "./state.js";
import * as api from "./api.js";
import { ETAPAS, etapa, normaliza } from "./etapas.js";
import { $, $$, esc, brl, dataBR, relativo, toast, erroTexto, abrirGaveta, fecharGaveta, select } from "./ui.js";
import { go } from "./router.js";
import { recarregarLeads } from "./dados.js";

const filtro = { q: "", cidade: "__all", resp: "__all" };

export function alertaLead(l){
  if (!["venda_fechada","venda_perdida"].includes(normaliza(l.etapa))) {
    const hoje = new Date(); hoje.setHours(0,0,0,0);
    if (l.proxima_data) {
      const d = new Date(l.proxima_data);
      if (d < hoje) return { cls: "atrasado", txt: "follow-up atrasado" };
      if (d - hoje < 864e5) return { cls: "hoje", txt: "contato hoje" };
    }
    const ult = new Date(l.ultimo_contato_em || l.criado_em || 0);
    if (Date.now() - ult > 7 * 864e5) return { cls: "parado", txt: "sem contato " + relativo(ult) };
  }
  return null;
}

/* Valor da negociação: o que foi gravado no lead ou, se ainda não houver, o total da proposta mais recente dele. */
export function valorNegociado(l){
  if (Number(l.valor) > 0) return Number(l.valor);
  const props = (S.propostas || []).filter(p => p.lead_id === l.id && p.status !== "recusada" && p.status !== "expirada");
  if (!props.length) return 0;
  const aprovada = props.find(p => p.status === "aprovada");
  const p = aprovada || props.slice().sort((a, b) => (b.numero || 0) - (a.numero || 0))[0];
  return Number(p.valor_total) || 0;
}

export function cardLead(l){
  const pessoas = (Number(l.criancas) || 0) + (Number(l.adultos) || 0);
  const a = alertaLead(l), v = valorNegociado(l);
  return `<button class="lead" data-id="${esc(l.id)}" draggable="true">
    <span class="who">${esc(l.responsavel || "Sem nome")}</span>
    <span class="ev">${esc(l.evento || "")}</span>
    <span class="meta"><span>${esc(l.cidade || "—")}</span><span>${dataBR(l.data)}</span>
      ${pessoas ? `<span>${pessoas} pess.</span>` : ""}</span>
    ${v ? `<span class="val">${brl(v)}</span>` : `<span class="val vazio">sem valor</span>`}
    ${a ? `<span class="alerta ${a.cls}">${a.txt}</span>` : ""}
  </button>`;
}

export function renderPipeline(){
  const host = $("#view-pipeline"), all = rows();
  if (S.carregando && !all.length) { host.innerHTML = '<div class="empty" style="padding:70px">Carregando…</div>'; return; }

  const cidades = [...new Set(all.map(l => l.cidade).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const q = filtro.q.toLowerCase();
  const vis = all.filter(l =>
    (filtro.cidade === "__all" || l.cidade === filtro.cidade) &&
    (filtro.resp === "__all" || l.responsavel_id === filtro.resp) &&
    (!q || [l.responsavel, l.evento, l.local_festa, l.nome_local, l.cidade, l.telefone].join(" ").toLowerCase().includes(q)));

  let h = `<div class="bar">
    <div><p class="eyebrow">Pipeline</p><h1 style="font-size:26px;margin:2px 0 0">${all.length} lead${all.length === 1 ? "" : "s"}</h1></div>
    <div class="grow"></div>
    <div class="search"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
      <input id="q" type="text" placeholder="Buscar nome, evento, local…" value="${esc(filtro.q)}"></div>
    ${select("fc", [["__all","Todas as cidades"], ...cidades.map(c => [c, c])], filtro.cidade, 'style="width:auto"')}
    ${S.usuarios.length > 1 ? select("fr", [["__all","Todos os responsáveis"], ...S.usuarios.map(u => [u.id, u.nome])], filtro.resp, 'style="width:auto"') : ""}
    <button class="btn sm" id="novo-lead">Novo lead</button>
  </div>`;

  h += '<div class="board">';
  ETAPAS.forEach(s => {
    const items = vis.filter(l => normaliza(l.etapa) === s.id);
    const soma = items.reduce((a, l) => a + valorNegociado(l), 0);
    h += `<div class="col" data-stage="${s.id}" style="--stc:${s.cor}">
      <div class="col-head"><div class="t"><h3>${s.nome}</h3><span class="n">${items.length}</span></div>
      <span class="v">${soma ? brl(soma) : "&nbsp;"}</span></div>
      <div class="col-body">${items.length ? items.map(cardLead).join("") : '<div class="empty">—</div>'}</div></div>`;
  });
  h += '</div>';
  host.innerHTML = h;

  const qi = $("#q");
  qi.addEventListener("input", () => { filtro.q = qi.value; const p = qi.selectionStart; renderPipeline(); const n = $("#q"); n.focus(); n.setSelectionRange(p, p); });
  $("#fc").addEventListener("change", e => { filtro.cidade = e.target.value; renderPipeline(); });
  const fr = $("#fr"); if (fr) fr.addEventListener("change", e => { filtro.resp = e.target.value; renderPipeline(); });
  $("#novo-lead").addEventListener("click", novoLeadManual);

  $$(".lead", host).forEach(c => {
    c.addEventListener("click", () => go("lead/" + c.dataset.id));
    c.addEventListener("dragstart", e => { e.dataTransfer.setData("text/plain", c.dataset.id); e.dataTransfer.effectAllowed = "move"; });
  });
  $$(".col", host).forEach(col => {
    col.addEventListener("dragover", e => { e.preventDefault(); col.classList.add("drop"); });
    col.addEventListener("dragleave", () => col.classList.remove("drop"));
    col.addEventListener("drop", async e => {
      e.preventDefault(); col.classList.remove("drop");
      const id = e.dataTransfer.getData("text/plain"); if (id) await moverEtapa(id, col.dataset.stage);
    });
  });
}

export async function moverEtapa(id, nova){
  const l = rows().find(x => x.id === id);
  if (!l || normaliza(l.etapa) === nova) return;
  if (nova === "venda_perdida") { pedirMotivo(l); return; }
  try { await api.salvarLead(id, { etapa: nova }); toast("Movido para " + etapa(nova).nome + "."); recarregarLeads(); }
  catch (e) { toast(erroTexto(e)); }
}

export function pedirMotivo(l){
  abrirGaveta(`
    <div class="drawer-head"><div><p class="eyebrow">Venda perdida</p><h2>${esc(l.responsavel)}</h2>
      <p style="margin:2px 0 0;color:var(--ink-2);font-size:13.5px">O motivo alimenta o relatório de oportunidades a retrabalhar.</p></div>
      <button class="x" data-fechar aria-label="Fechar">×</button></div>
    <div class="drawer-body">
      <div class="field"><label for="mp-motivo">Motivo</label>
        ${select("mp-motivo", [["","Selecione…"], ...S.motivos.map(m => [m.nome, m.nome])], l.motivo || "")}</div>
      <div class="field"><label for="mp-nota">Anotação (opcional)</label><textarea id="mp-nota" placeholder="O que o cliente disse…"></textarea></div>
    </div>
    <div class="drawer-foot"><button class="btn" id="mp-ok">Marcar como perdida</button><button class="btn ghost sm" data-fechar>Cancelar</button></div>`);
  $("#mp-ok").addEventListener("click", async () => {
    const motivo = $("#mp-motivo").value; if (!motivo) { toast("Escolha o motivo."); return; }
    try {
      await api.salvarLead(l.id, { etapa: "venda_perdida", motivo });
      const nota = $("#mp-nota").value.trim();
      if (nota) await api.registrarInteracao({ lead_id: l.id, tipo: "negociacao", descricao: nota });
      fecharGaveta(); toast("Registrado."); recarregarLeads();
    } catch (e) { toast(erroTexto(e)); }
  });
}

function novoLeadManual(){
  const hoje = new Date().toISOString().slice(0, 10);
  abrirGaveta(`
    <div class="drawer-head"><div><p class="eyebrow">Cadastro manual</p><h2>Novo lead</h2>
      <p style="margin:2px 0 0;color:var(--ink-2);font-size:13.5px">Para quem chegou pelo WhatsApp, Instagram ou indicação.</p></div>
      <button class="x" data-fechar aria-label="Fechar">×</button></div>
    <div class="drawer-body">
      <div class="field"><label for="nl-resp">Nome do responsável *</label><input id="nl-resp" type="text"></div>
      <div class="grid2">
        <div class="field"><label for="nl-tel">WhatsApp *</label><input id="nl-tel" type="tel" placeholder="(31) 99999-9999"></div>
        <div class="field"><label for="nl-origem">Origem</label>${select("nl-origem", [["whatsapp","WhatsApp"],["instagram","Instagram"],["indicacao","Indicação"],["presencial","Presencial"],["outro","Outro"]], "whatsapp")}</div>
      </div>
      <div class="field"><label for="nl-evento">Evento *</label><input id="nl-evento" type="text" placeholder="Helena, 6 anos — ou: confraternização"></div>
      <div class="grid2">
        <div class="field"><label for="nl-cidade">Cidade *</label><input id="nl-cidade" type="text" value="Sete Lagoas"></div>
        <div class="field"><label for="nl-data">Data *</label><input id="nl-data" type="date" min="${hoje}"></div>
      </div>
      <div class="field"><label for="nl-local">Local (pode completar depois)</label><input id="nl-local" type="text"></div>
      <div class="field"><label for="nl-obs">Primeira anotação</label><textarea id="nl-obs" placeholder="O que o cliente contou no primeiro contato…"></textarea></div>
    </div>
    <div class="drawer-foot"><button class="btn" id="nl-ok">Cadastrar</button><button class="btn ghost sm" data-fechar>Cancelar</button></div>`);
  $("#nl-tel").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").replace(/^(\d{2})(\d{4,5})(\d{4}).*/, "($1) $2-$3"); });
  $("#nl-ok").addEventListener("click", async () => {
    const d = {
      responsavel: $("#nl-resp").value.trim(), telefone: $("#nl-tel").value.trim(), origem: $("#nl-origem").value,
      evento: $("#nl-evento").value.trim(), cidade: $("#nl-cidade").value.trim(), data: $("#nl-data").value,
      local_festa: $("#nl-local").value.trim() || "a definir", nome_local: $("#nl-local").value.trim() || null,
      uf: "MG", etapa: "novo_lead", responsavel_id: S.usuario ? S.usuario.id : null
    };
    if (!d.responsavel || !d.telefone || !d.evento || !d.cidade || !d.data) { toast("Preencha os campos com *."); return; }
    try {
      const novo = await api.criarLead(d);
      const obs = $("#nl-obs").value.trim();
      if (obs) await api.registrarInteracao({ lead_id: novo.id, tipo: d.origem === "whatsapp" ? "whatsapp" : "observacao", descricao: obs });
      fecharGaveta(); toast("Lead cadastrado."); await recarregarLeads(); go("lead/" + novo.id);
    } catch (e) { toast(erroTexto(e)); }
  });
}
