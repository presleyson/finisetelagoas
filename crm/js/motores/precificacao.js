/* Motor de precificação. Funções puras: entram dados e a tabela comercial,
   sai a memória de cálculo. Nenhum valor comercial vive aqui. */

/* As três categorias existem sempre, nesta ordem; nome, descrição, rótulo e
   preço por quilo vêm da tabela `categorias` (editável pelo admin). */
export const IDS_CATEGORIAS = ["nacional", "misto", "importado"];
const PADRAO = {
  nacional:  { nome: "Balas Nacionais",              descricao: "", rotulo_pdf: "NACIONAL",             valor_kg: 0, ordem: 10 },
  misto:     { nome: "Balas Nacionais e Importadas", descricao: "", rotulo_pdf: "NACIONAL E IMPORTADO", valor_kg: 0, ordem: 20 },
  importado: { nome: "Somente Balas Importadas",     descricao: "", rotulo_pdf: "IMPORTADO",            valor_kg: 0, ordem: 30 }
};
/** Lista das três categorias, completando o que faltar no banco. */
export function categorias(lista){
  return IDS_CATEGORIAS.map(id => ({ id, ...PADRAO[id], ...((lista || []).find(c => c.id === id) || {}) }))
    .sort((a, b) => Number(a.ordem) - Number(b.ordem));
}
export const categoria = (lista, id) => categorias(lista).find(c => c.id === id) || { id, ...PADRAO[id] };

const n = (v, pad) => (v == null || v === "" || isNaN(Number(v))) ? pad : Number(v);

/** Quilos necessários: convidados × gramas por pessoa. */
export function kgNecessarios(convidados, cfg){
  const g = n(cfg.gramas_por_pessoa, n(cfg.gramas_saquinho, 150));
  if (!convidados || convidados <= 0) return 0;
  return Math.round((convidados * g / 1000) * 10) / 10;
}

/** Quilos que a proposta apresenta: o cálculo arredondado para cima, nunca abaixo do mínimo da tabela. */
export function kgProposta(convidados, cfg){
  return Math.max(Math.ceil(kgNecessarios(convidados, cfg)), n(cfg.kg_minimo, 0));
}

/** Valor das balas de uma categoria: quilos × preço por quilo. */
export function valorBalas(lista, id, kg){
  const c = categoria(lista, id); const porKg = n(c.valor_kg, 0);
  return { valor: Math.round(kg * porKg * 100) / 100, porKg };
}

/**
 * Calcula uma proposta: uma quantidade em kg e as três categorias lado a lado.
 * entrada: { convidados, kg (opcional — sobrepõe o cálculo), categoria (destaque), adic {id: qtd}, horas, atendentes, km, desconto }
 * tabela:  { cfg, categorias, adicionais }
 * Deslocamento, horas e atendentes extras, adicionais e desconto entram em todas as categorias, como no modelo oficial.
 */
export function precificar(entrada, tabela){
  const { cfg, adicionais } = tabela; const lista = categorias(tabela.categorias);
  const kgNec = kgNecessarios(entrada.convidados, cfg);
  const kg = (entrada.kg && entrada.kg > 0) ? Number(entrada.kg) : kgProposta(entrada.convidados, cfg);

  const adic = Object.entries(entrada.adic || {}).map(([id, qtd]) => {
    const a = adicionais.find(x => x.id === id); const q = Number(qtd) || 0;
    return (a && q > 0) ? { id: a.id, nome: a.nome, qtd: q, unit: Number(a.valor_unit), total: q * Number(a.valor_unit) } : null;
  }).filter(Boolean);
  const vAdic = adic.reduce((s, i) => s + i.total, 0);

  const inclusas = n(cfg.horas_inclusas, 4), horas = n(entrada.horas, inclusas);
  const extras = Math.max(0, horas - inclusas), vHoras = extras * n(cfg.hora_extra, 0);
  const atInclusos = n(cfg.atendentes_inclusos, 1), atendentes = n(entrada.atendentes, atInclusos);
  const atExtras = Math.max(0, atendentes - atInclusos), vAtend = atExtras * n(cfg.atendente_extra_valor, 0);
  const vKm = n(cfg.km_valor, 0), km = n(entrada.km, 0), vDesl = Math.round(km * vKm * 100) / 100;
  const desc = n(entrada.desconto, 0);
  const pct = n(cfg.desconto_avista, 0), par = n(cfg.parcelas_cartao, 4);
  const comum = vAdic + vHoras + vAtend + vDesl - desc;

  const opcoes = lista.map(c => {
    const b = valorBalas(lista, c.id, kg);
    const total = Math.max(0, Math.round((b.valor + comum) * 100) / 100);
    return { categoria: c.id, nome: c.nome, descricao: c.descricao || "", rotulo_pdf: c.rotulo_pdf, balas: b.valor, porKg: b.porKg,
             total, parcela: par > 0 ? total / par : total, avista: total * (1 - pct / 100) };
  });
  const sel = opcoes.find(o => o.categoria === entrada.categoria) || opcoes[1] || opcoes[0];

  return { kgNec, kg, kgMin: n(cfg.kg_minimo, 0), opcoes, balas: sel.balas, porKg: sel.porKg, adic, vAdic, horas, inclusas, extras, vHoras,
           atendentes, atInclusos, atExtras, vAtend, km, vKm, vDesl, desc, total: sel.total,
           avista: sel.avista, pctAvista: pct, parcelas: par, parcela: sel.parcela };
}
