/* Motor de precificação. Funções puras: entram dados e a tabela comercial,
   sai a memória de cálculo. Nenhum valor comercial vive aqui. */

export const CATEGORIAS = [
  { id: "nacional",  nome: "Balas nacionais",            sub: "Fini produzida no Brasil — Minhoca, Ursinho, Beijo, Tubes, Marsh" },
  { id: "misto",     nome: "Mix nacionais e importadas", sub: "O mais pedido: o melhor das duas fábricas na mesma mesa" },
  { id: "importado", nome: "Somente importadas",         sub: "Fini produzida na Espanha, exclusiva do Quiosque Fini" }
];
export const categoria = (id) => CATEGORIAS.find(c => c.id === id) || { id, nome: id, sub: "" };

const n = (v, pad) => (v == null || v === "" || isNaN(Number(v))) ? pad : Number(v);

/** Quilos necessários pela regra da apresentação: convidados × gramas por saquinho. */
export function kgNecessarios(convidados, cfg){
  const g = n(cfg.gramas_por_pessoa, n(cfg.gramas_saquinho, 180));
  if (!convidados || convidados <= 0) return 0;
  return Math.round((convidados * g / 1000) * 10) / 10;
}

/** Combinação de baleiros de menor custo que cobre os quilos (modo pacote). */
export function sugerirPacotes(pacotes, cat, kgNec){
  const lista = pacotes.filter(p => p.categoria === cat).sort((a, b) => Number(a.kg) - Number(b.kg));
  if (!lista.length) return [];
  if (kgNec <= 0) return [lista[0]];
  let melhor = null; const MAX = 6;
  (function rec(inicio, atual, kg, val){
    if (kg >= kgNec) { if (!melhor || val < melhor.val || (val === melhor.val && kg < melhor.kg)) melhor = { itens: atual.slice(), kg, val }; return; }
    if (atual.length >= MAX) return;
    for (let i = inicio; i < lista.length; i++) { atual.push(lista[i]); rec(i, atual, kg + Number(lista[i].kg), val + Number(lista[i].valor_total)); atual.pop(); }
  })(0, [], 0, 0);
  return melhor ? melhor.itens : [lista[lista.length - 1]];
}

/**
 * Calcula uma proposta.
 * entrada: { convidados, categoria, itens (pacotes escolhidos, opcional), adic {id: qtd}, horas, atendentes, km, desconto }
 * tabela:  { cfg, pacotes, adicionais }
 */
export function precificar(entrada, tabela){
  const { cfg, pacotes, adicionais } = tabela;
  const kgNec = kgNecessarios(entrada.convidados, cfg);
  const itens = (entrada.itens && entrada.itens.length) ? entrada.itens : sugerirPacotes(pacotes, entrada.categoria, kgNec);
  const kg    = itens.reduce((s, p) => s + Number(p.kg), 0);
  const balas = itens.reduce((s, p) => s + Number(p.valor_total), 0);

  const adic = Object.entries(entrada.adic || {}).map(([id, qtd]) => {
    const a = adicionais.find(x => x.id === id); const q = Number(qtd) || 0;
    return (a && q > 0) ? { id: a.id, nome: a.nome, qtd: q, unit: Number(a.valor_unit), total: q * Number(a.valor_unit) } : null;
  }).filter(Boolean);
  const vAdic = adic.reduce((s, i) => s + i.total, 0);

  const inclusas = n(cfg.horas_inclusas, 4), horas = n(entrada.horas, inclusas);
  const extras = Math.max(0, horas - inclusas), vHoras = extras * n(cfg.hora_extra, 0);

  const atInclusos = n(cfg.atendentes_inclusos, 1), atendentes = n(entrada.atendentes, atInclusos);
  const atExtras = Math.max(0, atendentes - atInclusos), vAtend = atExtras * n(cfg.atendente_extra_valor, 0);

  const vKm = n(cfg.km_valor, 0), km = n(entrada.km, 0), vDesl = km * vKm;
  const desc = n(entrada.desconto, 0);
  const total = Math.max(0, balas + vAdic + vHoras + vAtend + vDesl - desc);
  const pct = n(cfg.desconto_avista, 0), par = n(cfg.parcelas_cartao, 4);

  return { kgNec, itens, kg, balas, adic, vAdic, horas, inclusas, extras, vHoras,
           atendentes, atInclusos, atExtras, vAtend, km, vKm, vDesl, desc, total,
           avista: total * (1 - pct / 100), pctAvista: pct, parcelas: par, parcela: par > 0 ? total / par : total };
}
