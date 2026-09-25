-- Avis de styliste — enregistrement dans le Journal (docs/avis-de-styliste.md
-- sections 14 et 23 ; arbitrages du 25/09/2026, docs/avis-de-styliste-arbitrages.md).
--
-- UNE TABLE DÉDIÉE, PAS outfit_history. Le Journal existant ne peut pas
-- l'accueillir : `piece_ids` et `occasion` y sont NOT NULL, et il n'a ni type
-- d'entrée ni contenu libre (0022). Un avis n'est pas une tenue portée.
--
-- RIEN N'EST ÉCRIT SANS ACTION EXPLICITE : une ligne n'existe que si
-- l'utilisatrice a touché « Enregistrer dans mon journal ». Une analyse non
-- enregistrée n'est stockée nulle part (ni ici, ni dans Storage).
--
-- LA PHOTO EST PRIVÉE (arbitré : conservée tant que l'avis existe). Bucket
-- `avis-styliste-photos` NON public — contrairement à `dressing-photos`
-- (0023) : aucune URL publique, lecture par URL signée, et uniquement par la
-- propriétaire. Chemin : {user_id}/{uuid}.jpg.
--
-- SUPPRESSION : une ligne supprimée par l'app emporte sa photo (l'app
-- supprime les deux) ; la suppression du compte cascade la table
-- (on delete cascade) et la fonction delete-account vide le dossier.

create table if not exists public.avis_styliste (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- Identifiant technique de l'analyse (renvoyé par la fonction
  -- stylist-advice) : un même résultat ne peut pas être enregistré deux fois.
  analyse_id text not null unique,
  -- { overallAssessment, strengths[], mainAdvice, suggestions[] } — la
  -- structure décidée (section 8), telle qu'affichée.
  resultat jsonb not null check (jsonb_typeof(resultat) = 'object'),
  -- [{ id, lien }] : pièces du dressing suggérées. Une pièce retirée depuis
  -- n'est simplement plus affichée (arbitré) — pas de clé étrangère.
  pieces_dressing jsonb not null default '[]'::jsonb check (jsonb_typeof(pieces_dressing) = 'array'),
  -- Chemin dans le bucket privé ; null si l'avis a été enregistré sans photo.
  photo_path text
);

create index if not exists avis_styliste_user_created_idx on public.avis_styliste (user_id, created_at desc);

alter table public.avis_styliste enable row level security;

-- Lecture, création et suppression par la propriétaire uniquement. Aucune
-- modification : un avis enregistré ne se réécrit pas.
drop policy if exists "avis_styliste_select_proprietaire" on public.avis_styliste;
create policy "avis_styliste_select_proprietaire" on public.avis_styliste
  for select using (auth.uid() = user_id);

drop policy if exists "avis_styliste_insert_proprietaire" on public.avis_styliste;
create policy "avis_styliste_insert_proprietaire" on public.avis_styliste
  for insert with check (auth.uid() = user_id);

drop policy if exists "avis_styliste_delete_proprietaire" on public.avis_styliste;
create policy "avis_styliste_delete_proprietaire" on public.avis_styliste
  for delete using (auth.uid() = user_id);

-- Bucket privé des photos d'avis enregistrés.
insert into storage.buckets (id, name, public)
values ('avis-styliste-photos', 'avis-styliste-photos', false)
on conflict (id) do nothing;

drop policy if exists "avis_styliste_photos_select_proprietaire" on storage.objects;
create policy "avis_styliste_photos_select_proprietaire" on storage.objects
  for select using (bucket_id = 'avis-styliste-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avis_styliste_photos_insert_proprietaire" on storage.objects;
create policy "avis_styliste_photos_insert_proprietaire" on storage.objects
  for insert with check (bucket_id = 'avis-styliste-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avis_styliste_photos_delete_proprietaire" on storage.objects;
create policy "avis_styliste_photos_delete_proprietaire" on storage.objects
  for delete using (bucket_id = 'avis-styliste-photos' and (storage.foldername(name))[1] = auth.uid()::text);
