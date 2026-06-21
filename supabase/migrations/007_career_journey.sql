-- =====================================================================
-- Migração 007: jornada plurianual — região, ano e estado do mundo (Fase 6)
-- Cole no Supabase SQL Editor após 006.
--
-- region     : código da região escolhida uma vez (ex.: 'BR', 'KR').
--              NULL enquanto o treinador ainda não escolheu.
--              Bloqueado no front-end após escolha; sem constraint SQL para
--              permitir reset administrativo se necessário.
-- career_year: ano atual da jornada (começa em 1, cresce a cada virada).
-- world_state: estado completo do ciclo anual em JSONB (etapa atual,
--              resultados das fases, rivais recorrentes, histórico).
--              Estrutura gerenciada por career/journey.js (initialWorldState).
-- =====================================================================

ALTER TABLE career_profiles
  ADD COLUMN IF NOT EXISTS region      TEXT,
  ADD COLUMN IF NOT EXISTS career_year INT  NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS world_state JSONB NOT NULL DEFAULT '{}';
