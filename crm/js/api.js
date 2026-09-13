/* A única camada que fala com o Supabase. Telas nunca chamam sb.from() diretamente. */
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { S } from "./state.js";
import { normaliza } from "./etapas.js";

function cliente(){
  if (S.sb) return S.sb;
  if (!window.supabase || !window.supabase.createClient) return null;
  S.sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true } });
  return S.sb;
}
const sb = () => { const c = cliente(); if (!c) throw new Error("Banco indisponível."); return c; };
const ok = (r) => { if (r.error) throw r.error; return r.data; };

/* ---------- sessão ---------- */
export async function sessaoAtual(){
  const c = cliente(); if (!c) return null;
  try { const { data } = await c.auth.getSession(); return data && data.session ? data.session : null; }
  catch { return null; }
}
export function aoMudarSessao(fn){ const c = cliente(); if (c) c.auth.onAuthStateChange((_e, s) => fn(s)); }
export const entrar = (email, password) => sb().auth.signInWithPassword({ email, password });
export const sair   = () => sb().auth.signOut();

export async function meuUsuario(authUser){
  if (!authUser) return null;
  const { data } = await sb().from("usuarios").select("*").eq("id", authUser.id).maybeSingle();
  return data || { id: authUser.id, nome: authUser.email, email: authUser.email, perfil: "vendedor", ativo: true };
}

/* ---------- leads ---------- */
export async function listarLeads(){
  const d = ok(await sb().from("leads").select("*").order("criado_em", { ascending: false }));
  return d.map(l => ({ ...l, etapa: normaliza(l.etapa) }));
}
export const criarLeadPublico = (d) => sb().from("leads").insert(d);
export async function criarLead(d){ return ok(await sb().from("leads").insert(d).select().single()); }
export async function salvarLead(id, patch){ ok(await sb().from("leads").update(patch).eq("id", id)); }
export async function apagarLead(id){ ok(await sb().from("leads").delete().eq("id", id)); }

export function ouvirLeads(fn){
  try {
    return sb().channel("leads-ao-vivo")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, fn)
      .on("postgres_changes", { event: "*", schema: "public", table: "interacoes" }, fn)
      .subscribe();
  } catch { return null; }
}

/* ---------- interações ---------- */
export async function listarInteracoes(leadId){
  return ok(await sb().from("interacoes").select("*").eq("lead_id", leadId).order("criado_em", { ascending: false }));
}
export async function registrarInteracao(d){ return ok(await sb().from("interacoes").insert(d).select().single()); }
export async function apagarInteracao(id){ ok(await sb().from("interacoes").delete().eq("id", id)); }

/* ---------- follow-ups ---------- */
export async function followups(){ return ok(await sb().from("v_followups").select("*")); }

/* ---------- usuários e catálogos ---------- */
export async function listarUsuarios(){ return ok(await sb().from("usuarios").select("*").order("criado_em")); }
export async function salvarUsuario(id, patch){ ok(await sb().from("usuarios").update(patch).eq("id", id)); }
export async function listarMotivos(){ return ok(await sb().from("motivos_perda").select("*").eq("ativo", true).order("ordem")); }
export async function salvarMotivo(d){ ok(await sb().from("motivos_perda").upsert(d, { onConflict: "nome" })); }
export async function auditoria(filtro = {}){
  let q = sb().from("auditoria").select("*").order("criado_em", { ascending: false }).limit(200);
  if (filtro.tabela) q = q.eq("tabela", filtro.tabela);
  if (filtro.registro_id) q = q.eq("registro_id", filtro.registro_id);
  return ok(await q);
}

/* ---------- notificações por e-mail ---------- */
export async function listarNotificacoes(){ return ok(await sb().from("notificacoes").select("*").order("criado_em", { ascending: false }).limit(50)); }
export async function reenviarNotificacao(id){ ok(await sb().from("notificacoes").update({ status: "pendente", resposta: null }).eq("id", id)); }

/* ---------- comercial ---------- */
export async function carregarComercial(){
  try { await sb().rpc("expirar_propostas"); } catch {}
  const [c, p, a, pr] = await Promise.all([
    sb().from("config_comercial").select("chave,valor"),
    sb().from("categorias").select("*").order("ordem"),
    sb().from("adicionais").select("*").eq("ativo", true).order("ordem"),
    sb().from("propostas").select("*").order("criado_em", { ascending: false }).limit(300)
  ]);
  if (c.error) throw c.error;
  const cfg = {}; (c.data || []).forEach(x => { cfg[x.chave] = x.valor; });
  return { cfg, categorias: p.data || [], adicionais: a.data || [], propostas: pr.data || [] };
}
export async function criarProposta(d){ return ok(await sb().from("propostas").insert(d).select().single()); }
export async function salvarProposta(id, patch){ ok(await sb().from("propostas").update(patch).eq("id", id)); }
export async function apagarProposta(p){
  ok(await sb().from("propostas").delete().eq("id", p.id));
  // o PDF publicado sai junto; se o Storage recusar, a proposta já foi apagada e o arquivo só fica órfão
  const nome = String(p.pdf_url || "").split("/propostas/")[1];
  if (nome) { try { await sb().storage.from("propostas").remove([decodeURIComponent(nome)]); } catch {} }
}
export async function publicarPDF(nome, blob){
  ok(await sb().storage.from("propostas").upload(nome, blob, { contentType: "application/pdf", upsert: true }));
  return sb().storage.from("propostas").getPublicUrl(nome).data.publicUrl;
}
export async function salvarConfig(pares){ ok(await sb().from("config_comercial").upsert(pares, { onConflict: "chave" })); }
export async function salvarCategoria(id, patch){ ok(await sb().from("categorias").update(patch).eq("id", id)); }
export async function salvarAdicional(d){ ok(await sb().from("adicionais").upsert(d, { onConflict: "nome" })); }
export async function editarAdicional(id, patch){ ok(await sb().from("adicionais").update(patch).eq("id", id)); }

/* ---------- ViaCEP ---------- */
export async function buscarCep(cep){
  const d = String(cep || "").replace(/\D/g, "");
  if (d.length !== 8) return null;
  const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
  if (!r.ok) return null;
  const j = await r.json();
  if (j.erro) return null;
  return { logradouro: j.logradouro || "", bairro: j.bairro || "", cidade: j.localidade || "", uf: j.uf || "" };
}
