# Fini Sete Lagoas — site e CRM

Repositório único do que está no ar em **[infinitas.kids](https://infinitas.kids)**:
o site do Carrinho da Fini e o CRM comercial da equipe.

**Fini Sete Lagoas** (Grupo Empresarial Infinitas) é a franquia oficial Fini em
Sete Lagoas — MG, com quiosque na Praça de Alimentação do Shopping Sete Lagoas
desde outubro de 2024, e atendimento de eventos em toda a Grande BH.

| | |
|---|---|
| **Publicação** | GitHub Pages, branch `main` (arquivo `CNAME` → `infinitas.kids`) |
| **Banco e API** | Supabase (projeto `crm`, região sa-east-1, plano Free) |
| **Stack** | HTML + CSS + JavaScript puro. Sem build, sem framework, sem `node_modules` |
| **E-mail** | Resend, disparado por Edge Function |
| **Rotas/distância** | Google Routes API |

---

## O que tem aqui

```
CNAME                     domínio do GitHub Pages
index.html                site (landing page do Carrinho da Fini)
blog.html                 blog "Abriu, leu, sorriu"
index_bkp.html            backup da versão anterior do site  ⚠️ ver "Pendências"
crm.html                  redirecionamento do endereço antigo para /crm/
robots.txt · sitemap.xml  SEO
google…​.html              verificação do Google Search Console

crm/
  index.html              casca do CRM: CSS, formulário público, telas vazias
  js/
    config.js             URLs, chaves públicas e versão
    api.js                ÚNICA camada que fala com o Supabase
    app.js                shell: sessão, navegação, login, boot
    router.js             rotas por hash (#/pipeline, #/lead/<id>, …)
    state.js · dados.js · ui.js · etapas.js
    form.js               formulário público do CRM (CEP via ViaCEP)
    inicio.js             follow-ups do dia
    pipeline.js           kanban
    lead.js               página do lead + timeline
    propostas.js          gerador de propostas
    pdf-modelo.js         PDF no modelo oficial (pdf-lib)
    relatorios.js · deslocamento.js · tabela.js · admin.js
    motores/precificacao.js   cálculo puro
    motores/rota.js           Google Routes API
    assets/                   modelo-base.pdf e fontes Montserrat

supabase/
  functions/notificar-lead/   e-mail de novo lead (Resend)
  functions/lead-site/        camada segura opcional para o formulário do site
```

---

## O site

**`index.html`** — página única com: hero e carrossel de fotos do carrinho,
diferenciais, galeria, seção comercial com os benefícios da experiência e o
formulário de orçamento. Imagens embutidas em WebP base64, então o arquivo é
autossuficiente (~425 KB) e não depende de pasta de imagens.

**`blog.html`** — blog com lista, filtro por categoria e página de artigo por
hash (`blog.html#post/<slug>`). Para publicar um post novo, basta copiar um bloco
da lista `POSTS`, no topo do `<script>`, e colar no início dela. As instruções
estão em comentário no próprio arquivo.

SEO: `title` e `meta description` focados em "Carrinho da Fini para festas e
eventos", canonical, Open Graph, e JSON-LD com `LocalBusiness` + `Service`.

---

## O CRM

No ar em **[infinitas.kids/crm](https://infinitas.kids/crm)**. Formulário aberto
ao cliente final + painel da equipe protegido por login.

### Funil (6 etapas)

`novo_lead` → `proposta_preparacao` → `em_negociacao` → `aguardando_cliente` →
`venda_fechada` | `venda_perdida`

### Telas

| Tela | Para quem | O que faz |
|---|---|---|
| Formulário público | qualquer visitante | Solicitação de orçamento com endereço estruturado e CEP |
| Início | equipe | Atrasados, para hoje, novos, aguardando, parados, propostas vencendo |
| Pipeline | equipe | Kanban das 6 etapas, arrastar entre colunas, motivo obrigatório na perda |
| Página do lead | equipe | Dados, endereço, propostas, timeline de interações |
| Propostas | equipe | Gerador com três categorias de balas e PDF no modelo oficial |
| Relatórios | equipe | KPIs, gráficos e exportação CSV |
| Deslocamento | equipe | Custo de rota pela Google Routes API |
| Tabela comercial | admin | Preços por kg, regras, contatos, textos |
| Admin | admin | Usuários e perfis, motivos de perda, auditoria, notificações |

### Permissões (RLS, verificadas contra a API real)

| Quem | Pode |
|---|---|
| Visitante (`anon`) | Só `INSERT` em `leads`, só nas colunas do formulário, com `origem='site'`. **Nenhum `SELECT`** |
| Equipe (`authenticated`) | Leads, interações e propostas: tudo. Tabela, usuários e motivos: leitura |
| Admin (`e_admin()`) | Escreve na tabela comercial, usuários e motivos; lê a auditoria |

### Propostas

Três categorias fixas — nacional, misto e importado —, preço por quilo editável
pelo admin, quantidade calculada por convidados × gramas (com mínimo). O PDF sai
no modelo oficial de 5 páginas: páginas 1, 2, 4 e 5 são as originais em vetor e a
página 3 é desenhada na hora com `pdf-lib` e fontes Montserrat. Ao gerar, o PDF
vai para o Storage e o WhatsApp abre com a mensagem e o link.

### Aviso de novo lead por e-mail

Todo lead que entra em **Novo Lead** dispara, por trigger → `pg_net` → Edge
Function `notificar-lead`, um e-mail para `quero@infinitas.kids` com todos os
dados e botões "Abrir no CRM" e "Chamar no WhatsApp". Falha de e-mail nunca
derruba o cadastro do lead: o erro fica registrado e pode ser reenviado pelo
Admin.

---

## Integração site → CRM

O formulário de orçamento do `index.html` **grava direto na tabela `leads`** do
mesmo banco do CRM. Uma base só: nada de planilha paralela ou digitação manual.

```
cliente preenche no site → validação no navegador → POST /rest/v1/leads
  → RLS aceita (origem='site') → etapa entra como default 'novo_lead'
  → trigger cria a interação "formulário" e dispara o e-mail
  → lead aparece na coluna Novo Lead
```

Os 17 campos do formulário são mapeados 1:1 com as colunas do CRM. `etapa` **não**
é enviada de propósito: a coluna tem default e o visitante não escreve nela — é o
mesmo contrato do `criarLeadPublico`. Por isso a chamada usa `Prefer: return=minimal`
(o `anon` não tem `SELECT`).

Proteções: trava contra duplo clique, fila local com reenvio e WhatsApp já
preenchido se a gravação falhar, campo-armadilha anti-robô, validação campo a
campo e tratamento de `409` como sucesso.

**Dois modos**, no objeto `CRM` no topo do `<script>` do `index.html`:

- **Direto** (ativo): usa a chave *publishable* do Supabase, pública por design e
  protegida pelo RLS.
- **Proxy** (recomendado): publicar `supabase/functions/lead-site` e preencher
  `proxy` — aí nenhuma chave fica no front-end, e ganha rate limit por IP e
  validação também no servidor.

---

## Publicar

Não há build. Editar o arquivo e subir para `main`; o Pages publica em 1–2 minutos.

**Dois cuidados que já causaram problema:**

1. **Cache do Pages: 10 minutos.** Depois de publicar, quem estava com a página
   aberta pode ver a versão anterior. `Ctrl+Shift+R` resolve na hora.
2. **Versão dos módulos do CRM.** Os módulos entram por um `importmap` no
   `crm/index.html` com `?v=x.y.z`. A cada publicação, subir a versão em
   `js/config.js` **e** no `importmap` — e todo arquivo novo em `js/` precisa
   entrar no mapa. Sem isso o Pages serve uma mistura de versões.
3. **Nenhuma tela do CRM importa `app.js`** — só `dados.js`. Importar `app.js` de
   outro módulo faz o shell rodar duas vezes e duplica os eventos.

---

## Segredos

| Tipo | Onde fica |
|---|---|
| Chave *publishable* do Supabase | `crm/js/config.js` — pública por design, protegida pelo RLS |
| Chave do Google Maps | `crm/js/config.js` — restrita a `https://infinitas.kids/*` |
| **Chave *secret* do Supabase** | **Nunca neste repositório.** Só em Supabase → Edge Functions → Secrets |
| `RESEND_API_KEY`, `CRM_WEBHOOK_SECRET` | Supabase → Edge Functions → Secrets |

---

## Manutenção

- **Pausa por inatividade:** no plano Free o projeto Supabase pausa após dias sem
  acesso e o formulário para de gravar. Um monitorador diário batendo em
  `infinitas.kids/crm` evita isso.
- **Backup:** botão "Baixar CSV" na aba Relatórios.
- **Novo usuário:** Supabase → Authentication → Users → Add user (com *Auto
  Confirm*). O trigger cria a linha em `public.usuarios` como vendedor; o perfil
  muda na aba Admin. Cadastro público está desligado.

---

## Pendências

- [ ] **`index_bkp.html`** está na raiz e é servido publicamente — o Google pode
      indexar como conteúdo duplicado do site. Apagar, ou bloquear no `robots.txt`
      e marcar com `noindex`.
- [ ] Falta o `og:image`: as fotos estão embutidas em base64, então não há imagem
      com URL própria e o link compartilhado no WhatsApp sai sem miniatura grande.
      Resolve subindo um arquivo de 1200×630.
- [ ] `supabase/sql/site-idempotencia.sql` ainda não está no repositório nem
      aplicado — é o que impede lead duplicado pelo banco.
- [ ] `RESEND_API_KEY` pendente: sem ela os avisos de novo lead ficam com status
      de erro e precisam de reenvio pelo Admin.
- [ ] Migrar o formulário do site para o modo proxy, tirando a chave do front-end.
- [ ] Posts do blog usam endereço com `#`, que o Google trata como a mesma página.
      Para indexar cada post, cada um precisaria virar um `.html` próprio.
