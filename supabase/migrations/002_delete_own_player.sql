-- Migração 002: permite player remover a própria linha (sair de sala / reentrar)
CREATE POLICY "rp_delete_own"
  ON room_players FOR DELETE TO authenticated
  USING (id = auth.uid());
