/* Início: o que precisa de atenção hoje. */
import { S, rows } from "./state.js";
import { ETAPAS, etapa, normaliza, ativo } from "./etapas.js";
import { $, $$, esc, brl2, dataBR, dataHoraBR, relativo, iso } from "./ui.js";
import { alertaLead } from "./pipeline.js";
import { go } from "./router.js";

export function renderInicio(){
  const host = $("#view-inicio"), all = rows();
  if (S.carregando && !all.length) { host.innerHTML = '<div class="empty" style="padding:70px">Carregando…</div>'; return; }

  const hoje0 = new Date(); hoje0.setHours(0,0,0,0);
  const em = (d, dias) => { const x = new Date(hoje0); x.setDate(x.getDate() + dias); return x; };
  const abertos = all.filter(ativo);

  const atrasados  = abertos.filter(l => l.proxima_data && new Date(l.proxima_data) < hoje0);
  const hoje       = abertos.filter(l => l.proxima_data && new Date(l.proxima_data) >= hoje0 && new Date(l.proxima_data) < em(hoje0, 1));
  const aguardando = abertos.filter(l => ["proposta_enviada","aguardando_cliente"].includes(normaliza(l.etapa)));
  const parados    = abertos.filter(l => !l.proxima_data && !["venda_fechada"].includes(normaliza(l.etapa)) &&
                                     Date.now() - new Date(l.ultimo_contato_em || l.criado_em) > 7 * 864e5);
  const eventos    = all.filter(l => ["venda_fechada"].includes(normaliza(l.etapa)) && l.data && l.data >= iso(0) && l.data <= iso(15))
                        .sort((a, b) => a.data.localeCompare(b.data));
  const vencendo   = S.propostas.filter(p => ["gerada","enviada"].includes(p.status) && p.validade && p.validade >= iso(0) && p.validade <= iso(5));
  const novos      = all.filter(l => normaliza(l.etapa) === "novo_lead");

  const nome = S.usuario ? S.usuario.nome.split(" ")[0] : "";
  const bloco = (titulo, sub, itens, fmt, vazio) => `
    <div class="panel"><header><h3>${titulo}</h3><p>${sub}</p></header><div class="pad">
      ${itens.length ? `<div class="lista">${itens.map(fmt).join("")}</div>` : `<p style="margin:0;color:var(--ink-3);font-size:13.5px">${vazio}</p>`}
    </div></div>`;
  const linhaLead = (l, extra) => `<button class="li" data-lead="${esc(l.id)}">
      <span class="li-t"><b>${esc(l.responsavel)}</b><span>${esc(l.evento || "")} · ${esc(l.cidade || "")}</span></span>
      <span class="li-r">${extra}</span></button>`;

  host.innerHTML = `
    <div class="bar"><div><p class="eyebrow">${new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}</p>
      <h1 style="font-size:26px;margin:2px 0 0">${nome ? "Bom trabalho, " + esc(nome) + "." : "Início"}</h1></div>
      <div class="grow"></div><button class="btn sm" data-go="pipeline">Abrir o pipeline</button></div>

    <div class="tiles five">
      <div class="tile ${atrasados.length ? "hero" : ""}"><span class="k">Atrasados</span><span class="v">${atrasados.length}</span><span class="s">follow-ups vencidos</span></div>
      <div class="tile"><span class="k">Para hoje</span><span class="v">${hoje.length}</span><span class="s">contatos marcados</span></div>
      <div class="tile"><span class="k">Novos</span><span class="v">${novos.length}</span><span class="s">sem primeiro contato</span></div>
      <div class="tile"><span class="k">Aguardando</span><span class="v">${aguardando.length}</span><span class="s">proposta com o cliente</span></div>
      <div class="tile"><span class="k">Parados</span><span class="v">${parados.length}</span><span class="s">sem contato há 7+ dias</span></div>
    </div>

    <div class="dsgrid">
      <div>
        ${bloco("Follow-ups", "atrasados primeiro, depois os de hoje", [...atrasados, ...hoje], l =>
          linhaLead(l, `<span class="alerta ${new Date(l.proxima_data) < hoje0 ? "atrasado" : "hoje"}">${esc(l.proxima_acao || "retornar")} · ${dataHoraBR(l.proxima_data)}</span>`),
          "Nenhum contato marcado para hoje. Registre a próxima ação nos leads em andamento.")}
        ${bloco("Novos leads", "chegaram e ninguém falou com eles", novos, l =>
          linhaLead(l, `<span class="mono" style="color:var(--ink-3)">${relativo(l.criado_em)}</span>`), "Todos os leads já receberam o primeiro contato.")}
        ${bloco("Sem contato há mais de 7 dias", "e sem próxima ação marcada", parados, l =>
          linhaLead(l, `<span class="mono" style="color:var(--ink-3)">${etapa(l.etapa).curto} · ${relativo(l.ultimo_contato_em || l.criado_em)}</span>`), "Ninguém esquecido.")}
      </div>
      <div>
        ${bloco("Aguardando o cliente", "proposta enviada, sem resposta", aguardando, l =>
          linhaLead(l, `<span class="mono" style="color:var(--ink-3)">${etapa(l.etapa).curto}</span>`), "Nenhuma proposta pendente de resposta.")}
        ${bloco("Propostas vencendo", "validade nos próximos 5 dias", vencendo, p =>
          `<button class="li" data-lead="${esc(p.lead_id || "")}"><span class="li-t"><b>${esc(p.responsavel)}</b><span>proposta ${String(p.numero).padStart(4,"0")} · ${brl2(p.valor_total)}</span></span>
           <span class="li-r mono" style="color:var(--warn)">vence ${dataBR(p.validade)}</span></button>`, "Nenhuma proposta perto de expirar.")}
        ${bloco("Próximos eventos", "vendas fechadas nos próximos 15 dias", eventos, l =>
          linhaLead(l, `<span class="mono">${dataBR(l.data)}${l.horario ? " " + esc(l.horario) : ""}</span>`), "Nenhum evento nas próximas duas semanas.")}
      </div>
    </div>`;

  $("[data-go]", host).addEventListener("click", () => go("pipeline"));
  $$("[data-lead]", host).forEach(b => b.addEventListener("click", () => { if (b.dataset.lead) go("lead/" + b.dataset.lead); }));
}
