-- Mes looks (state.savedLooks) — comme dressing_items (0021) et
-- outfit_history (0022), jamais persisté jusqu'ici : vivait uniquement dans
-- le state React et disparaissait au rechargement (signalé 23/08/2026).
-- Modèle RLS aligné sur public.outfit_history.
--
-- source distingue les deux origines d'un look (recette 23/08/2026) :
-- "created" via Créer un look (dressing réel uniquement), "saved" via
-- Enregistrer cette tenue (peut mélanger pièces possédées et suggestions
-- capsule pas encore achetées — piece_ids référence alors des ids qui
-- n'existent pas dans dressing_items, c'est attendu).

create table if not exists public.saved_looks (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  piece_ids bigint[] not null,
  occasion text,
  source text not null check (source in ('saved', 'created')),
  created_at timestamptz not null default now()
);

create index if not exists saved_looks_user_id_idx on public.saved_looks (user_id);

alter table public.saved_looks enable row level security;

create policy "Users can read own saved looks"
  on public.saved_looks for select
  using (auth.uid() = user_id);

create policy "Users can insert own saved looks"
  on public.saved_looks for insert
  with check (auth.uid() = user_id);

create policy "Users can delete own saved looks"
  on public.saved_looks for delete
  using (auth.uid() = user_id);
