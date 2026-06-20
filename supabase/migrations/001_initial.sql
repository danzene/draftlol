-- =====================================================================
-- DraftLoL — Schema inicial (Fase 0/1)
-- Cole este SQL no Supabase SQL Editor do seu projeto.
-- =====================================================================
-- AVISO DE SEGURANÇA: a segurança de uma sala depende APENAS de o jogador
-- conhecer o código de 5 letras. Não há senha. Qualquer um que descobrir
-- o código pode entrar e ler os dados da partida — aceitável para um jogo
-- de amigos em sessão fechada, mas não para dados sensíveis.
-- =====================================================================

-- Habilitar extensão (uuid já ativo por padrão no Supabase)
-- CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================================
-- TABELAS
-- =====================================================================

CREATE TABLE IF NOT EXISTS rooms (
  code            TEXT        PRIMARY KEY,          -- ex.: "K7F2A"
  host_player_id  UUID        NOT NULL REFERENCES auth.users(id),
  size            INT         NOT NULL CHECK (size IN (4, 8, 16)),
  mode            TEXT        NOT NULL CHECK (mode IN ('normal', 'blind')),
  status          TEXT        NOT NULL DEFAULT 'lobby'
                              CHECK (status IN ('lobby', 'drafting', 'bracket', 'finished')),
  -- ordem dos jogadores definida ao iniciar (usada pela serpentina)
  player_order    JSONB       NOT NULL DEFAULT '[]',
  -- estado do draft
  lane_idx        INT         NOT NULL DEFAULT 0,
  turn_pos        INT         NOT NULL DEFAULT 0,
  used_champions  JSONB       NOT NULL DEFAULT '[]',
  rerolls_left    INT         NOT NULL DEFAULT 2,
  ctx_label       TEXT,
  -- bracket (preenchido ao terminar o draft)
  bracket         JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_players (
  id          UUID        PRIMARY KEY,           -- auth.uid() para humanos, gen_random_uuid() para bots
  room_code   TEXT        NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  name        TEXT        NOT NULL,
  is_host     BOOL        NOT NULL DEFAULT FALSE,
  is_bot      BOOL        NOT NULL DEFAULT FALSE,
  alive       BOOL        NOT NULL DEFAULT TRUE,
  place       INT,                               -- posição final (1 = campeão, null = ainda disputando)
  team_picks  JSONB       NOT NULL DEFAULT '[]', -- array de objetos campeão, 1 por rota
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen   TIMESTAMPTZ NOT NULL DEFAULT NOW() -- heartbeat do cliente (~20s); detecta desconexão
);

CREATE TABLE IF NOT EXISTS matches (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code   TEXT        NOT NULL REFERENCES rooms(code) ON DELETE CASCADE,
  round       INT         NOT NULL,
  match_idx   INT         NOT NULL,
  player_a    UUID        NOT NULL,              -- referência a room_players.id
  player_b    UUID        NOT NULL,
  -- seed usado por genTimeline — gerado ao criar a partida,
  -- usado por ambos os lados para resultado determinístico
  seed        TEXT        NOT NULL,
  played      BOOL        NOT NULL DEFAULT FALSE,
  winner      UUID,
  score_a     INT,
  score_b     INT
);

-- =====================================================================
-- REALTIME: habilitar para as 3 tabelas
-- (ou faça via Dashboard → Database → Replication → toggle por tabela)
-- =====================================================================
ALTER TABLE rooms        REPLICA IDENTITY FULL;
ALTER TABLE room_players REPLICA IDENTITY FULL;
ALTER TABLE matches      REPLICA IDENTITY FULL;

-- Adicionar à publicação realtime (Supabase cria 'supabase_realtime' automaticamente)
ALTER PUBLICATION supabase_realtime ADD TABLE rooms, room_players, matches;

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
ALTER TABLE rooms        ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches      ENABLE ROW LEVEL SECURITY;

-- ── ROOMS ─────────────────────────────────────────────────────────────
-- Qualquer autenticado pode ler (quem sabe o código busca pelo code)
CREATE POLICY "rooms_select"
  ON rooms FOR SELECT TO authenticated USING (true);

-- Somente o host cria a sala (host_player_id deve ser auth.uid())
CREATE POLICY "rooms_insert"
  ON rooms FOR INSERT TO authenticated
  WITH CHECK (host_player_id = auth.uid());

-- Host pode atualizar campos administrativos da própria sala
-- (iniciar draft, definir player_order, status, etc.)
CREATE POLICY "rooms_update_host"
  ON rooms FOR UPDATE TO authenticated
  USING (host_player_id = auth.uid());

-- ── ROOM_PLAYERS ──────────────────────────────────────────────────────
CREATE POLICY "rp_select"
  ON room_players FOR SELECT TO authenticated USING (true);

-- Inserir a própria linha (humano) ou bots (somente se for o host da sala)
CREATE POLICY "rp_insert"
  ON room_players FOR INSERT TO authenticated
  WITH CHECK (
    id = auth.uid()    -- humano inserindo sua própria linha
    OR
    (is_bot = TRUE AND EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.code = room_code
        AND r.host_player_id = auth.uid()
    ))
  );

-- Atualizar somente a própria linha (heartbeat, last_seen, etc.)
CREATE POLICY "rp_update_own"
  ON room_players FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- ── MATCHES ───────────────────────────────────────────────────────────
CREATE POLICY "matches_select"
  ON matches FOR SELECT TO authenticated USING (true);

