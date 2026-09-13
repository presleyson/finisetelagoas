/* Utilidades de interface: formatação, escape, toast, gaveta lateral, tooltips. */
export const $ = (s, r) => (r || document).querySelector(s);
export const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

export function esc(s){
  return String(s == null ? "" : s).replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}
export function brl(v){
  if (v == null || v === "") return "—";
  return Number(v).toLocaleString("pt-BR", {style:"currency", currency:"BRL", maximumFractionDigits:0});
}
export function brl2(v){
  if (v == null || v === "") return "—";
  return Number(v).toLocaleString("pt-BR", {style:"currency", currency:"BRL", minimumFractionDigits:2, maximumFractionDigits:2});
}
export function num(v, d = 1){ return Number(v || 0).toLocaleString("pt-BR", {maximumFractionDigits:d}); }
export function dataBR(s){
  if (!s) return "—";
  const p = String(s).slice(0,10).split("-");
  return p.length === 3 ? p[2]+"/"+p[1]+"/"+p[0] : s;
}
export function dataHoraBR(s){
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit"});
}
export function relativo(s){
  if (!s) return "";
  const dias = Math.round((Date.now() - new Date(s).getTime()) / 864e5);
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias < 30) return `há ${dias} dias`;
  const m = Math.round(dias / 30);
  return m === 1 ? "há 1 mês" : `há ${m} meses`;
}
export function iso(d){ const t = new Date(); t.setDate(t.getDate() + d); return t.toISOString().slice(0,10); }
export const MES = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];
export const mesKey = (s) => s ? String(s).slice(0,7) : "";
export const mesLabel = (k) => { const p = k.split("-"); return MES[Number(p[1]) - 1] + "/" + p[0].slice(2); };

export function maskTel(v){
  const d = String(v).replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? "(" + d : "";
  if (d.length <= 6) return "(" + d.slice(0,2) + ") " + d.slice(2);
  if (d.length <= 10) return "(" + d.slice(0,2) + ") " + d.slice(2,6) + "-" + d.slice(6);
  return "(" + d.slice(0,2) + ") " + d.slice(2,7) + "-" + d.slice(7);
}
export function maskCep(v){
  const d = String(v).replace(/\D/g, "").slice(0, 8);
  return d.length > 5 ? d.slice(0,5) + "-" + d.slice(5) : d;
}
export function waLink(telefone, texto){
  let n = String(telefone || "").replace(/\D/g, "");
  if (n.length <= 11) n = "55" + n;
  return "https://wa.me/" + n + (texto ? "?text=" + encodeURIComponent(texto) : "");
}

export function toast(m){
  const t = $("#toast"); t.textContent = m; t.classList.add("on");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("on"), 2600);
}

/* gaveta lateral */
export function abrirGaveta(html, aoFechar){
  const d = $("#drawer");
  d.innerHTML = html;
  d._aoFechar = aoFechar || null;
  d.classList.add("on"); d.setAttribute("aria-hidden", "false");
  $("#scrim").classList.add("on");
  $$("[data-fechar]", d).forEach(b => b.addEventListener("click", fecharGaveta));
}
export function fecharGaveta(){
  const d = $("#drawer");
  d.classList.remove("on"); d.setAttribute("aria-hidden", "true");
  $("#scrim").classList.remove("on");
  if (d._aoFechar) { const f = d._aoFechar; d._aoFechar = null; f(); }
}
export const gavetaAberta = () => $("#drawer").classList.contains("on");

/* tooltip dos gráficos */
export function ligarTooltips(root){
  const tip = $("#tip");
  $$("[data-tip]", root).forEach(n => {
    n.addEventListener("mouseenter", () => { tip.textContent = n.dataset.tip; tip.classList.add("on"); });
    n.addEventListener("mousemove", e => {
      tip.style.left = Math.min(e.clientX + 12, window.innerWidth - tip.offsetWidth - 8) + "px";
      tip.style.top = (e.clientY - 32) + "px";
    });
    n.addEventListener("mouseleave", () => tip.classList.remove("on"));
  });
}

export function erroTexto(e){
  if (!e) return "Erro desconhecido.";
  const m = String(e.message || e);
  if (/Failed to fetch|NetworkError/i.test(m)) return "Sem conexão com o servidor. Verifique a internet.";
  if (/Invalid login credentials/i.test(m))    return "E-mail ou senha incorretos.";
  if (/Email not confirmed/i.test(m))          return "Este usuário ainda não confirmou o e-mail.";
  if (/row-level security|violates row/i.test(m)) return "Sem permissão para esta operação.";
  if (/permission denied/i.test(m))            return "Sem permissão para esta operação.";
  return m;
}

/* campos de formulário */
export const campo = (id, rotulo, inner, hint) =>
  `<div class="field"><label for="${id}">${rotulo}</label>${inner}${hint ? `<span class="hint">${hint}</span>` : ""}</div>`;
export const input = (id, tipo, valor, extra = "") =>
  `<input id="${id}" type="${tipo}" value="${esc(valor == null ? "" : valor)}" ${extra}>`;
export const select = (id, opcoes, valor, extra = "") =>
  `<select id="${id}" ${extra}>` + opcoes.map(([v, n]) =>
    `<option value="${esc(v)}"${String(v) === String(valor) ? " selected" : ""}>${esc(n)}</option>`).join("") + `</select>`;
