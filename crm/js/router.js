/* Rotas por hash: #/pipeline, #/lead/<id>, #/propostas ... */
export function go(caminho){ location.hash = "#/" + String(caminho).replace(/^#?\/?/, ""); }
export function rotaAtual(){
  const h = location.hash.replace(/^#\/?/, "");
  const [nome, id] = h.split("/");
  return { nome: nome || "", id: id || null };
}
export function aoMudarRota(fn){ window.addEventListener("hashchange", fn); }
