/* Administração: usuários e perfis, motivos de perda e trilha de auditoria. Só admin. */
import { S } from "./state.js";
import * as api from "./api.js";
import { $, $$, esc, dataHoraBR, toast, erroTexto, select } from "./ui.js";
import { go } from "./router.js";

const ROTULO_TABELA = { leads: "Lead", propostas: "Proposta", config_comercial: "Regra comercial", pacotes: "Baleiro", adicionais: "Adicional", usuarios: "Usuário" };
const ROTULO_OP = { INSERT: "criou", UPDATE: "alterou", DELETE: "apagou" };
const IGNORAR = new Set(["atualizado_em", "criado_em", "id"]);

function resumoAlteracao(a){
  const antes = a.antes || {}, depois = a.depois || {};
  if (a.operacao === "INSERT") return depois.responsavel || depois.nome || depois.chave || (depois.numero ? "nº " + depois.numero : "") || "";
  if (a.operacao === "DELETE") return antes.responsavel || antes.nome || antes.chave || (antes.numero ? "nº " + antes.numero : "") || "";
  const mudou = Object.keys(depois).filter(k => !IGNORAR.has(k) && JSON.stringify(antes[k]) !== JSON.stringify(depois[k]));
  const quem = antes.responsavel || antes.nome || antes.chave || (antes.numero ? "nº " + antes.numero : "");
  const campos = mudou.slice(0, 4).map(k => {
    const v = (x) => x == null ? "—" : (typeof x === "object" ? JSON.stringify(x) : String(x));
    return `${k}: ${v(antes[k])} → ${v(depois[k])}`;
  }).join(" · ");
  return [quem, campos].filter(Boolean).join(" — ") + (mudou.length > 4 ? ` (+${mudou.length - 4})` : "");
}

