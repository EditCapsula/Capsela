-- Préparer sa valise — la valise enregistrée dans le compte (docs/valise.md).
-- Modèle RLS aligné sur public.planned_outfits (0030).
--
-- UNE VALISE PAR COMPTE (unique user_id) : l'écran n'en montre qu'une,
-- « Nouvelle valise » la remplace. Plusieurs valises demanderaient une
-- liste que la maquette ne dessine pas.
--
-- piece_ids : ids de dressing_items (la valise ne contient que des pièces
-- réelles). Pas de clé étrangère, comme saved_looks : une pièce supprimée du
-- dressing disparaît simplement de l'affichage.
--
-- sejour et occasions N'ONT PAS de CHECK, volontairement : la taxonomie vit
-- dans le code (valise.ts, types.ts) ; la recopier ici en ferait une seconde
-- définition, qui dériverait. bagage, lui, est une liste fermée sur une
-- table NEUVE.
--
-- calcul : ce que le moteur a produit (météos du séjour, situations, looks,
-- situations sans look). Relu tel quel, jamais recalculé à
-- l'ouverture : le moteur est aléatoire, et une valise qui change à chaque
-- ouverture ne serait plus la sienne.
--
-- depart / retour sont envoyés en date LOCALE (même raison que 0030).

create table if not exists public.valises (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  destination text not null,
  depart date not null,
  retour date not null,
  bagage text not null check (bagage in ('S', 'M', 'L', 'XL')),
  sejour text,
  occasions text[] not null default '{}',
  piece_ids bigint[] not null default '{}',
  calcul jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

alter table public.valises enable row level security;

create policy "Users can read own valise"
  on public.valises for select
  using (auth.uid() = user_id);

create policy "Users can insert own valise"
  on public.valises for insert
  with check (auth.uid() = user_id);

create policy "Users can update own valise"
  on public.valises for update
  using (auth.uid() = user_id);

create policy "Users can delete own valise"
  on public.valises for delete
  using (auth.uid() = user_id);
