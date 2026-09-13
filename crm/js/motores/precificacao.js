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

/** Quilos que a proposta apresenta: o cálculo arredondado para cima, nunca abaixo do menor baleiro. */
export function kgProposta(convidados, cfg, pacotes){
  const nec = kgNecessarios(convidados, cfg);
  const menor = pacotes.length ? Math.min(...pacotes.map(p => Number(p.kg))) : 0;
  return Math.max(Math.ceil(nec), menor);
}

/**
 * Valor das balas para uma quantidade qualquer (modo tabela):
 *  - quantidade igual a um baleiro cadastrado → preço fechado dele;
 *  - acima do baleiro de referência (cfg.kg_referencia, padrão 18) → R$/kg do baleiro de referência × kg;
 *  - abaixo → R$/kg do maior baleiro que cabe na quantidade (ou do menor, se for menor que todos).
 */
export function valorBalas(pacotes, cat, kg, cfg){
  const lista = pacotes.filter(p => p.categoria === cat).sort((a, b) => Number(a.kg) - Number(b.kg));
  if (!lista.length || !(kg > 0)) return { valor: 0, base: null, porKg: 0, exato: false };
  const exato = lista.find(p => Number(p.kg) === Number(kg));
  if (exato) return { valor: Number(exato.valor_total), base: exato, porKg: Number(exato.valor_total) / Number(exato.kg), exato: true };
  const refKg = n(cfg.kg_referencia, 18);
  const ref = lista.find(p => Number(p.kg) === refKg) || lista[lista.length - 1];
  const base = kg > Number(ref.kg) ? ref : (lista.slice().reverse().find(p => Number(p.kg) <= kg) || lista[0]);
  const porKg = Number(base.valor_total) / Number(base.kg);
  return { valor: Math.round(kg * porKg * 100) / 100, base, porKg, exato: false };
}

/**
 * Calcula uma proposta no modo tabela: uma quantidade em kg e as três modalidades lado a lado.
 * entrada: { convidados, kg (opcional — sobrepõe o cálculo), categoria (destaque), adic {id: qtd}, horas, atendentes, km, desconto }
 * tabela:  { cfg, pacotes, adicionais }
 * Deslocamento, horas e atendentes extras entram em todas as modalidades, como no modelo oficial.
 */
export function precificar(entrada, tabela){
  const { cfg, pacotes, adicionais } = tabela;
  const kgNec = kgNecessarios(entrada.convidados, cfg);
  const kg = (entrada.kg && entrada.kg > 0) ? Number(entrada.kg) : kgProposta(entrada.convidados, cfg, pacotes);

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
  const pct = n(cfg.desconto_avista, 0), par = n(cfg.parcelas_cartao, 4);
  const comum = vAdic + vHoras + vAtend + vDesl - desc;

  const opcoes = CATEGORIAS.map(c => {
    const b = valorBalas(pacotes, c.id, kg, cfg);
    const total = Math.max(0, b.valor + comum);
    return { categoria: c.id, nome: c.nome, balas: b.valor, porKg: b.porKg, base: b.base ? Number(b.base.kg) : null, exato: b.exato,
             total, parcela: par > 0 ? total / par : total, avista: total * (1 - pct / 100) };
  });
  const sel = opcoes.find(o => o.categoria === entrada.categoria) || opcoes[1] || opcoes[0];

  return { kgNec, kg, opcoes, balas: sel.balas, porKg: sel.porKg, adic, vAdic, horas, inclusas, extras, vHoras,
           atendentes, atInclusos, atExtras, vAtend, km, vKm, vDesl, desc, total: sel.total,
           avista: sel.avista, pctAvista: pct, parcelas: par, parcela: sel.parcela, itens: sel.base ? [{ kg, valor_total: sel.balas }] : [] };
}
