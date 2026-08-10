-- Pièces du dressing (étape 2).
-- La saison est NOT NULL : la contrainte « saison obligatoire » est aussi
-- garantie côté base, pas seulement dans l'interface.

create table if not exists public.pieces (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  brand text,
  cat text not null check (cat in (
    'haut', 'bas', 'robe', 'manteau', 'pull', 'combinaison', 'jupe',
    'chaussures', 'sac', 'bijou', 'accessoire'
  )),
  color text not null default '',
  hex text not null default '',
  size text,
  season text not null check (season in ('Printemps / Été', 'Automne / Hiver', 'Toutes saisons')),
  occasion text,
  photo_path text,
  last_worn_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists pieces_user_id_idx on public.pieces (user_id);

alter table public.pieces enable row level security;

create policy "Users can read own pieces"
  on public.pieces for select
  using (auth.uid() = user_id);

create policy "Users can insert own pieces"
  on public.pieces for insert
  with check (auth.uid() = user_id);

create policy "Users can update own pieces"
  on public.pieces for update
  using (auth.uid() = user_id);

create policy "Users can delete own pieces"
  on public.pieces for delete
  using (auth.uid() = user_id);

drop trigger if exists pieces_updated_at on public.pieces;
create trigger pieces_updated_at
  before update on public.pieces
  for each row execute function public.set_updated_at();
