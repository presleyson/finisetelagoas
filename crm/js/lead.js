/* Página do lead: cabeçalho, dados, endereço do evento, propostas e a timeline. */
import { WA } from "./config.js";
import { S, lead, admin } from "./state.js";
import * as api from "./api.js";
import { ETAPAS, etapa, normaliza, TIPOS_INTERACAO, tipoInteracao, ORIGENS } from "./etapas.js";
import { $, $$, esc, brl2, dataBR, dataHoraBR, relativo, toast, erroTexto, abrirGaveta, fecharGaveta,
         waLink, maskTel, maskCep, select, iso } from "./ui.js";
import { go } from "./router.js";
import { recarregarLeads } from "./dados.js";
import { pedirMotivo, valorNegociado } from "./pipeline.js";
import { aplicarCep } from "./form.js";

export function enderecoEvento(l){
  const linha1 = [l.logradouro, l.numero].filter(Boolean).join(", ") + (l.complemento ? " · " + l.complemento : "");
  const linha2 = [l.bairro, l.cidade].filter(Boolean).join(" — ") + (l.uf ? "/" + l.uf : "");
  return { nome: l.nome_local || (l.logradouro ? "" : l.local_festa), linha1, linha2, cep: l.cep,
           completo: [l.nome_local, linha1, linha2].filter(Boolean).join(", ") || l.local_festa };
}
/** Local como aparece na proposta (sem a cidade, que vai em campo próprio). */
export function localProposta(l){
  const e = enderecoEvento(l);
  return [l.nome_local, e.linha1, l.bairro].filter(Boolean).join(" - ") || l.local_festa || "";
}
export function destinoRota(l){
  const e = enderecoEvento(l);
  return [e.linha1, l.bairro, l.cidade, l.uf].filter(Boolean).join(", ") || [l.local_festa, l.cidade].filter(Boolean).join(", ");
}

