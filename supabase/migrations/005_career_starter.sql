-- =====================================================================
-- Migração 005: pacote inicial de Fichas (Fase 3 — gacha)
-- Cole no Supabase SQL Editor após 004.
--
-- Flag idempotente: garante que o pacote inicial de Fichas é concedido
-- uma única vez por perfil (inclusive perfis já criados na Fase 2).
-- =====================================================================

ALTER TABLE career_profiles
  ADD COLUMN IF NOT EXISTS starter_claimed BOOLEAN NOT NULL DEFAULT FALSE;
