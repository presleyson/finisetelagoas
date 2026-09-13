/* Motor de deslocamento: rota real de ida e volta pela Google Routes API
   e a regra comercial de cobrança. Não sabe que existe uma tela. */
import { GOOGLE_MAPS_KEY } from "../config.js";

export const temMaps = () => !!(GOOGLE_MAPS_KEY && GOOGLE_MAPS_KEY.length > 20);

/** origem → destino → origem, em uma chamada. Devolve km ida, km total, duração e pedágio. */
export async function calcularRota(origem, destino, opcoes = {}){
  if (!temMaps()) throw new Error("Sem chave do Google Maps configurada.");
  if (!origem || !destino) throw new Error("Informe origem e destino.");
  const corpo = {
    origin: { address: origem }, destination: { address: origem }, intermediates: [{ address: destino }],
    travelMode: "DRIVE", routingPreference: "TRAFFIC_UNAWARE",
    languageCode: "pt-BR", units: "METRIC", regionCode: "BR"
  };
  if (opcoes.pedagio) { corpo.extraComputations = ["TOLLS"]; corpo.routeModifiers = { vehicleInfo: { emissionType: "GASOLINE" } }; }
  const mask = "routes.distanceMeters,routes.duration,routes.legs.distanceMeters" + (opcoes.pedagio ? ",routes.travelAdvisory.tollInfo" : "");
  const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": GOOGLE_MAPS_KEY, "X-Goog-FieldMask": mask },
    body: JSON.stringify(corpo)
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "O Google recusou a consulta.");
  const r = (j.routes || [])[0];
  if (!r) throw new Error("O Google não encontrou rota de carro até " + destino + ". Confira o endereço.");
  const seg = parseInt(String(r.duration || "0").replace("s", ""), 10) || 0;
  const hh = Math.floor(seg / 3600), mm = Math.round((seg % 3600) / 60);
  const pernas = (r.legs || []).map(l => Number(l.distanceMeters) || 0);
  let pedagio = null;
  const ti = r.travelAdvisory && r.travelAdvisory.tollInfo;
  if (ti) { const p = (ti.estimatedPrice || []).find(x => x.currencyCode === "BRL") || (ti.estimatedPrice || [])[0];
    pedagio = { detectado: true, valor: p ? Math.round((Number(p.units || 0) + Number(p.nanos || 0) / 1e9) * 100) / 100 : null }; }
  return {
    kmIda: pernas.length ? Math.round(pernas[0] / 100) / 10 : Math.round(r.distanceMeters / 200) / 10,
    kmTotal: Math.round(r.distanceMeters / 100) / 10,
    duracao: (hh ? hh + "h" : "") + (mm ? (hh ? " " : "") + mm + "min" : (hh ? "" : "menos de 1min")),
    segundos: seg, pedagio
  };
}

/** Aplica a regra comercial de deslocamento. regra: {tipo:'por_km'|'franquia'|'faixas', ...} */
export function cobrarDeslocamento(kmTotal, regra){
  const km = Number(kmTotal) || 0;
  if (!regra || !km) return { valor: 0, descricao: "sem cobrança" };
  if (regra.tipo === "franquia") {
    const excedente = Math.max(0, km - Number(regra.franquia_km || 0));
    return { valor: excedente * Number(regra.valor_km || 0), descricao: `até ${regra.franquia_km} km incluso; ${excedente.toLocaleString("pt-BR")} km × R$ ${Number(regra.valor_km).toFixed(2)}` };
  }
  if (regra.tipo === "faixas") {
    const f = (regra.faixas || []).find(x => km <= Number(x.ate)) || (regra.faixas || []).slice(-1)[0];
    return { valor: f ? Number(f.valor) : 0, descricao: f ? `faixa até ${f.ate} km` : "sem faixa" };
  }
  return { valor: km * Number(regra.valor_km || 0), descricao: `${km.toLocaleString("pt-BR")} km × R$ ${Number(regra.valor_km || 0).toFixed(2)}` };
}
