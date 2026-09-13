/* Shell do CRM: sessão, navegação e despacho das telas. */
import { VERSAO } from "./config.js";
import { S, admin } from "./state.js";
import * as api from "./api.js";
import { $, $$, esc, toast, erroTexto, fecharGaveta, gavetaAberta } from "./ui.js";
import { go, rotaAtual, aoMudarRota } from "./router.js";
import { recarregarLeads, recarregarComercial, carregarApoio, aoRecarregar } from "./dados.js";
import { iniciarFormulario } from "./form.js";
import { renderInicio } from "./inicio.js";
import { renderPipeline } from "./pipeline.js";
import { renderLead } from "./lead.js";
import { renderRelatorios } from "./relatorios.js";
import { renderDeslocamento } from "./deslocamento.js";
import { renderPropostas } from "./propostas.js";
import { renderTabela } from "./tabela.js";
import { renderAdmin } from "./admin.js";

const TELAS = {
  form:         { render: () => {},               publica: true },
  inicio:       { render: renderInicio },
  pipeline:     { render: renderPipeline },
  lead:         { render: renderLead },
  propostas:    { render: renderPropostas },
  relatorios:   { render: renderRelatorios },
  deslocamento: { render: renderDeslocamento },
  tabela:       { render: renderTabela,  admin: true },
  admin:        { render: renderAdmin,   admin: true }
};

/* ---------- navegação ---------- */
function pintar(){
  const r = S.rota;
  $$(".view").forEach(v => v.classList.toggle("on", v.id === "view-" + (TELAS[r.nome] ? r.nome : "form")));
  $$(".tab").forEach(b => {
    b.hidden = !S.authed || (b.dataset.go === "admin" && !admin());
    b.setAttribute("aria-current", String(b.dataset.go === r.nome || (b.dataset.go === "pipeline" && r.nome === "lead")));
  });
  $("#authbtn").textContent = S.authed ? "Sair" : "Entrar";
  $("#authbtn").title = S.authed && S.usuario ? `${S.usuario.nome} · ${S.usuario.perfil}` : "Acesso da equipe";
  window.scrollTo(0, 0);
}

export function render(){
  const r = rotaAtual();
  if (!r.nome) r.nome = S.authed ? "inicio" : "form";
  if (!TELAS[r.nome]) r.nome = "form";
  S.rota = r;
  const tela = TELAS[r.nome];
  if (!tela.publica && !S.authed) { pintar(); renderLogin(r.nome); return; }
  if (tela.admin && !admin()) { go("inicio"); return; }
  pintar();
  if (gavetaAberta()) fecharGaveta();
  tela.render(r);
}

/* ---------- login ---------- */
function renderLogin(onde){
  const host = $("#view-" + onde);
  host.innerHTML = `
    <div class="lock">
      <p class="eyebrow">Painel de gestão</p><h2>Acesso da equipe</h2>
      <p>Entre com o e-mail e a senha que o administrador cadastrou. O formulário de solicitação continua aberto para os clientes.</p>
      <div class="field"><label for="lg-email">E-mail</label><input id="lg-email" type="email" autocomplete="username" autocapitalize="none"></div>
      <div class="field"><label for="lg-senha">Senha</label><input id="lg-senha" type="password" autocomplete="current-password"></div>
      <p class="err" id="lg-err"></p>
      <button class="btn" id="lg-go">Entrar</button>
    </div>`;
  const run = async () => {
    const e = $("#lg-err"), btn = $("#lg-go");
    const email = $("#lg-email").value.trim(), senha = $("#lg-senha").value;
    if (!email || !senha) { e.textContent = "Preencha e-mail e senha."; return; }
    btn.disabled = true; btn.textContent = "Entrando…"; e.textContent = "";
    const r = await api.entrar(email, senha);
    btn.disabled = false; btn.textContent = "Entrar";
    if (r.error) e.textContent = erroTexto(r.error);
  };
  $("#lg-go").addEventListener("click", run);
  host.querySelector(".lock").addEventListener("keydown", ev => { if (ev.key === "Enter") { ev.preventDefault(); run(); } });
  $("#lg-email").focus();
}

/* ---------- dados ---------- */
aoRecarregar(render);

async function aoEntrar(sessao){
  S.authed = !!sessao;
  S.usuario = sessao ? await api.meuUsuario(sessao.user) : null;
  if (S.authed) {
    await Promise.all([recarregarLeads(), recarregarComercial(), carregarApoio()]);
    if (!S._canal) S._canal = api.ouvirLeads(() => recarregarLeads());
    if (!rotaAtual().nome || rotaAtual().nome === "form") go("inicio"); else render();
  } else {
    S.leads = []; S.carregando = true;
    go("form"); render();
  }
}

/* ---------- boot ---------- */
$$(".tab").forEach(b => b.addEventListener("click", () => go(b.dataset.go)));
$("#gohome").addEventListener("click", () => go(S.authed ? "inicio" : "form"));
$("#authbtn").addEventListener("click", async () => {
  if (S.authed) { try { await api.sair(); } catch {} toast("Sessão encerrada."); }
  else go("pipeline");
});
$("#scrim").addEventListener("click", fecharGaveta);
document.addEventListener("keydown", e => { if (e.key === "Escape" && gavetaAberta()) fecharGaveta(); });
aoMudarRota(render);

iniciarFormulario();
render();
(async () => {
  const s = await api.sessaoAtual();
  api.aoMudarSessao(sess => { if (!!sess !== S.authed) aoEntrar(sess); });
  if (s) await aoEntrar(s); else { S.carregando = false; render(); }
})();
console.info("CRM Fini v" + VERSAO);
