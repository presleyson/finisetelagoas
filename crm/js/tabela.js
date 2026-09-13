/* Tabela comercial — preços, adicionais e regras. Só admin edita. */
import { S } from "./state.js";
import * as api from "./api.js";
import { $, $$, esc, brl2, toast, erroTexto } from "./ui.js";
import { go } from "./router.js";
import { recarregarComercial } from "./dados.js";
import { categoria } from "./motores/precificacao.js";

const ROTULOS = {
  origem_endereco: "Endereço de saída do carrinho", km_valor: "Valor por km rodado (R$)",
  horas_inclusas: "Horas inclusas no pacote", hora_extra: "Valor da hora extra (R$)",
  atendentes_inclusos: "Atendentes inclusos", atendente_extra_valor: "Valor do atendente extra (R$)",
  gramas_por_pessoa: "Gramas por pessoa (média)", kg_referencia: "Baleiro de referência p/ quilo avulso (kg)", gramas_saquinho: "Gramas por saquinho (média)",
  validade_dias: "Validade da proposta (dias)", desconto_avista: "Desconto à vista (%)", parcelas_cartao: "Parcelas no cartão",
  whatsapp: "WhatsApp na proposta", email: "E-mail na proposta", site: "Site na proposta", instagram: "Instagram na proposta"
};
const PADRAO = { atendentes_inclusos: 1, atendente_extra_valor: 0, kg_referencia: 18 };

export function renderTabela(){
  const host = $("#view-tabela");
  if (!S.comercialOk) { host.innerHTML = '<div class="empty" style="padding:70px">Carregando…</div>'; recarregarComercial(); return; }
  const cfg = { ...PADRAO, ...S.cfg };
  host.innerHTML = `
    <div class="bar"><div><p class="eyebrow">Tabela comercial</p><h1 style="font-size:26px;margin:2px 0 0">Preços e regras</h1></div><div class="grow"></div>
      <button class="iconbtn" data-go="propostas">Voltar às propostas</button></div>
    <p class="lede" style="margin:-8px 0 22px">Tudo que o sistema usa para calcular sai daqui. Mudou preço, muda em um lugar só e vale para as propostas novas — as já geradas ficam com os valores da época.</p>
    <div class="panel"><header><h3>Baleiros</h3><p>preço fechado por tamanho; quantidades fora da tabela usam o R$/kg do baleiro de referência (acima dele) ou do maior que couber (abaixo)</p></header><div class="pad"><div class="tablewrap">
      <table class="data"><thead><tr><th>Categoria</th><th>Baleiro</th><th>Valor</th><th>Por kg</th></tr></thead><tbody>${
      S.pacotes.map(p => `<tr><td>${esc(categoria(p.categoria).nome)}</td><td class="n">${Number(p.kg)} kg</td>
        <td class="n"><input class="inline" type="number" step="0.01" min="0" data-pac-val="${esc(p.id)}" value="${Number(p.valor_total)}"></td>
        <td class="n" style="color:var(--ink-3)">${brl2(Number(p.valor_total) / Number(p.kg))}</td></tr>`).join("")}</tbody></table></div></div></div>
    <div class="panel"><header><h3>Produtos adicionais</h3><p>vendidos em lotes com quantidade mínima</p></header><div class="pad"><div class="tablewrap">
      <table class="data"><thead><tr><th>Item</th><th>Qtd mínima</th><th>Valor unitário</th><th>Lote</th><th></th></tr></thead><tbody>${
      S.adicionais.map(a => `<tr><td>${esc(a.nome)}</td>
        <td class="n"><input class="inline" type="number" min="1" step="1" data-ad-min="${esc(a.id)}" value="${a.qtd_minima}"></td>
        <td class="n"><input class="inline" type="number" min="0" step="0.01" data-ad-val="${esc(a.id)}" value="${Number(a.valor_unit)}"></td>
        <td class="n" style="color:var(--ink-3)">${brl2(a.qtd_minima * Number(a.valor_unit))}</td>
        <td><button class="linkbtn" data-ad-del="${esc(a.id)}">remover</button></td></tr>`).join("")}</tbody></table></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:flex-end;margin-top:14px">
        <div class="field" style="max-width:200px"><label for="ad-nome">Novo item</label><input id="ad-nome" type="text" placeholder="Copos, Jogos, Fini Zero…"></div>
        <div class="field" style="max-width:110px"><label for="ad-min">Qtd mínima</label><input id="ad-min" type="number" min="1" value="1"></div>
        <div class="field" style="max-width:130px"><label for="ad-val">Valor unitário</label><input id="ad-val" type="number" min="0" step="0.01"></div>
        <button class="btn sm" id="ad-add">Adicionar</button></div></div></div>
    <div class="panel"><header><h3>Regras e dados fixos</h3><p>deslocamento, horas, atendentes, validade e contatos</p></header><div class="pad">
      <div class="grid2">${Object.keys(ROTULOS).filter(k => k in cfg).map(k => { const v = cfg[k];
        return `<div class="field"><label for="cf-${k}">${ROTULOS[k]}</label><input id="cf-${k}" type="${typeof v === "number" ? "number" : "text"}" step="0.01" data-cfg="${k}" data-num="${typeof v === "number"}" value="${esc(v)}"></div>`; }).join("")}</div>
      <div class="field" style="margin-top:12px"><label for="cf-inclusos">Itens inclusos no pacote (um por linha)</label><textarea id="cf-inclusos" style="min-height:100px">${esc((cfg.inclusos || []).join("\n"))}</textarea></div>
      <button class="btn sm" id="cf-save" style="margin-top:12px">Salvar regras</button></div></div>`;

  $$("[data-go]", host).forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
  const grava = async (fn) => { try { await fn(); toast("Salvo."); await recarregarComercial(); } catch (e) { toast(erroTexto(e)); } };
  $$("[data-pac-val]", host).forEach(i => i.addEventListener("change", () => grava(() => api.salvarPacote(i.dataset.pacVal, { valor_total: Number(i.value) }))));
  $$("[data-ad-min]", host).forEach(i => i.addEventListener("change", () => grava(() => api.editarAdicional(i.dataset.adMin, { qtd_minima: Number(i.value) }))));
  $$("[data-ad-val]", host).forEach(i => i.addEventListener("change", () => grava(() => api.editarAdicional(i.dataset.adVal, { valor_unit: Number(i.value) }))));
  $$("[data-ad-del]", host).forEach(b => b.addEventListener("click", () => { if (confirm("Remover este item da tabela? Propostas já geradas não mudam.")) grava(() => api.editarAdicional(b.dataset.adDel, { ativo: false })); }));
  $("#ad-add").addEventListener("click", () => {
    const nome = $("#ad-nome").value.trim(), min = Number($("#ad-min").value) || 1, val = Number($("#ad-val").value);
    if (!nome || !(val > 0)) { toast("Informe o nome e o valor unitário."); return; }
    grava(() => api.salvarAdicional({ nome, qtd_minima: min, valor_unit: val, ativo: true })); });
  $("#cf-save").addEventListener("click", () => {
    const subs = [];
    $$("[data-cfg]", host).forEach(i => { const num = i.dataset.num === "true"; const v = num ? Number(i.value) : i.value; if (num && isNaN(v)) return; subs.push({ chave: i.dataset.cfg, valor: v }); });
    subs.push({ chave: "inclusos", valor: $("#cf-inclusos").value.split("\n").map(s => s.trim()).filter(Boolean) });
    grava(() => api.salvarConfig(subs)); });
}