export async function renderLead({ id }){
  const host = $("#view-lead");
  const l = lead(id);
  if (!l) { host.innerHTML = `<div class="zero"><p class="lede" style="margin:0">Lead não encontrado.</p><button class="btn ghost" data-go="pipeline">Voltar ao pipeline</button></div>`;
    $("[data-go]", host).addEventListener("click", () => go("pipeline")); return; }

  let inter = S.interacoes[id];
  if (!inter) { host.innerHTML = '<div class="empty" style="padding:70px">Carregando…</div>';
    try { inter = await api.listarInteracoes(id); S.interacoes[id] = inter; } catch (e) { inter = []; } }
  if (S.rota.id !== id) return;

  const et = etapa(l.etapa), end = enderecoEvento(l);
  const pessoas = (Number(l.criancas) || 0) + (Number(l.adultos) || 0);
  const props = S.propostas.filter(p => p.lead_id === id);
  const resp = S.usuarios.find(u => u.id === l.responsavel_id);
  const prox = l.proxima_data ? new Date(l.proxima_data) : null;
  const atras = prox && prox < new Date(new Date().setHours(0,0,0,0));

  host.innerHTML = `
    <div class="lead-head">
      <div>
        <p class="eyebrow"><button class="linkbtn" data-go="pipeline">Pipeline</button> · lead ${(l.origem && ORIGENS.find(o => o[0] === l.origem) || ["", "cadastrado"])[1].toLowerCase()} ${relativo(l.criado_em)}</p>
        <h1 style="font-size:30px;margin:4px 0 2px">${esc(l.responsavel)}</h1>
        <p style="margin:0;color:var(--ink-2)">${esc(l.evento || "")}${l.data ? " · " + dataBR(l.data) : ""}${l.horario ? " às " + esc(l.horario) : ""}</p>
        ${valorNegociado(l) ? `<p style="margin:6px 0 0;font-family:var(--mono);font-size:14px;font-weight:700;color:var(--accent)">Valor da negociação: ${brl2(valorNegociado(l))}${Number(l.valor) > 0 ? "" : ' <span style="font-weight:500;color:var(--ink-3)">(última proposta)</span>'}</p>` : ""}
      </div>
      <div class="lead-actions">
        <div class="stagesel" style="--stc:${et.cor}">
          ${select("lh-etapa", ETAPAS.map(e => [e.id, e.nome]), et.id)}
        </div>
        <a class="btn ghost sm" href="${waLink(l.telefone)}" target="_blank" rel="noopener">WhatsApp</a>
        <button class="btn sm" id="lh-proposta">Nova proposta</button>
      </div>
    </div>

    <div class="prox ${atras ? "atrasado" : prox ? "ok" : ""}">
      <span class="eyebrow" style="margin:0">Próxima ação</span>
      ${prox ? `<b>${esc(l.proxima_acao || "Retornar contato")}</b><span class="mono">${dataHoraBR(l.proxima_data)}${atras ? " · atrasada" : ""}</span>`
             : `<span style="color:var(--ink-3)">Nenhuma marcada — registre uma interação com data de retorno.</span>`}
      <span class="grow"></span>
      <span style="font-size:12.5px;color:var(--ink-3)">último contato: ${l.ultimo_contato_em ? relativo(l.ultimo_contato_em) : "nenhum"}</span>
    </div>

    <div class="leadgrid">
      <div class="leadcol">
        <div class="panel"><header><h3>Cliente e evento</h3><button class="linkbtn" id="lh-editar">editar</button></header>
          <div class="pad"><dl class="readout">
            <dt>WhatsApp</dt><dd><a href="${waLink(l.telefone)}" target="_blank" rel="noopener">${esc(l.telefone || "—")}</a></dd>
            <dt>E-mail</dt><dd>${l.email ? `<a href="mailto:${esc(l.email)}">${esc(l.email)}</a>` : "—"}</dd>
            <dt>Convidados</dt><dd>${pessoas ? `${pessoas} pessoas <small style="color:var(--ink-3)">(${l.criancas || 0} crianças, ${l.adultos || 0} adultos)</small>` : "—"}</dd>
            <dt>Responsável</dt><dd>${resp ? esc(resp.nome) : '<span style="color:var(--ink-3)">sem responsável</span>'}</dd>
            <dt>Observações do cliente</dt><dd>${esc(l.obs || "—")}</dd>
            ${normaliza(l.etapa) === "venda_perdida" ? `<dt>Motivo da perda</dt><dd>${esc(l.motivo || "—")}</dd>` : ""}
          </dl></div></div>

        <div class="panel"><header><h3>Local do evento</h3><button class="linkbtn" id="lh-endereco">editar</button></header>
          <div class="pad">
            ${end.nome ? `<p style="margin:0 0 4px;font-weight:600">${esc(end.nome)}</p>` : ""}
            ${end.linha1 ? `<p style="margin:0">${esc(end.linha1)}</p>` : ""}
            ${end.linha2 ? `<p style="margin:0;color:var(--ink-2)">${esc(end.linha2)}${end.cep ? " · CEP " + esc(end.cep) : ""}</p>` : ""}
            ${!end.linha1 ? `<p style="margin:6px 0 0;font-size:12.5px;color:var(--warn)">Sem endereço completo — o deslocamento vai usar só a cidade. Clique em editar e informe o CEP.</p>` : ""}
          </div></div>

        <div class="panel"><header><h3>Propostas</h3><p>${props.length ? props.length + " gerada" + (props.length > 1 ? "s" : "") : "nenhuma ainda"}</p></header>
          <div class="pad">${props.length ? `<div class="tablewrap"><table class="data"><thead><tr><th>Nº</th><th>Data</th><th>Balas</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>` +
            props.map(p => `<tr><td class="n">${String(p.numero).padStart(4, "0")}</td><td class="n">${dataBR(p.criado_em)}</td>
              <td class="n">${p.kg_total || 0} kg</td><td class="n"><b>${brl2(p.valor_total)}</b></td><td>${esc(p.status)}</td>
              <td>${p.pdf_url ? `<a href="${esc(p.pdf_url)}" target="_blank" rel="noopener">PDF</a>` : ""}</td></tr>`).join("") +
            `</tbody></table></div>` : `<p style="margin:0;color:var(--ink-3);font-size:13.5px">Gere a primeira em <b>Nova proposta</b>.</p>`}
          </div></div>
        ${admin() ? `<p style="font-size:12.5px;color:var(--ink-3)"><button class="linkbtn" id="lh-apagar">Excluir este lead</button> — só admin, e não tem volta.</p>` : ""}
      </div>

      <div class="leadcol">
        <div class="panel"><header><h3>Registrar interação</h3><p>o que aconteceu e quando voltar</p></header>
          <div class="pad" style="display:flex;flex-direction:column;gap:10px">
            <div class="tipos">${TIPOS_INTERACAO.filter(t => !["formulario","mudanca_etapa","proposta_enviada"].includes(t.id))
              .map(t => `<button class="tipo${t.id === "whatsapp" ? " on" : ""}" data-tipo="${t.id}">${t.icone} ${t.nome}</button>`).join("")}</div>
            <textarea id="in-desc" placeholder="Ex.: Cliente pediu opção com balas importadas e vai decidir na semana que vem." style="min-height:74px"></textarea>
            <div class="grid2">
              <div class="field"><label for="in-prox">Próxima ação</label><input id="in-prox" type="text" placeholder="Retornar com proposta"></div>
              <div class="field"><label for="in-data">Quando</label><input id="in-data" type="datetime-local"></div>
            </div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <button class="btn sm" id="in-ok">Registrar</button>
              <span style="font-size:12px;color:var(--ink-3)">Anotações internas nunca vão para o cliente.</span>
            </div>
          </div></div>

        <div class="panel"><header><h3>Histórico</h3><p>${inter.length} registro${inter.length === 1 ? "" : "s"}</p></header>
          <div class="pad"><div class="timeline">${inter.length ? inter.map(i => {
            const t = tipoInteracao(i.tipo);
            return `<div class="ev${i.automatica ? " auto" : ""}">
              <span class="ico">${t.icone}</span>
              <div class="evb">
                <div class="evh"><b>${esc(t.nome)}</b><span class="mono">${dataHoraBR(i.criado_em)}</span><span>${esc(i.usuario_nome || "")}</span>
                  ${!i.automatica ? `<button class="linkbtn" data-del-int="${esc(i.id)}" title="apagar">×</button>` : ""}</div>
                <p>${esc(i.descricao)}</p>
                ${i.proxima_data ? `<p class="evp">↳ ${esc(i.proxima_acao || "retornar")} · ${dataHoraBR(i.proxima_data)}</p>` : ""}
              </div></div>`; }).join("") : `<p style="margin:0;color:var(--ink-3);font-size:13.5px">Nada registrado ainda.</p>`}
          </div></div></div>
      </div>
    </div>`;

  /* ---- eventos ---- */
  $("[data-go]", host).addEventListener("click", () => go("pipeline"));
  $("#lh-proposta").addEventListener("click", () => { S.propostaLead = id; go("propostas"); });
  $("#lh-etapa").addEventListener("change", async e => {
    const nova = e.target.value;
    if (nova === "venda_perdida") { pedirMotivo(l); e.target.value = et.id; return; }
    try { await api.salvarLead(id, { etapa: nova }); toast("Etapa: " + etapa(nova).nome); delete S.interacoes[id]; recarregarLeads(); }
    catch (err) { toast(erroTexto(err)); }
  });
  let tipoSel = "whatsapp";
  $$(".tipo", host).forEach(b => b.addEventListener("click", () => { tipoSel = b.dataset.tipo; $$(".tipo", host).forEach(x => x.classList.toggle("on", x === b)); }));
  $("#in-ok").addEventListener("click", async () => {
    const desc = $("#in-desc").value.trim(); if (!desc) { toast("Escreva o que aconteceu."); return; }
    const d = { lead_id: id, tipo: tipoSel, descricao: desc };
    const px = $("#in-prox").value.trim(), pd = $("#in-data").value;
    if (pd) { d.proxima_data = new Date(pd).toISOString(); d.proxima_acao = px || "Retornar contato"; }
    try { await api.registrarInteracao(d); delete S.interacoes[id]; toast("Registrado."); await recarregarLeads(); renderLead({ id }); }
    catch (err) { toast(erroTexto(err)); }
  });
  $$("[data-del-int]", host).forEach(b => b.addEventListener("click", async () => {
    if (!confirm("Apagar esta anotação?")) return;
    try { await api.apagarInteracao(b.dataset.delInt); delete S.interacoes[id]; renderLead({ id }); } catch (err) { toast(erroTexto(err)); }
  }));
  $("#lh-editar").addEventListener("click", () => editarLead(l));
  $("#lh-endereco").addEventListener("click", () => editarEndereco(l));
  const ap = $("#lh-apagar"); if (ap) ap.addEventListener("click", async () => {
    if (!confirm(`Excluir o lead de ${l.responsavel}? Isso apaga a timeline e desvincula as propostas.`)) return;
    try { await api.apagarLead(id); toast("Excluído."); await recarregarLeads(); go("pipeline"); } catch (err) { toast(erroTexto(err)); }
  });
}

