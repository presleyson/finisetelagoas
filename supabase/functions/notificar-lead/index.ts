// Edge Function: notificar-lead
// Chamada pelo banco (pg_net) quando uma notificação entra como "pendente".
// Lê a notificação e o lead, monta o e-mail, envia pelo Resend e grava o status.
// Segredos: CRM_WEBHOOK_SECRET (igual ao app_segredos.webhook_secret), RESEND_API_KEY.
import { createClient } from "npm:@supabase/supabase-js@2";

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m] as string));
const dataBR = (s?: string | null) => { if (!s) return ""; const p = String(s).slice(0, 10).split("-"); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(s); };
const horaBR = (s?: string | null) => s ? new Date(s).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
const ORIGENS: Record<string, string> = { site: "Formulário do site", whatsapp: "WhatsApp", instagram: "Instagram", indicacao: "Indicação", presencial: "Presencial", outro: "Outro" };

function montarHtml(l: Record<string, any>, recebido: string) {
  const end = [[l.logradouro, l.numero].filter(Boolean).join(", "), l.complemento, l.bairro].filter(Boolean).join(" · ");
  const cidade = [l.cidade, l.uf].filter(Boolean).join("/");
  const convidados = (Number(l.criancas) || 0) + (Number(l.adultos) || 0);
  const linhas: [string, string][] = [
    ["Nome do cliente", l.responsavel],
    ["Telefone / WhatsApp", l.telefone],
    ["E-mail", l.email],
    ["Evento", l.evento],
    ["Data do evento", dataBR(l.data) + (l.horario ? ` às ${l.horario}` : "")],
    ["Local do evento", l.nome_local || (!end ? l.local_festa : "")],
    ["Endereço", end],
    ["Cidade", cidade],
    ["CEP", l.cep],
    ["Convidados", convidados ? `${convidados} pessoas (${Number(l.criancas) || 0} crianças/adolescentes, ${Number(l.adultos) || 0} adultos)` : ""],
    ["Origem do lead", ORIGENS[l.origem] || l.origem],
    ["Observações", l.obs],
    ["Recebido em", recebido],
  ].filter(([, v]) => v && String(v).trim() !== "") as [string, string][];

  const tr = linhas.map(([k, v]) =>
    `<tr><td style="padding:9px 14px;border-bottom:1px solid #F3E6EA;color:#8B7982;font-size:12px;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;vertical-align:top">${esc(k)}</td>
     <td style="padding:9px 14px;border-bottom:1px solid #F3E6EA;color:#23181D;font-size:15px;vertical-align:top">${esc(v).replace(/\n/g, "<br>")}</td></tr>`).join("");
  const link = `https://infinitas.kids/crm/#/lead/${l.id}`;
  const wa = l.telefone ? `https://wa.me/${(String(l.telefone).replace(/\D/g, "").length <= 11 ? "55" : "") + String(l.telefone).replace(/\D/g, "")}` : "";
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#FAF7F8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="max-width:620px;margin:0 auto;padding:24px 16px">
    <div style="background:#CD2033;border-radius:14px 14px 0 0;padding:22px 24px;color:#fff">
      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;opacity:.85">Carrinho da Fini · CRM</div>
      <div style="font-size:22px;font-weight:700;margin-top:4px">Novo lead: ${esc(l.responsavel || "sem nome")}</div>
      <div style="font-size:14px;opacity:.9;margin-top:4px">${esc(l.evento || "")}${l.data ? " · " + dataBR(l.data) : ""}${cidade ? " · " + esc(cidade) : ""}</div>
    </div>
    <div style="background:#fff;border:1px solid #E7DCE0;border-top:0;border-radius:0 0 14px 14px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">${tr}</table>
      <div style="padding:18px 14px 20px;display:flex;gap:10px;flex-wrap:wrap">
        <a href="${link}" style="display:inline-block;background:#CD2033;color:#fff;text-decoration:none;font-weight:600;padding:11px 18px;border-radius:999px;font-size:14px">Abrir no CRM</a>
        ${wa ? `<a href="${wa}" style="display:inline-block;background:#fff;color:#CD2033;border:1px solid #CD2033;text-decoration:none;font-weight:600;padding:10px 18px;border-radius:999px;font-size:14px;margin-left:8px">Chamar no WhatsApp</a>` : ""}
      </div>
    </div>
    <p style="color:#8B7982;font-size:12px;text-align:center;margin:16px 0 0">Aviso automático do CRM da Infinitas · Fini Sete Lagoas. Este e-mail é só informativo.</p>
  </div></body></html>`;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("método não permitido", { status: 405 });
  const segredo = Deno.env.get("CRM_WEBHOOK_SECRET");
  if (!segredo || req.headers.get("x-crm-secret") !== segredo) return new Response("não autorizado", { status: 401 });

  let corpo: { notificacao_id?: string } = {};
  try { corpo = await req.json(); } catch { /* vazio */ }
  if (!corpo.notificacao_id) return new Response("notificacao_id obrigatório", { status: 400 });

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: n, error: eN } = await sb.from("notificacoes").select("*").eq("id", corpo.notificacao_id).single();
  if (eN || !n) return new Response("notificação não encontrada", { status: 404 });
  if (n.status !== "pendente") return Response.json({ ok: true, ignorado: n.status });   // idempotente: já tratada

  const gravar = async (patch: Record<string, unknown>) =>
    sb.from("notificacoes").update({ ...patch, tentativas: (n.tentativas || 0) + 1 }).eq("id", n.id);

  const { data: l } = await sb.from("leads").select("*").eq("id", n.lead_id).single();
  if (!l) { await gravar({ status: "erro", resposta: "lead não encontrado (apagado?)" }); return Response.json({ ok: false }); }

  const { data: cfg } = await sb.from("config_comercial").select("chave,valor").in("chave", ["email_remetente", "email_notificacao"]);
  const conf: Record<string, string> = {}; (cfg || []).forEach((c: any) => { conf[c.chave] = typeof c.valor === "string" ? c.valor : JSON.stringify(c.valor); });
  const para = n.destinatario || conf.email_notificacao;
  const de = conf.email_remetente || "Carrinho da Fini <onboarding@resend.dev>";
  const chave = Deno.env.get("RESEND_API_KEY");
  if (!chave) { await gravar({ status: "erro", resposta: "RESEND_API_KEY não configurada nos segredos da Edge Function" }); return Response.json({ ok: false, erro: "sem chave" }); }
  if (!para) { await gravar({ status: "erro", resposta: "destinatário vazio (config email_notificacao)" }); return Response.json({ ok: false }); }

  const assunto = n.assunto || `Novo Lead | Carrinho da Fini | ${l.responsavel || "sem nome"}`;
  const html = montarHtml(l, horaBR(l.criado_em));
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: de, to: [para], subject: assunto, html, reply_to: l.email || undefined }),
    });
    const texto = await r.text();
    if (!r.ok) { await gravar({ status: "erro", resposta: `Resend ${r.status}: ${texto.slice(0, 900)}` }); return Response.json({ ok: false, status: r.status }); }
    let id = ""; try { id = JSON.parse(texto).id || ""; } catch { /* ignora */ }
    await gravar({ status: "enviado", enviado_em: new Date().toISOString(), provedor_id: id, resposta: `Resend ${r.status}` });
    return Response.json({ ok: true, id });
  } catch (e) {
    await gravar({ status: "erro", resposta: `falha de rede: ${String((e as Error).message || e).slice(0, 900)}` });
    return Response.json({ ok: false });
  }
});
