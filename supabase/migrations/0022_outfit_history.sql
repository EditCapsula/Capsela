-- Historique des tenues portées (state.history) — comme dressing_items
-- (migration 0021), jamais persisté jusqu'ici : vivait uniquement dans le
-- state React et disparaissait au rechargement. Modèle RLS aligné sur
-- public.profiles (migration 0001).

create table if not exists public.outfit_history (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  -- Horodatage de la tenue (HistoryEntry.ts) — occurred_at plutôt que
  -- created_at seul pour rester lisible si une entrée est un jour rejouée/
  -- corrigée plutôt que simplement créée.
  occurred_at timestamptz not null default now(),
  piece_ids bigint[] not null,
  occasion text not null,
  -- Météo au moment de la validation (recette 19/08/2026) — absente sur les
  -- entrées antérieures, donc nullable ici aussi.
  temp numeric,
  weather_label text,
  created_at timestamptz not null default now()
);

create index if not exists outfit_history_user_id_idx on public.outfit_history (user_id);

alter table public.outfit_history enable row level security;

create policy "Users can read own outfit history"
  on public.outfit_history for select
  using (auth.uid() = user_id);

create policy "Users can insert own outfit history"
  on public.outfit_history for insert
  with check (auth.uid() = user_id);

create policy "Users can update own outfit history"
  on public.outfit_history for update
  using (auth.uid() = user_id);

create policy "Users can delete own outfit history"
  on public.outfit_history for delete
  using (auth.uid() = user_id);
