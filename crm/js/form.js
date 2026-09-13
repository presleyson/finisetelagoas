/* Formulário público de solicitação — o único lugar que um visitante toca. */
import { WA } from "./config.js";
import { S } from "./state.js";
import * as api from "./api.js";
import { $, esc, dataBR, iso, maskTel, maskCep, waLink, erroTexto } from "./ui.js";

const v = (id) => ($("#" + id) ? $("#" + id).value.trim() : "");

export function lerFormulario(){
  const local = [v("f-local"), [v("f-logradouro"), v("f-numero")].filter(Boolean).join(", "), v("f-bairro")]
    .filter(Boolean).join(" - ");
  return {
    responsavel: v("f-responsavel"), telefone: v("f-telefone"), email: v("f-email") || null,
    evento: v("f-evento"),
    criancas: v("f-criancas") === "" ? null : Number(v("f-criancas")),
    adultos:  v("f-adultos")  === "" ? null : Number(v("f-adultos")),
    nome_local: v("f-local") || null, cep: v("f-cep") || null,
    logradouro: v("f-logradouro") || null, numero: v("f-numero") || null,
    complemento: v("f-complemento") || null, bairro: v("f-bairro") || null,
    cidade: v("f-cidade"), uf: v("f-uf") || "MG",
    local_festa: local || v("f-local"),
    data: v("f-data"), horario: v("f-horario") || null, obs: v("f-obs") || null,
    origem: "site"
  };
}
export function validar(d){
  if (!d.responsavel || d.responsavel.length < 2) return "Informe o nome do responsável.";
  if (d.telefone.replace(/\D/g, "").length < 10)  return "Informe um WhatsApp com DDD.";
  if (!d.evento)     return "Informe o aniversariante ou o tipo de evento.";
  if (!d.nome_local && !d.logradouro) return "Informe o local da festa.";
  if (!d.cidade)     return "Informe a cidade.";
  if (!d.data)       return "Informe a data da festa.";
  if (d.data < iso(-1)) return "A data da festa já passou.";
  return null;
}
export function mensagemWA(d){
  const end = [d.nome_local, [d.logradouro, d.numero].filter(Boolean).join(", "), d.bairro].filter(Boolean).join(" - ");
  return "Olá! Gostaria de um orçamento do Carrinho da Fini.\n\n" +
    `Responsável: ${d.responsavel}\nEvento: ${d.evento}\n` +
    `Crianças/adolescentes: ${d.criancas == null ? "a confirmar" : d.criancas}\n` +
    `Adultos: ${d.adultos == null ? "a confirmar" : d.adultos}\n` +
    `Local: ${end || d.local_festa}\nCidade: ${d.cidade}${d.uf ? "/" + d.uf : ""}\n` +
    `Data: ${dataBR(d.data)}${d.horario ? " às " + d.horario : ""}\n` +
    (d.obs ? `Observações: ${d.obs}\n` : "");
}
function erro(m){ const b = $("#formerr"), t = $("#formerrtxt"); if (!b || !t) return; b.hidden = !m; t.textContent = m || ""; }

/* CEP → preenche logradouro, bairro, cidade, UF */
export async function aplicarCep(prefixo){
  const cepEl = $("#" + prefixo + "cep"); if (!cepEl) return;
  const d = cepEl.value.replace(/\D/g, "");
  if (d.length !== 8) return;
  cepEl.classList.add("buscando");
  try {
    const r = await api.buscarCep(d);
    if (!r) return;
    const set = (id, val) => { const n = $("#" + prefixo + id); if (n && (!n.value || n.dataset.auto === "1")) { n.value = val; n.dataset.auto = "1"; } };
    set("logradouro", r.logradouro); set("bairro", r.bairro); set("cidade", r.cidade); set("uf", r.uf);
    const num = $("#" + prefixo + "numero"); if (num && !num.value) num.focus();
  } catch {} finally { cepEl.classList.remove("buscando"); }
}

export function iniciarFormulario(){
  const form = $("#leadform"); if (!form) return;
  $("#f-telefone").addEventListener("input", e => { e.target.value = maskTel(e.target.value); });
  $("#f-cep").addEventListener("input", e => { e.target.value = maskCep(e.target.value); if (e.target.value.length === 9) aplicarCep("f-"); });
  $("#f-cep").addEventListener("blur", () => aplicarCep("f-"));
  $("#f-data").min = iso(0);

  $("#wabtn").addEventListener("click", () => {
    const d = lerFormulario(), e = validar(d);
    if (e) { erro(e); return; }
    window.open(waLink(WA, mensagemWA(d)), "_blank", "noopener");
  });

  form.addEventListener("submit", async ev => {
    ev.preventDefault();
    const d = lerFormulario(), e = validar(d);
    if (e) { erro(e); return; }
    if ($("#f-site").value) return;                               // armadilha anti-robô
    if (Date.now() - S.abertoEm < 2500) { erro("Só um instante e tente de novo."); return; }
    erro("");
    if (!S.sb && !window.supabase) { window.open(waLink(WA, mensagemWA(d)), "_blank", "noopener"); return; }

    const btn = $("#submitbtn"); btn.disabled = true; btn.textContent = "Enviando…";
    const r = await api.criarLeadPublico(d);
    if (r.error) {
      btn.disabled = false; btn.textContent = "Enviar solicitação";
      erro("Não conseguimos registrar agora (" + erroTexto(r.error) + "). Use o botão do WhatsApp para não perder a data.");
      return;
    }
    $("#formhost").innerHTML = `
      <div class="paper"><div class="ok-panel">
        <p class="eyebrow">Solicitação registrada</p>
        <h2>Recebemos o seu pedido, ${esc(d.responsavel.split(" ")[0])}.</h2>
        <p>A equipe da Infinitas vai montar o orçamento para <b>${esc(d.evento)}</b> em ${esc(d.cidade)}, dia ${dataBR(d.data)}, e responder no WhatsApp ${esc(d.telefone)}.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">
          <a class="btn" style="text-decoration:none" target="_blank" rel="noopener" href="${waLink(WA, mensagemWA(d))}">Adiantar pelo WhatsApp</a>
          <button class="btn ghost" id="again">Fazer outra solicitação</button>
        </div>
      </div></div>`;
    $("#again").addEventListener("click", () => location.reload());
    window.scrollTo(0, 0);
  });
}
