-- "Ajouter à un look" depuis la fiche détail d'une pièce (recette 24/08/2026,
-- refonte PieceScreen) — addPieceToLook (store.tsx) fait un UPDATE sur
-- saved_looks (piece_ids) pour ajouter une pièce à un look existant. La
-- migration 0025 n'avait créé que select/insert/delete : sans policy update,
-- cet UPDATE est silencieusement bloqué par RLS (aucune ligne affectée,
-- aucune erreur levée par Postgres).

create policy "Users can update own saved looks"
  on public.saved_looks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
