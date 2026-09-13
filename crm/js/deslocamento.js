/* Calculadora de custo de deslocamento (combustível + pedágio). Não grava nada no banco. */
import { S, rows } from "./state.js";
import { ativo } from "./etapas.js";
import { $, $$, esc, brl2, dataBR, select, toast } from "./ui.js";
import { calcularRota, temMaps } from "./motores/rota.js";
import { destinoRota } from "./lead.js";

const desl = { origem: "", destino: "", km: null, kmAuto: false, precoL: null, consumo: 9, pedagio: false, vPedagio: null,
               pedagioAuto: false, duracao: "", erro: "", calculando: false };
try { const m = JSON.parse(localStorage.getItem("crmfini.desl") || "{}"); if (m.precoL) desl.precoL = Number(m.precoL); if (m.consumo) desl.consumo = Number(m.consumo); } catch {}
const lembrar = () => { try { localStorage.setItem("crmfini.desl", JSON.stringify({ precoL: desl.precoL, consumo: desl.consumo })); } catch {} };

function conta(){
  const km = Number(desl.km), preco = Number(desl.precoL), cons = Number(desl.consumo);
  if (!(km > 0) || !(preco > 0) || !(cons > 0)) return null;
  const litros = km / cons, comb = litros * preco, ped = desl.pedagio ? (Number(desl.vPedagio) || 0) : 0;
  return { litros, comb, ped, total: comb + ped };
}
function resultado(r){
  if (!r) return `<div id="ds-saida"><div class="panel" style="margin:0"><div class="pad"><p class="eyebrow" style="margin:0 0 10px">Resultado</p><p style="margin:0;color:var(--ink-3);font-size:13.5px">Preencha a distância, o preço do litro e o consumo do veículo.</p></div></div></div>`;
  return `<div id="ds-saida"><div class="panel" style="margin:0"><div class="pad">
    <p class="eyebrow" style="margin:0 0 4px">Custo do deslocamento</p>
    <p class="memtotal">${brl2(r.total)}</p>
    <p style="margin:4px 0 18px;font-size:12.5px;color:var(--ink-3);font-family:var(--mono)">${(r.total / Number(desl.km)).toFixed(2).replace(".", ",")} por km rodado</p>
    <dl class="readout"><dt>Distância</dt><dd>${Number(desl.km).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} km (ida e volta)</dd>
      <dt>Combustível</dt><dd>${r.litros.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} L × ${brl2(desl.precoL)} = <b>${brl2(r.comb)}</b></dd>
      <dt>Pedágio</dt><dd>${desl.pedagio ? brl2(r.ped) : "sem pedágio"}</dd></dl></div>
    <div class="pad" style="border-top:1px solid var(--line);padding-top:14px"><p style="margin:0;font-size:12.5px;color:var(--ink-3)">Só combustível e pedágio. Não entra desgaste, estacionamento nem o tempo da equipe — a cobrança ao cliente segue a regra da tabela comercial.</p></div></div></div>`;
}

