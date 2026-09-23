-- Feedback rapide sur la tenue du jour (homepage, brief 22/09/2026).
-- Aucun mécanisme n'existait : saved_looks capte un enregistrement, pas un
-- avis. Modèle RLS aligné sur public.saved_looks (0025).
--
-- Un avis par tenue et par jour, révisable : l'unicité porte sur
-- (user_id, jour, piece_ids) et non sur le verdict, pour qu'un second tap
-- corrige au lieu d'empiler. piece_ids peut référencer des ids de capsule
-- qui n'existent pas dans dressing_items — attendu, comme pour saved_looks.
--
-- verdict est une contrainte CHECK sur une table NEUVE, jamais une valeur
-- ajoutée à un enum existant.
--
-- DEUX RÈGLES QUE L'APPLICATION DOIT TENIR, et qu'aucune contrainte ne peut
-- imposer à sa place (cf. src/lib/outfitFeedback.ts et ses tests) :
--
--   1. piece_ids est écrit TRIÉ. L'égalité de tableaux est SENSIBLE À L'ORDRE
--      en Postgres, et addPieceToOutfit ajoute en fin de tableau : sans tri,
--      un même jeu de pièces réordonné créerait une seconde ligne au lieu de
--      corriger la première — l'inverse de ce que l'unicité garantit.
--
--   2. jour est envoyé depuis la date LOCALE. Le défaut current_date est la
--      date du SERVEUR, en UTC : un avis donné à 00 h 30 à Paris serait
--      classé la veille. Le défaut ne sert que de filet.

create table if not exists public.outfit_feedback (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  jour date not null default current_date,
  piece_ids bigint[] not null,
  occasion text,
  verdict text not null check (verdict in ('adore', 'pas_aujourdhui')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, jour, piece_ids)
);

create index if not exists outfit_feedback_user_jour_idx
  on public.outfit_feedback (user_id, jour desc);

-- Sans ce déclencheur, updated_at resterait à l'heure de l'insertion : une
-- colonne « révisable » qui ne dirait jamais qu'elle a été révisée.
-- saved_looks (0025) n'a pas cette colonne, l'alignement ne la couvrait donc
-- pas.
create or replace function public.touch_outfit_feedback()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists outfit_feedback_touch on public.outfit_feedback;
create trigger outfit_feedback_touch
  before update on public.outfit_feedback
  for each row execute function public.touch_outfit_feedback();

alter table public.outfit_feedback enable row level security;

-- create policy n'accepte pas IF NOT EXISTS : on supprime d'abord, pour que
-- le script soit rejouable.
drop policy if exists "Users can read own outfit feedback" on public.outfit_feedback;
create policy "Users can read own outfit feedback"
  on public.outfit_feedback for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own outfit feedback" on public.outfit_feedback;
create policy "Users can insert own outfit feedback"
  on public.outfit_feedback for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own outfit feedback" on public.outfit_feedback;
create policy "Users can update own outfit feedback"
  on public.outfit_feedback for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own outfit feedback" on public.outfit_feedback;
create policy "Users can delete own outfit feedback"
  on public.outfit_feedback for delete
  using (auth.uid() = user_id);
