-- Migration 003: cálculo único do bracket + timeline completa por partida
-- Cole no Supabase SQL Editor após 001 e 002.

-- Colunas novas em rooms: trava atômica de cálculo
ALTER TABLE rooms
  ADD COLUMN IF NOT EXISTS bracket_resolving BOOL NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS bracket_resolved  BOOL NOT NULL DEFAULT FALSE;

-- Colunas novas em matches: contexto e timeline completa
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS ctx_label TEXT,
  ADD COLUMN IF NOT EXISTS timeline  JSONB;

-- =====================================================================
-- RPC: claim_bracket_resolve
-- Operação atômica: apenas um cliente consegue setar bracket_resolving=TRUE.
-- Retorna TRUE se este cliente ganhou a corrida, FALSE caso contrário.
-- =====================================================================
CREATE OR REPLACE FUNCTION claim_bracket_resolve(p_room_code TEXT)
RETURNS BOOL
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE v_rows INT;
BEGIN
  UPDATE rooms
     SET bracket_resolving = TRUE
   WHERE code              = p_room_code
     AND status            = 'bracket'
     AND bracket_resolving = FALSE
     AND bracket_resolved  = FALSE;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;
GRANT EXECUTE ON FUNCTION claim_bracket_resolve TO authenticated;

-- =====================================================================
-- RPC: save_bracket_results
-- Insere todas as partidas com timeline e marca bracket_resolved=TRUE.
-- SECURITY DEFINER: bypassa RLS; valida internamente que quem chama
-- é o detentor do lock (bracket_resolving=TRUE, bracket_resolved=FALSE).
-- =====================================================================
CREATE OR REPLACE FUNCTION save_bracket_results(
  p_room_code TEXT,
  p_matches   JSONB   -- array de objetos de partida
) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE m JSONB;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM rooms
     WHERE code              = p_room_code
       AND bracket_resolving = TRUE
       AND bracket_resolved  = FALSE
  ) THEN
    RAISE EXCEPTION 'not_resolver_or_already_done';
  END IF;

  FOR m IN SELECT * FROM jsonb_array_elements(p_matches) LOOP
    INSERT INTO matches (
      id, room_code, round, match_idx,
      player_a, player_b, seed, ctx_label, timeline,
      played, winner, score_a, score_b
    ) VALUES (
      gen_random_uuid(),
      p_room_code,
      (m->>'round')::INT,
      (m->>'match_idx')::INT,
      (m->>'player_a')::UUID,
      (m->>'player_b')::UUID,
      m->>'seed',
      m->>'ctx_label',
      m->'timeline',
      TRUE,
      (m->>'winner')::UUID,
      (m->>'score_a')::INT,
      (m->>'score_b')::INT
    );
  END LOOP;

  UPDATE rooms
     SET bracket_resolving = FALSE,
         bracket_resolved  = TRUE
   WHERE code = p_room_code;
END;
$$;
GRANT EXECUTE ON FUNCTION save_bracket_results TO authenticated;