function editarLead(l){
  abrirGaveta(`
    <div class="drawer-head"><div><p class="eyebrow">Editar</p><h2>${esc(l.responsavel)}</h2></div><button class="x" data-fechar aria-label="Fechar">×</button></div>
    <div class="drawer-body">
      <div class="field"><label for="ed-resp">Responsável</label><input id="ed-resp" type="text" value="${esc(l.responsavel)}"></div>
      <div class="grid2">
        <div class="field"><label for="ed-tel">WhatsApp</label><input id="ed-tel" type="tel" value="${esc(l.telefone || "")}"></div>
        <div class="field"><label for="ed-email">E-mail</label><input id="ed-email" type="email" value="${esc(l.email || "")}"></div>
      </div>
      <div class="field"><label for="ed-evento">Evento</label><input id="ed-evento" type="text" value="${esc(l.evento || "")}"></div>
      <div class="grid3">
        <div class="field"><label for="ed-cri">Crianças</label><input id="ed-cri" type="number" min="0" value="${l.criancas == null ? "" : l.criancas}"></div>
        <div class="field"><label for="ed-adu">Adultos</label><input id="ed-adu" type="number" min="0" value="${l.adultos == null ? "" : l.adultos}"></div>
        <div class="field"><label for="ed-data">Data</label><input id="ed-data" type="date" value="${esc(String(l.data || "").slice(0,10))}"></div>
      </div>
      <div class="grid2">
        <div class="field"><label for="ed-hora">Horário</label><input id="ed-hora" type="time" value="${esc(l.horario || "")}"></div>
        <div class="field"><label for="ed-origem">Origem</label>${select("ed-origem", ORIGENS, l.origem || "site")}</div>
      </div>
      <div class="field"><label for="ed-resp-id">Responsável interno</label>
        ${select("ed-resp-id", [["", "— ninguém —"], ...S.usuarios.map(u => [u.id, u.nome])], l.responsavel_id || "")}</div>
      <div class="field"><label for="ed-valor">Valor negociado (R$)</label><input id="ed-valor" type="number" min="0" step="10" value="${l.valor == null ? "" : l.valor}"></div>
      <div class="field"><label for="ed-notas">Anotações internas fixas</label><textarea id="ed-notas">${esc(l.notas || "")}</textarea></div>
    </div>
    <div class="drawer-foot"><button class="btn" id="ed-ok">Salvar</button><button class="btn ghost sm" data-fechar>Cancelar</button></div>`);
  $("#ed-tel").addEventListener("input", e => { e.target.value = maskTel(e.target.value); });
  $("#ed-ok").addEventListener("click", async () => {
    const patch = {
      responsavel: $("#ed-resp").value.trim(), telefone: $("#ed-tel").value.trim(), email: $("#ed-email").value.trim() || null,
      evento: $("#ed-evento").value.trim(),
      criancas: $("#ed-cri").value === "" ? null : Number($("#ed-cri").value),
      adultos:  $("#ed-adu").value === "" ? null : Number($("#ed-adu").value),
      data: $("#ed-data").value || null, horario: $("#ed-hora").value || null,
      origem: $("#ed-origem").value, responsavel_id: $("#ed-resp-id").value || null,
      valor: $("#ed-valor").value === "" ? null : Number($("#ed-valor").value),
      notas: $("#ed-notas").value.trim() || null
    };
    try { await api.salvarLead(l.id, patch); fecharGaveta(); toast("Salvo."); recarregarLeads(); } catch (e) { toast(erroTexto(e)); }
  });
}