-- Somente o host cria partidas da sala
CREATE POLICY "matches_insert"
  ON matches FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM rooms r
    WHERE r.code = room_code
      AND r.host_player_id = auth.uid()
  ));

-- Qualquer dos dois jogadores pode reportar o resultado UMA única vez.
-- O segundo que tentar gravar vai encontrar played=true e a policy bloqueará.
CREATE POLICY "matches_update_player"
  ON matches FOR UPDATE TO authenticated
  USING (
    (player_a = auth.uid() OR player_b = auth.uid())
    AND played = FALSE   -- já resolvida = ninguém mais altera
  );

-- =====================================================================
-- RPC: make_draft_pick
-- Operação atômica: valida que é a vez do jogador, registra a escolha,
-- adiciona à lista de campeões usados e avança o turno.
-- SECURITY DEFINER = roda com privilégios do dono (bypassa RLS),
-- mas valida internamente as regras de autorização.
-- =====================================================================
CREATE OR REPLACE FUNCTION make_draft_pick(
  p_room_code     TEXT,
  p_champion_id   TEXT,
  p_champion_json JSONB   -- objeto completo do campeão (para salvar em team_picks)
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_room         rooms%ROWTYPE;
  v_pc           INT;
  v_cur_idx      INT;
  v_cur_pid      UUID;
  v_is_bot       BOOL;
  v_new_tpos     INT;
  v_new_lidx     INT;
BEGIN
  -- Trava a linha para evitar corrida de escrita simultânea
  SELECT * INTO v_room FROM rooms WHERE code = p_room_code FOR UPDATE;
  IF NOT FOUND          THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.status != 'drafting' THEN RAISE EXCEPTION 'not_drafting'; END IF;

  v_pc := jsonb_array_length(v_room.player_order);
  IF v_pc = 0 THEN RAISE EXCEPTION 'no_players'; END IF;

  -- Calcula índice do jogador atual na serpentina
  IF v_room.lane_idx % 2 = 0 THEN
    v_cur_idx := v_room.turn_pos;
  ELSE
    v_cur_idx := v_pc - 1 - v_room.turn_pos;
  END IF;
  v_cur_pid := (v_room.player_order ->> v_cur_idx)::UUID;

  -- Verifica se é bot
  SELECT is_bot INTO v_is_bot
  FROM room_players WHERE id = v_cur_pid AND room_code = p_room_code;

  -- Autorização: humano = só a si mesmo; bot = somente o host pode pickear
  IF v_is_bot THEN
    IF auth.uid() != v_room.host_player_id THEN
      RAISE EXCEPTION 'only_host_for_bots';
    END IF;
  ELSE
    IF auth.uid() != v_cur_pid THEN
      RAISE EXCEPTION 'not_your_turn';
    END IF;
  END IF;

  -- Campeão já foi escolhido?
  IF v_room.used_champions @> to_jsonb(p_champion_id) THEN
    RAISE EXCEPTION 'champion_already_used';
  END IF;

  -- Registra pick no jogador
  UPDATE room_players
  SET team_picks = team_picks || jsonb_build_array(p_champion_json)
  WHERE id = v_cur_pid AND room_code = p_room_code;

  -- Avança turno (serpentina por rota)
  v_new_tpos := v_room.turn_pos + 1;
  v_new_lidx := v_room.lane_idx;

  IF v_new_tpos >= v_pc THEN
    v_new_tpos := 0;
    v_new_lidx := v_room.lane_idx + 1;
  END IF;

  -- Salva estado atualizado
  IF v_new_lidx >= 5 THEN
    -- Draft concluído → mudar status para bracket
    UPDATE rooms SET
      used_champions = used_champions || jsonb_build_array(p_champion_id),
      turn_pos = v_new_tpos,
      lane_idx = v_new_lidx,
      status = 'bracket'
    WHERE code = p_room_code;
    RETURN jsonb_build_object('done', true);
  ELSE
    UPDATE rooms SET
      used_champions = used_champions || jsonb_build_array(p_champion_id),
      turn_pos = v_new_tpos,
      lane_idx = v_new_lidx
    WHERE code = p_room_code;
    RETURN jsonb_build_object('done', false, 'lane_idx', v_new_lidx, 'turn_pos', v_new_tpos);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION make_draft_pick TO authenticated;

-- =====================================================================
-- RPC: use_reroll
-- Decrementa rerolls_left validando que é a vez do jogador.
-- =====================================================================
CREATE OR REPLACE FUNCTION use_reroll(p_room_code TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_room    rooms%ROWTYPE;
  v_pc      INT;
  v_cur_idx INT;
  v_cur_pid UUID;
BEGIN
  SELECT * INTO v_room FROM rooms WHERE code = p_room_code FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'room_not_found'; END IF;
  IF v_room.status != 'drafting' THEN RAISE EXCEPTION 'not_drafting'; END IF;
  IF v_room.rerolls_left <= 0 THEN RAISE EXCEPTION 'no_rerolls'; END IF;

  v_pc := jsonb_array_length(v_room.player_order);
  IF v_room.lane_idx % 2 = 0 THEN
    v_cur_idx := v_room.turn_pos;
  ELSE
    v_cur_idx := v_pc - 1 - v_room.turn_pos;
  END IF;
  v_cur_pid := (v_room.player_order ->> v_cur_idx)::UUID;

  IF auth.uid() != v_cur_pid THEN RAISE EXCEPTION 'not_your_turn'; END IF;

  UPDATE rooms SET rerolls_left = rerolls_left - 1 WHERE code = p_room_code;
END;
$$;

GRANT EXECUTE ON FUNCTION use_reroll TO authenticated;
