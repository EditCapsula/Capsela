-- La version de l'application publiée dans chaque store (17/11/2026, demandé : « si j'ai une mise à jour à faire de l'application,
-- l'information doit être affichée dans l'application avec redirection vers la fiche de l'application dans le store »).
--
-- Une ligne par plateforme. `numero` est le numéro de build (versionCode Android, numéro de build iOS : le numéro du run des workflows
-- de build), c'est lui que l'app compare au sien ; `version` est le nom affiché (« 2.7 ») ; `url` la fiche du store (sans elle, l'app
-- ouvre la fiche Google Play connue ; pour iOS, sans adresse, aucune notification). À mettre à jour quand une version est disponible
-- dans le store — pas avant : la notification invite à télécharger ce qui existe.
--
-- Lecture ouverte (la même pour tous, aucune donnée personnelle) ; écriture réservée à l'éditeur SQL (aucune politique d'écriture).
-- L'application fonctionne AVANT cette migration : la lecture échoue en douceur et aucune notification n'est créée.
-- Réversible : `drop table public.versions_app;`.

create table if not exists public.versions_app (
  plateforme text primary key check (plateforme in ('android', 'ios')),
  version text not null,
  numero integer not null check (numero > 0),
  url text,
  mise_a_jour_le timestamptz not null default now()
);

alter table public.versions_app enable row level security;

drop policy if exists "versions_app lecture" on public.versions_app;
create policy "versions_app lecture" on public.versions_app for select using (true);