export function editarEndereco(l){
  abrirGaveta(`
    <div class="drawer-head"><div><p class="eyebrow">Local do evento</p><h2>Endereço</h2>
      <p style="margin:2px 0 0;color:var(--ink-2);font-size:13.5px">É daqui que sai o cálculo de deslocamento. Digite o CEP e o resto preenche sozinho.</p></div>
      <button class="x" data-fechar aria-label="Fechar">×</button></div>
    <div class="drawer-body">
      <div class="field"><label for="en-nome">Nome do local</label><input id="en-nome" type="text" placeholder="Buffet, salão, chácara…" value="${esc(l.nome_local || "")}"></div>
      <div class="grid3">
        <div class="field"><label for="en-cep">CEP</label><input id="en-cep" type="text" inputmode="numeric" placeholder="00000-000" value="${esc(l.cep || "")}"></div>
        <div class="field" style="grid-column:span 2"><label for="en-logradouro">Logradouro</label><input id="en-logradouro" type="text" value="${esc(l.logradouro || "")}"></div>
      </div>
      <div class="grid3">
        <div class="field"><label for="en-numero">Número</label><input id="en-numero" type="text" value="${esc(l.numero || "")}"></div>
        <div class="field" style="grid-column:span 2"><label for="en-complemento">Complemento</label><input id="en-complemento" type="text" value="${esc(l.complemento || "")}"></div>
      </div>
      <div class="grid3">
        <div class="field"><label for="en-bairro">Bairro</label><input id="en-bairro" type="text" value="${esc(l.bairro || "")}"></div>
        <div class="field"><label for="en-cidade">Cidade</label><input id="en-cidade" type="text" value="${esc(l.cidade || "")}"></div>
        <div class="field"><label for="en-uf">UF</label><input id="en-uf" type="text" maxlength="2" value="${esc(l.uf || "MG")}"></div>
      </div>
    </div>
    <div class="drawer-foot"><button class="btn" id="en-ok">Salvar endereço</button><button class="btn ghost sm" data-fechar>Cancelar</button></div>`);
  const cep = $("#en-cep");
  cep.addEventListener("input", e => { e.target.value = maskCep(e.target.value); if (e.target.value.length === 9) aplicarCep("en-"); });
  cep.addEventListener("blur", () => aplicarCep("en-"));
  $("#en-ok").addEventListener("click", async () => {
    const v = id => $("#" + id).value.trim();
    const patch = { nome_local: v("en-nome") || null, cep: v("en-cep") || null, logradouro: v("en-logradouro") || null,
      numero: v("en-numero") || null, complemento: v("en-complemento") || null, bairro: v("en-bairro") || null,
      cidade: v("en-cidade") || l.cidade, uf: (v("en-uf") || "MG").toUpperCase() };
    patch.local_festa = [patch.nome_local, [patch.logradouro, patch.numero].filter(Boolean).join(", "), patch.bairro].filter(Boolean).join(" - ") || l.local_festa;
    try { await api.salvarLead(l.id, patch); fecharGaveta(); toast("Endereço salvo."); recarregarLeads(); } catch (e) { toast(erroTexto(e)); }
  });
}
