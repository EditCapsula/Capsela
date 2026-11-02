-- Votes sur les suggestions de la capsule (02/11/2026, refonte de la fiche d'une suggestion) : « J'aime », « Pas pour moi »,
-- « Je possède déjà », et les pièces écartées par « Remplacer cette pièce ». Jusqu'ici, seules les pièces écartées étaient gardées,
-- et sur l'appareil seulement (piecesEcartees.ts) ; cette table rattache les quatre états au compte, d'un appareil à l'autre.
--
-- Une ligne par pièce du catalogue et par personne, révisable : la clé primaire (user_id, piece_id) fait qu'un nouveau geste corrige
-- la ligne au lieu d'en empiler une ; retirer un « J'aime » supprime la ligne. Quatre états distincts, jamais confondus :
--   aimee (préférence, la pièce reste dans la capsule), rejetee (sortie de la capsule), possedee (la pièce du dressing la remplace),
--   remplacee (écartée par « Remplacer cette pièce »).
-- piece_id est l'identifiant de vestiaire_universel (ou du catalogue de repli) ; pas de clé étrangère, pour ne jamais bloquer une
-- écriture si une pièce du catalogue disparaît.
--
-- L'application fonctionne AVANT cette migration : les votes restent sur l'appareil, l'envoi échoue sans bruit et repart à la visite
-- suivante. Suppression du compte : ON DELETE CASCADE sur auth.users. Modèle RLS aligné sur public.accord_retours (0047).
-- Réversible : `drop table public.suggestions_capsule;` (les votes restent sur les appareils).

create table if not exists public.suggestions_capsule (
  user_id uuid not null references auth.users (id) on delete cascade,
  piece_id bigint not null,
  etat text not null check (etat in ('aimee', 'rejetee', 'possedee', 'remplacee')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, piece_id)
);

create index if not exists suggestions_capsule_user_idx
  on public.suggestions_capsule (user_id);

create or replace function public.touch_suggestions_capsule()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists suggestions_capsule_touch on public.suggestions_capsule;
create trigger suggestions_capsule_touch
  before update on public.suggestions_capsule
  for each row execute function public.touch_suggestions_capsule();

alter table public.suggestions_capsule enable row level security;

drop policy if exists "Users can read own suggestion votes" on public.suggestions_capsule;
create policy "Users can read own suggestion votes"
  on public.suggestions_capsule for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own suggestion votes" on public.suggestions_capsule;
create policy "Users can insert own suggestion votes"
  on public.suggestions_capsule for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own suggestion votes" on public.suggestions_capsule;
create policy "Users can update own suggestion votes"
  on public.suggestions_capsule for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own suggestion votes" on public.suggestions_capsule;
create policy "Users can delete own suggestion votes"
  on public.suggestions_capsule for delete
  using (auth.uid() = user_id);
