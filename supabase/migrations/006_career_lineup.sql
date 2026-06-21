-- =====================================================================
-- Migração 006: escalação persistente em career_profiles (Fase 5a)
-- Cole no Supabase SQL Editor após 005.
--
-- A coluna lineup armazena a escalação do treinador:
--   {"top":"player_id","jungle":"player_id","mid":"player_id",
--    "adc":"player_id","support":"player_id","bench":["p1","p2"]}
-- Valor padrão {} = elenco não escalado ainda (partida bloqueada).
-- =====================================================================

ALTER TABLE career_profiles
  ADD COLUMN IF NOT EXISTS lineup JSONB NOT NULL DEFAULT '{}';