export function renderDeslocamento(){
  const host = $("#view-deslocamento");
  if (!desl.origem) desl.origem = (S.cfg && S.cfg.origem_endereco) || "";
  const r = conta();
  const abertos = rows().filter(ativo).sort((a, b) => String(a.data || "").localeCompare(String(b.data || "")));
  host.innerHTML = `
    <div class="bar"><div><p class="eyebrow">Deslocamento</p><h1 style="font-size:26px;margin:2px 0 0">Quanto custa levar o carrinho até lá</h1></div></div>
    <p class="lede" style="margin:-8px 0 22px">Custo real de ida e volta, para conferir a margem. Nada aqui é salvo no cadastro da festa.</p>
    <div class="dsgrid">
      <div class="paper">
        <div class="paper-sec"><header><h3>O trajeto</h3><span>ida e volta</span></header>
          <div class="field"><label for="ds-origem">Saindo de</label><input id="ds-origem" type="text" value="${esc(desl.origem)}"></div>
          <div class="field"><label for="ds-destino">Indo até</label><input id="ds-destino" type="text" placeholder="Endereço, bairro ou cidade da festa" value="${esc(desl.destino)}">
            ${abertos.length ? select("ds-lead", [["", "Ou puxe de um lead do pipeline…"], ...abertos.map(l => [l.id, `${l.responsavel || "—"} · ${l.cidade || ""} · ${dataBR(l.data)}`])], "", 'style="margin-top:7px"') : ""}</div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <button class="btn ghost sm" id="ds-calc"${desl.calculando ? " disabled" : ""}>${desl.calculando ? "Consultando o Maps…" : "Calcular pelo Google Maps"}</button>
            ${temMaps() ? "" : '<span class="hint" style="color:var(--ink-3);font-size:12.5px">Sem chave do Maps — digite a distância.</span>'}</div>
          ${desl.erro ? `<p class="err">${esc(desl.erro)}</p>` : ""}
          ${desl.duracao ? `<p style="margin:0;font-size:12.5px;color:var(--ink-3)">Tempo estimado: ${esc(desl.duracao)} (ida e volta).</p>` : ""}
        </div>
        <div class="paper-sec"><header><h3>Os números</h3><span>ajuste o que precisar</span></header>
          <div class="grid3">
            <div class="field"><label for="ds-km">Distância total (km)</label><input id="ds-km" type="number" min="0" step="0.1" value="${desl.km == null ? "" : desl.km}"><span class="hint">${desl.kmAuto ? "ida + volta, pelo Maps" : "ida + volta"}</span></div>
            <div class="field"><label for="ds-preco">Combustível (R$/litro)</label><input id="ds-preco" type="number" min="0" step="0.01" placeholder="6,19" value="${desl.precoL == null ? "" : desl.precoL}"></div>
            <div class="field"><label for="ds-consumo">Consumo (km/L)</label><input id="ds-consumo" type="number" min="0.1" step="0.1" value="${desl.consumo == null ? "" : desl.consumo}"><span class="hint">padrão: 9</span></div>
          </div>
          <label style="display:flex;gap:9px;align-items:flex-start;cursor:pointer;padding-top:4px">
            <input id="ds-tem-pedagio" type="checkbox" style="width:auto;margin-top:3px"${desl.pedagio ? " checked" : ""}>
            <span><b style="font-size:13.5px">Há pedágio no trajeto?</b><span style="display:block;font-size:12.5px;color:var(--ink-3)">${desl.pedagioAuto ? "O Maps encontrou pedágio nesta rota." : "Marque para informar o valor de ida e volta."}</span></span></label>
          ${desl.pedagio ? `<div class="field" style="max-width:280px"><label for="ds-pedagio">Valor do pedágio — ida e volta (R$)</label><input id="ds-pedagio" type="number" min="0" step="0.10" value="${desl.vPedagio == null ? "" : desl.vPedagio}">${desl.pedagioAuto ? '<span class="hint">estimativa do Google — confirme na praça</span>' : ""}</div>` : ""}
        </div>
      </div>
      <div>${resultado(r)}</div>
    </div>`;

  const liga = (id, campo, numero) => { const n = $("#" + id); if (!n) return;
    n.addEventListener("input", () => {
      desl[campo] = n.value === "" ? (numero ? null : "") : (numero ? Number(n.value) : n.value);
      if (campo === "km") desl.kmAuto = false; if (campo === "vPedagio") desl.pedagioAuto = false;
      if (campo === "precoL" || campo === "consumo") lembrar();
      $("#ds-saida").outerHTML = resultado(conta());
    }); };
  liga("ds-origem", "origem"); liga("ds-destino", "destino"); liga("ds-km", "km", true);
  liga("ds-preco", "precoL", true); liga("ds-consumo", "consumo", true); liga("ds-pedagio", "vPedagio", true);
  const sel = $("#ds-lead"); if (sel) sel.addEventListener("change", () => {
    const l = rows().find(x => x.id === sel.value); if (!l) return;
    desl.destino = destinoRota(l); desl.km = null; desl.kmAuto = false; desl.duracao = ""; desl.erro = ""; renderDeslocamento(); });
  $("#ds-tem-pedagio").addEventListener("change", e => { desl.pedagio = e.target.checked; if (!desl.pedagio) { desl.vPedagio = null; desl.pedagioAuto = false; } renderDeslocamento(); });
  $("#ds-calc").addEventListener("click", async () => {
    desl.erro = ""; desl.calculando = true; renderDeslocamento();
    try {
      const r = await calcularRota(desl.origem, desl.destino, { pedagio: true });
      desl.km = r.kmTotal; desl.kmAuto = true; desl.duracao = r.duracao;
      if (r.pedagio) { desl.pedagio = true; desl.pedagioAuto = true; if (r.pedagio.valor > 0) desl.vPedagio = r.pedagio.valor; }
    } catch (e) { desl.erro = String(e.message || e); }
    desl.calculando = false; renderDeslocamento();
  });
}
