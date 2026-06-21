-- =====================================================================
-- Migração 004: Modo Carreira — perfil persistente por conta (Fase 2)
-- Cole no Supabase SQL Editor após 001–003.
--
-- O Modo Carreira EXIGE login permanente (Google). O modo casual online
-- continua anônimo e intocado. Estas tabelas guardam só o progresso de
-- carreira; nenhuma tela de jogo depende delas ainda.
--
-- ANTES de usar, habilite o provedor Google no Dashboard:
--   Authentication → Providers → Google (client id/secret do Google Cloud)
--   Authentication → URL Configuration → Redirect URLs: a URL do seu site
-- =====================================================================

-- Helper: o usuário atual é PERMANENTE (não anônimo)?
-- Bloqueia que sessões anônimas criem dados de carreira.
CREATE OR REPLACE FUNCTION career_is_permanent() RETURNS BOOLEAN
LANGUAGE sql STABLE AS $$
  SELECT COALESCE((auth.jwt() ->> 'is_anonymous')::BOOLEAN, FALSE) = FALSE;
$$;

-- ── PERFIL ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_profiles (
  user_id         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name    TEXT        NOT NULL DEFAULT 'Treinador',
  pe              INT         NOT NULL DEFAULT 0,    -- Pontos de Experiência
  fichas          INT         NOT NULL DEFAULT 0,    -- moeda de gacha
  league          TEXT        NOT NULL DEFAULT 'ferro',
  trainer_talents JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── ELENCO (jogadores possuídos) ──────────────────────────────────────
-- Uma linha por jogador do catálogo (career/players.js). Duplicatas
-- incrementam stars/fragments — não criam novas linhas.
CREATE TABLE IF NOT EXISTS career_roster (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id      TEXT        NOT NULL,              -- id do catálogo
  stars          INT         NOT NULL DEFAULT 1,
  fragments      INT         NOT NULL DEFAULT 0,
  level          INT         NOT NULL DEFAULT 1,
  xp             INT         NOT NULL DEFAULT 0,
  player_talents JSONB       NOT NULL DEFAULT '{}',
  acquired_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, player_id)
);

-- ── CONQUISTAS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS career_achievements (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT        NOT NULL,
  unlocked_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, achievement_key)
);

-- updated_at automático no perfil
CREATE OR REPLACE FUNCTION career_touch_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS career_profiles_touch ON career_profiles;
CREATE TRIGGER career_profiles_touch BEFORE UPDATE ON career_profiles
  FOR EACH ROW EXECUTE FUNCTION career_touch_updated_at();

-- =====================================================================
-- ROW LEVEL SECURITY: cada um só enxerga/edita os PRÓPRIOS dados.
-- INSERT exige conta permanente (career_is_permanent) — anônimo não cria.
-- =====================================================================
ALTER TABLE career_profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_roster       ENABLE ROW LEVEL SECURITY;
ALTER TABLE career_achievements ENABLE ROW LEVEL SECURITY;

-- career_profiles
CREATE POLICY "cp_select" ON career_profiles FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "cp_insert" ON career_profiles FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND career_is_permanent());
CREATE POLICY "cp_update" ON career_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "cp_delete" ON career_profiles FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- career_roster
CREATE POLICY "cr_select" ON career_roster FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "cr_insert" ON career_roster FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND career_is_permanent());
CREATE POLICY "cr_update" ON career_roster FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "cr_delete" ON career_roster FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- career_achievements
CREATE POLICY "ca_select" ON career_achievements FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "ca_insert" ON career_achievements FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND career_is_permanent());
CREATE POLICY "ca_delete" ON career_achievements FOR DELETE TO authenticated
  USING (user_id = auth.uid());
