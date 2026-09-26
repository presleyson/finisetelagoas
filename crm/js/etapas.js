/* O funil comercial. A ordem aqui é a ordem das colunas. */
export const ETAPAS = [
  { id:"novo_lead",           nome:"Novo Lead",              curto:"Novo",        cor:"var(--st-novo)",       grupo:"andamento" },
  { id:"proposta_preparacao", nome:"Proposta em Preparação", curto:"Preparando",  cor:"var(--st-orcamento)",  grupo:"andamento" },
  { id:"em_negociacao",       nome:"Em Negociação",          curto:"Negociando",  cor:"var(--st-negociacao)", grupo:"andamento" },
  { id:"aguardando_cliente",  nome:"Aguardando Cliente",     curto:"Aguardando",  cor:"var(--st-negociacao)", grupo:"andamento" },
  { id:"venda_fechada",       nome:"Venda Fechada",          curto:"Fechada",     cor:"var(--st-ganho)",      grupo:"ganho" },
  { id:"venda_perdida",       nome:"Venda Perdida",          curto:"Perdida",     cor:"var(--st-perdido)",    grupo:"perdido" }
];
/* etapas antigas (v1 e as quatro retiradas em 13/09) caem na equivalente atual */
const LEGADO = { novo:"novo_lead", orcamento:"em_negociacao", negociacao:"em_negociacao",
                 ganho:"venda_fechada", pedido:"venda_fechada", perdido:"venda_perdida",
                 primeiro_contato:"novo_lead", qualificacao:"novo_lead",
                 proposta_enviada:"em_negociacao", evento_realizado:"venda_fechada" };
export const normaliza = (e) => LEGADO[e] || e || "novo_lead";
export const etapa  = (id) => ETAPAS.find(e => e.id === normaliza(id)) || ETAPAS[0];
export const classe = (l) => etapa(l.etapa).grupo;          // andamento | ganho | perdido
export const ativo  = (l) => normaliza(l.etapa) !== "venda_perdida";

export const TIPOS_INTERACAO = [
  { id:"whatsapp",         nome:"WhatsApp",           icone:"💬" },
  { id:"ligacao",          nome:"Ligação",            icone:"📞" },
  { id:"email",            nome:"E-mail",             icone:"✉️" },
  { id:"reuniao",          nome:"Reunião",            icone:"🗓️" },
  { id:"presencial",       nome:"Contato presencial", icone:"🤝" },
  { id:"instagram",        nome:"Instagram",          icone:"📸" },
  { id:"formulario",       nome:"Formulário do site", icone:"📝" },
  { id:"observacao",       nome:"Observação interna", icone:"📌" },
  { id:"proposta_enviada", nome:"Proposta enviada",   icone:"📄" },
  { id:"negociacao",       nome:"Negociação",         icone:"⚖️" },
  { id:"follow_up",        nome:"Follow-up",          icone:"🔁" },
  { id:"mudanca_etapa",    nome:"Mudança de etapa",   icone:"➡️" }
];
export const tipoInteracao = (id) => TIPOS_INTERACAO.find(t => t.id === id) || { id, nome:id, icone:"•" };

export const ORIGENS = [
  ["site","Formulário do site"],["whatsapp","WhatsApp"],["instagram","Instagram"],
  ["indicacao","Indicação"],["presencial","Presencial"],["outro","Outro"]
];

/** Ordem cronológica pela data do evento: o mais próximo primeiro; sem data vai para o fim.
 *  Empate: quem entrou por último primeiro. Usado em toda lista de oportunidades. */
export function porDataEvento(a, b){
  const da = String(a.data || ""), db = String(b.data || "");
  if (da && db && da !== db) return da < db ? -1 : 1;
  if (da && !db) return -1;
  if (!da && db) return 1;
  return String(b.criado_em || "").localeCompare(String(a.criado_em || ""));
}
export const ordenarPorEvento = (lista) => lista.slice().sort(porDataEvento);
