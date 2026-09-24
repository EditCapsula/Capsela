-- Tenues planifiées (« Planifier une tenue », lot 3).
-- Modèle RLS aligné sur public.saved_looks (0025).
--
-- piece_ids peut référencer des ids de capsule qui n'existent pas dans
-- dressing_items — attendu, comme pour saved_looks et outfit_feedback.
--
-- moment et type_lieu sont des contraintes CHECK sur une table NEUVE,
-- jamais une valeur ajoutée à un enum existant.
--
-- occasion N'A PAS de CHECK, volontairement : outfit_history et saved_looks
-- n'en ont pas non plus. La taxonomie vit dans OccasionKey (types.ts) ; la
-- recopier ici en ferait une seconde définition, qui dériverait.
--
-- temp / weather_label gardent la PRÉVISION telle qu'elle était au moment de
-- planifier. Le jour J elle aura changé : les conserver permet de dire « on
-- avait prévu 14° » plutôt que de laisser croire que la tenue a été composée
-- sur la météo du jour.
--
-- jour est envoyé depuis la date LOCALE, comme pour outfit_feedback : le
-- défaut current_date est la date du SERVEUR en UTC, et une tenue planifiée
-- à 00 h 30 à Paris serait classée la veille. Le défaut n'est qu'un filet.

create table if not exists public.planned_outfits (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  jour date not null default current_date,
  moment text not null check (moment in ('Matin', 'Après-midi', 'Soirée', 'Toute la journée')),
  occasion text not null,
  -- WorkMode ou DateContext selon l'occasion ; null pour les huit autres.
  sous_choix text,
  lieu text not null,
  type_lieu text check (type_lieu in ('Restaurant', 'Bar / Rooftop', 'Lieu culturel', 'Extérieur', 'Chez quelqu''un')),
  dressing_seul boolean not null default false,
  piece_ids bigint[] not null,
  temp numeric,
  weather_label text,
  -- Réservé : « le jour J, ce look devient ta tenue du jour » (maquette).
  -- Posé maintenant plutôt qu'en ALTER TABLE plus tard.
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  -- Une tenue par créneau, révisable : replanifier le même jour au même
  -- moment CORRIGE au lieu d'empiler. Deux créneaux distincts le même jour
  -- (travail le matin, dîner le soir) restent deux lignes.
  unique (user_id, jour, moment)
);

create index if not exists planned_outfits_user_jour_idx
  on public.planned_outfits (user_id, jour);

alter table public.planned_outfits enable row level security;

create policy "Users can read own planned outfits"
  on public.planned_outfits for select
  using (auth.uid() = user_id);

create policy "Users can insert own planned outfits"
  on public.planned_outfits for insert
  with check (auth.uid() = user_id);

create policy "Users can update own planned outfits"
  on public.planned_outfits for update
  using (auth.uid() = user_id);

create policy "Users can delete own planned outfits"
  on public.planned_outfits for delete
  using (auth.uid() = user_id);
