-- Migration 008: career season state columns
-- Adds split tracking, league standings, international results and recurring rivals.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE career_profiles
  ADD COLUMN IF NOT EXISTS split_number         INT     NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS league_table         JSONB   NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS international_results JSONB  NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recurring_rivals     JSONB   NOT NULL DEFAULT '[]';

COMMENT ON COLUMN career_profiles.split_number          IS 'Split atual dentro do ano (1=FST, 2=MSI, 3=Worlds)';
COMMENT ON COLUMN career_profiles.league_table          IS 'Standings da temporada regular do split atual {regionId: [{teamId, wins, losses}]}';
COMMENT ON COLUMN career_profiles.international_results IS 'Resultados dos torneios internacionais por split e ano';
COMMENT ON COLUMN career_profiles.recurring_rivals      IS 'Times rivais recorrentes [{teamId, name, regionId, encounters}]';
