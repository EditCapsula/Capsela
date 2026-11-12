-- Le centre de notifications (12/11/2026, brief « Implémentation du centre de notifications »).
--
-- Une ligne par événement et par personne. `dedup_key` dit l'événement (« valise:2026-12-03:Milan:a_completer »,
-- « piece_ajoutee:812 »…) : la contrainte unique (user_id, dedup_key) fait qu'un événement déjà noté n'est jamais noté deux fois,
-- même détecté à chaque ouverture de l'app ou sur deux appareils. Les écritures passent par un upsert qui ignore les doublons.
--
-- `target_url` : l'app n'a pas d'URL (une seule page, navigation par état) ; le champ porte la destination interne
-- (« valise:<id> », « piece:<id> », « looks », « planifier », « profil »), que l'app traduit en action du store.
--
-- L'application fonctionne AVANT cette migration : les notifications restent sur l'appareil et repartent vers le compte à la
-- visite suivante. Suppression du compte : ON DELETE CASCADE sur auth.users. Modèle RLS aligné sur suggestions_capsule (0056).
-- Réversible : `drop table public.notifications;` (les notifications restent sur les appareils).

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  category text not null check (category in ('actions', 'conseils', 'valise')),
  title text not null,
  message text not null default '',
  target_url text,
  is_read boolean not null default false,
  read_at timestamptz,
  dedup_key text not null,
  metadata jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, dedup_key)
);

create index if not exists notifications_user_date_idx
  on public.notifications (user_id, created_at desc);

create index if not exists notifications_non_lues_idx
  on public.notifications (user_id) where not is_read;

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
  on public.notifications for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on public.notifications;
create policy "Users can delete own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);