export function renderAdmin(){
  const host = $("#view-admin");
  host.innerHTML = `
    <div class="bar"><div><p class="eyebrow">Administração</p><h1 style="font-size:26px;margin:2px 0 0">Equipe, catálogos e auditoria</h1></div><div class="grow"></div>
      <button class="iconbtn" data-go="tabela">Tabela comercial</button></div>
    <p class="lede" style="margin:-8px 0 22px">Quem entra no sistema, o que cada um pode fazer e o registro de tudo que foi alterado.</p>

    <div class="panel"><header><h3>Usuários</h3><p>contas criadas no Supabase Authentication aparecem aqui automaticamente</p></header><div class="pad"><div class="tablewrap">
      <table class="data"><thead><tr><th>Nome</th><th>E-mail</th><th>Perfil</th><th>Ativo</th></tr></thead><tbody>${
      S.usuarios.map(u => { const eu = S.usuario && u.id === S.usuario.id; return `<tr${u.ativo ? "" : ' style="opacity:.55"'}>
        <td><input class="inline" type="text" data-us-nome="${esc(u.id)}" value="${esc(u.nome)}" style="min-width:160px;text-align:left">${eu ? ' <span class="chip">você</span>' : ""}</td>
        <td style="color:var(--ink-3)">${esc(u.email || "")}</td>
        <td>${select("us-perfil-" + u.id, [["admin", "Administrador"], ["vendedor", "Vendedor"]], u.perfil, `data-us-perfil="${esc(u.id)}"${eu ? " disabled" : ""}`)}</td>
        <td><label style="display:flex;align-items:center;gap:6px"><input type="checkbox" style="width:auto" data-us-ativo="${esc(u.id)}"${u.ativo ? " checked" : ""}${eu ? " disabled" : ""}> ${u.ativo ? "sim" : "não"}</label></td></tr>`; }).join("")}
      </tbody></table></div>
      <p style="margin:12px 0 0;font-size:12.5px;color:var(--ink-3)">Para incluir alguém: crie o usuário em <b>Supabase → Authentication → Users → Add user</b> (com e-mail confirmado). Ele entra como vendedor; mude o perfil aqui. Você não altera o próprio perfil nem se desativa.</p>
    </div></div>

    <div class="panel"><header><h3>Motivos de perda</h3><p>opções oferecidas ao marcar uma venda como perdida</p></header><div class="pad">
      <div class="tablewrap"><table class="data"><thead><tr><th>Motivo</th><th>Ordem</th><th></th></tr></thead><tbody>${
      S.motivos.map(m => `<tr><td>${esc(m.nome)}</td><td class="n">${m.ordem}</td><td><button class="linkbtn" data-mo-del="${esc(m.id)}">remover</button></td></tr>`).join("")}
      </tbody></table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:14px">
        <div class="field" style="max-width:280px"><label for="mo-nome">Novo motivo</label><input id="mo-nome" type="text" placeholder="Ex.: Data indisponível"></div>
        <div class="field" style="max-width:100px"><label for="mo-ordem">Ordem</label><input id="mo-ordem" type="number" min="1" value="${(S.motivos.reduce((s, m) => Math.max(s, m.ordem), 0) || 0) + 10}"></div>
        <button class="btn sm" id="mo-add">Adicionar</button></div></div></div>

    <div class="panel"><header><h3>Auditoria</h3><p>últimas 200 alterações</p></header><div class="pad">
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-bottom:12px">
        <div class="field" style="max-width:220px"><label for="au-tabela">Registro</label>${select("au-tabela", [["", "Tudo"], ...Object.entries(ROTULO_TABELA)], "")}</div>
        <button class="btn ghost sm" id="au-load">Atualizar</button></div>
      <div id="au-lista" class="tablewrap"><div class="empty" style="padding:30px">Carregando…</div></div></div></div>`;

  $$("[data-go]", host).forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  const grava = async (fn, depois) => { try { await fn(); toast("Salvo."); if (depois) await depois(); renderAdmin(); } catch (e) { toast(erroTexto(e)); } };
  const recUsuarios = async () => { S.usuarios = await api.listarUsuarios(); };
  const recMotivos  = async () => { S.motivos  = await api.listarMotivos(); };

  $$("[data-us-nome]", host).forEach(i => i.addEventListener("change", () => { const nome = i.value.trim(); if (!nome) { toast("O nome não pode ficar vazio."); return; }
    grava(() => api.salvarUsuario(i.dataset.usNome, { nome }), recUsuarios); }));
  $$("[data-us-perfil]", host).forEach(s => s.addEventListener("change", () => grava(() => api.salvarUsuario(s.dataset.usPerfil, { perfil: s.value }), recUsuarios)));
  $$("[data-us-ativo]", host).forEach(c => c.addEventListener("change", () => grava(() => api.salvarUsuario(c.dataset.usAtivo, { ativo: c.checked }), recUsuarios)));

  $$("[data-mo-del]", host).forEach(b => b.addEventListener("click", () => {
    const m = S.motivos.find(x => x.id === b.dataset.moDel); if (!m) return;
    if (confirm(`Remover o motivo "${m.nome}"? Leads já marcados com ele não mudam.`)) grava(() => api.salvarMotivo({ id: m.id, nome: m.nome, ordem: m.ordem, ativo: false }), recMotivos); }));
  $("#mo-add").addEventListener("click", () => {
    const nome = $("#mo-nome").value.trim(), ordem = Number($("#mo-ordem").value) || 100;
    if (!nome) { toast("Informe o motivo."); return; }
    grava(() => api.salvarMotivo({ nome, ordem, ativo: true }), recMotivos); });

  const carregarAuditoria = async () => {
    const box = $("#au-lista"); if (!box) return;
    try {
      const lista = await api.auditoria({ tabela: $("#au-tabela").value || undefined });
      if (!lista.length) { box.innerHTML = '<div class="empty" style="padding:30px">Nenhuma alteração registrada.</div>'; return; }
      box.innerHTML = `<table class="data"><thead><tr><th>Quando</th><th>Quem</th><th>Ação</th><th>Detalhe</th></tr></thead><tbody>${
        lista.map(a => `<tr><td style="white-space:nowrap">${dataHoraBR(a.criado_em)}</td><td>${esc(a.usuario_email || "sistema")}</td>
          <td style="white-space:nowrap">${ROTULO_OP[a.operacao] || esc(a.operacao)} ${esc(ROTULO_TABELA[a.tabela] || a.tabela)}</td>
          <td style="font-size:12.5px;color:var(--ink-2);max-width:520px;overflow-wrap:anywhere">${esc(resumoAlteracao(a))}</td></tr>`).join("")}</tbody></table>`;
    } catch (e) { box.innerHTML = `<p class="err">${esc(erroTexto(e))}</p>`; }
  };
  $("#au-load").addEventListener("click", carregarAuditoria);
  $("#au-tabela").addEventListener("change", carregarAuditoria);
  carregarAuditoria();
}
