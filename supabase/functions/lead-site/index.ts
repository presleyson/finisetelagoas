// Edge Function: lead-site
// Recebe o POST do formulário público do site (infinitas.kids) e grava na tabela `leads`.
// É pública (sem JWT): a validação é feita aqui e a escrita usa a service role.
// A notificação por e-mail continua a cargo da função `notificar-lead`,
// disparada pelo banco quando a notificação entra como "pendente".
//
// Segredos/variáveis: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
//                     SITE_ORIGINS (opcional, lista separada por vírgula).
import { createClient } from "npm:@supabase/supabase-js@2";

const ORIGENS_PADRAO = [
  "https://infinitas.kids",
  "https://www.infinitas.kids",
];

const origensPermitidas = (Deno.env.get("SITE_ORIGINS") ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

const LISTA_ORIGENS = origensPermitidas.length ? origensPermitidas : ORIGENS_PADRAO;

function cors(req: Request): Record<string, string> {
  const origem = req.headers.get("origin") ?? "";
  const liberada = LISTA_ORIGENS.includes(origem) ? origem : LISTA_ORIGENS[0];
  return {
    "Access-Control-Allow-Origin": liberada,
    "Access-Control-Allow-Headers": "content-type, apikey, authorization",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}

const responder = (req: Request, corpo: unknown, status = 200) =>
  new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cors(req), "Content-Type": "application/json; charset=utf-8" },
  });

// --- normalização de campos -------------------------------------------------

const txt = (v: unknown, max = 300): string | null => {
  const s = String(v ?? "").trim().replace(/\s+/g, " ");
  return s ? s.slice(0, max) : null;
};

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || String(v).trim() === "") return null;
  const n = Number(String(v).replace(/\D/g, ""));
  return Number.isFinite(n) ? n : null;
};

// aceita "2026-10-31" ou "31/10/2026"
const dataISO = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return br ? `${br[3]}-${br[2]}-${br[1]}` : null;
};

const hora = (v: unknown): string | null => {
  const s = String(v ?? "").trim();
  return /^\d{2}:\d{2}(:\d{2})?$/.test(s) ? s.slice(0, 5) : null;
};

const telefoneOk = (v: string | null) => !!v && v.replace(/\D/g, "").length >= 10;
const emailOk = (v: string | null) => !!v && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

// o site pode mandar as chaves em pt-BR (iguais às do CRM) ou os nomes genéricos
// do formulário (name/phone/message); as duas formas são aceitas.
function montarLead(b: Record<string, unknown>) {
  const cep = txt(b.cep, 12);
  return {
    responsavel: txt(b.responsavel ?? b.nome ?? b.name, 120),
    telefone: txt(b.telefone ?? b.phone ?? b.whatsapp, 30),
    email: txt(b.email, 160),
    evento: txt(b.evento ?? b.tipo_evento ?? b.event, 120),
    criancas: num(b.criancas ?? b.children),
    adultos: num(b.adultos ?? b.adults),
    nome_local: txt(b.nome_local ?? b.local, 160),
    cep: cep ? cep.replace(/\D/g, "").slice(0, 8) || null : null,
    logradouro: txt(b.logradouro, 160),
    numero: txt(b.numero, 20),
    complemento: txt(b.complemento, 80),
    bairro: txt(b.bairro, 120),
    cidade: txt(b.cidade ?? b.city, 120),
    uf: (txt(b.uf, 2) ?? "MG").toUpperCase(),
    local_festa: txt(b.local_festa ?? b.nome_local ?? b.local, 160),
    data: dataISO(b.data ?? b.data_evento ?? b.date),
    horario: hora(b.horario ?? b.hora),
    obs: txt(b.obs ?? b.mensagem ?? b.message, 2000),
    origem: "site",
  };
}

// --- handler ----------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (req.method !== "POST") return responder(req, { ok: false, erro: "método não permitido" }, 405);

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return responder(req, { ok: false, erro: "JSON inválido" }, 400);
  }

  // honeypot: bot preencheu o campo escondido -> responde ok e descarta
  if (txt(body.hp) || txt(body._gotcha)) return responder(req, { ok: true });

  const lead = montarLead(body);

  if (!lead.responsavel) return responder(req, { ok: false, erro: "informe o nome do responsável" }, 400);
  if (!telefoneOk(lead.telefone) && !emailOk(lead.email)) {
    return responder(req, { ok: false, erro: "informe um telefone ou e-mail válido" }, 400);
  }
  if (lead.email && !emailOk(lead.email)) {
    return responder(req, { ok: false, erro: "e-mail inválido" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL");
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chave) return responder(req, { ok: false, erro: "função mal configurada" }, 500);

  const sb = createClient(url, chave);
  const { data, error } = await sb.from("leads").insert(lead).select("id").single();

  if (error) {
    console.error("falha ao gravar lead do site:", error.message);
    return responder(req, { ok: false, erro: "não foi possível registrar o contato agora" }, 500);
  }

  return responder(req, { ok: true, id: data.id }, 201);
});
