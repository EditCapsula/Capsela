-- Le nombre de mises à plat réussies par compte (23/11/2026, demandé : « pour les gratuits… deux pièces uniquement ; cela ne libère pas
-- une place même en cas de suppression d'une pièce » ; arbitré : chaque mise à plat RÉUSSIE compte, gardée ou non).
--
-- Un compteur qui ne redescend jamais : compter les photos à plat du dressing ne suffisait pas, une pièce supprimée effaçait la trace.
-- Écrit par la fonction `detourer-photo` (clé de service) à chaque mise à plat rendue par Photoroom ; lu par elle pour appliquer la
-- limite de l'offre gratuite (2, _shared/premium.ts), et par l'app pour ouvrir Premium avant d'appeler. Supprimé avec le compte.
--
-- Lecture : la personne, sa seule ligne ; aucune politique d'écriture (seule la clé de service écrit, comme premium_access).
-- La mise à plat est masquée dans l'app tant que le plan Photoroom Plus n'est pas pris : cette table peut attendre jusque-là. Sans elle,
-- un compte gratuit se voit refuser la mise à plat (le serveur échoue en fermant) ; un compte Premium n'est pas concerné.
-- Réversible : `drop table public.mises_a_plat_utilisees;`.

create table if not exists public.mises_a_plat_utilisees (
  user_id uuid primary key references auth.users (id) on delete cascade,
  nombre integer not null default 0 check (nombre >= 0),
  mise_a_jour_le timestamptz not null default now()
);

alter table public.mises_a_plat_utilisees enable row level security;

drop policy if exists "mises_a_plat_utilisees lecture" on public.mises_a_plat_utilisees;
create policy "mises_a_plat_utilisees lecture" on public.mises_a_plat_utilisees for select using (auth.uid() = user_id);
