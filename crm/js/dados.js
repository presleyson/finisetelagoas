/* Carga e recarga dos dados compartilhados. Separado do app.js para as telas
   não importarem o shell (evita ciclo e dupla avaliação do módulo). */
import { S } from "./state.js";
import * as api from "./api.js";
import { toast, erroTexto } from "./ui.js";

let repintar = () => {};
/** O app registra aqui a função que redesenha a tela atual. */
export function aoRecarregar(fn){ repintar = fn; }

export async function recarregarLeads(){
  if (!S.authed) return;
  try { S.leads = await api.listarLeads(); S.carregando = false; }
  catch (e) { toast(erroTexto(e)); return; }
  if (["inicio","pipeline","lead","propostas","relatorios","deslocamento"].includes(S.rota.nome)) repintar();
}
export async function recarregarComercial(){
  if (!S.authed) return;
  try {
    const c = await api.carregarComercial();
    Object.assign(S, c); S.comercialOk = true;
    if (["propostas","tabela","lead","pipeline","inicio"].includes(S.rota.nome)) repintar();
  } catch { S.comercialOk = false; }
}
export async function carregarApoio(){
  try { S.usuarios = await api.listarUsuarios(); } catch {}
  try { S.motivos  = await api.listarMotivos(); } catch {}
}
