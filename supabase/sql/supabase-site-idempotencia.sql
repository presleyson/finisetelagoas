-- ============================================================================
-- site-idempotencia.sql
-- Proteção contra lead duplicado, garantida pelo BANCO (não só pelo navegador).
--
-- Problema que resolve: o cliente clica em "Enviar" e a resposta se perde no
-- caminho (rede caiu, celular trocou de 4G para wi-fi). Ele clica de novo.
-- Sem isto, nascem dois leads iguais no pipeline.
--
-- Como funciona: o site gera um código único por preenchimento e manda junto.
-- O banco aceita o primeiro e recusa qualquer repetição do mesmo código com
-- erro 23505 — que o site já trata como "deu certo, já está registrado".
--
-- COMO APLICAR
--   Supabase → SQL Editor → cole tudo → Run.
--   Depois, no index.html do site, mude:  idempotencia: false  →  true
-- ============================================================================

begin;

-- 1. A coluna do código único ------------------------------------------------
alter table public.leads
  add column if not exists idempotency_key text;

comment on column public.leads.idempotency_key is
  'Código único gerado pelo formulário do site a cada preenchimento. Impede que '
  'reenvios do mesmo formulário criem leads repetidos. Nulo para leads criados '
  'manualmente pela equipe.';

-- 2. O índice que barra a repetição ------------------------------------------
-- Parcial: só vale para linhas que têm o código, então lead manual não é afetado.
create unique index if not exists leads_idempotency_key_uk
  on public.leads (idempotency_key)
  where idempotency_key is not null;

-- 3. Permissão para o visitante gravar essa coluna ---------------------------
-- O anon já podia inserir apenas as colunas do formulário; só acrescentamos
-- mais esta. Ele continua sem poder LER nada e sem escolher etapa/origem.
grant insert (idempotency_key) on public.leads to anon;

commit;

-- ============================================================================
-- CONFERÊNCIA (rode depois, opcional)
-- ============================================================================
-- Deve devolver uma linha:
--   select indexname from pg_indexes
--    where tablename = 'leads' and indexname = 'leads_idempotency_key_uk';
--
-- Deve listar idempotency_key entre as colunas com insert liberado para anon:
--   select column_name
--     from information_schema.column_privileges
--    where table_name = 'leads' and grantee = 'anon' and privilege_type = 'INSERT'
--    order by column_name;

-- ============================================================================
-- PARA DESFAZER (se precisar voltar atrás)
-- ============================================================================
-- begin;
--   revoke insert (idempotency_key) on public.leads from anon;
--   drop index if exists public.leads_idempotency_key_uk;
--   alter table public.leads drop column if exists idempotency_key;
-- commit;
-- Lembre de voltar  idempotencia: true → false  no index.html.
