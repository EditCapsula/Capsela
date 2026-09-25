-- Colorimétrie du profil (onboarding couleurs, 25/09/2026).
--
-- UNE COLONNE JSONB PLUTÔT QUE SEPT COLONNES. Le résultat d'analyse est un
-- objet dont la forme dépend du service : `moderation` et `confiance` sont
-- optionnels — l'écran n'affiche le groupe « Plutôt loin du visage » et le
-- badge « Analyse fiable » QUE s'ils sont présents. Sept colonnes nullables
-- rendraient « absent » et « vide » indistinguables, alors que la différence
-- est précisément ce qui décide de l'affichage.
--
-- `palette_affinite` N'EST PAS SUPPRIMÉE. L'étape « tons chauds / tons
-- froids » quitte l'onboarding parce qu'une affinité déclarée n'est pas une
-- colorimétrie — mais des profils l'ont renseignée, et la colonne continue
-- d'être lue. Plus rien ne l'écrit. La supprimer se décidera séparément,
-- quand plus rien ne la lira non plus.
--
-- `palette_neutres` et `palette_accents` : déjà supprimées par 0018, rien à
-- faire ici. Vérifié avant d'écrire cette migration.

alter table public.profiles
  add column if not exists colorimetrie jsonb not null default '{"statut":"aucune"}'::jsonb;

-- Le statut est la seule clé dont le code dépend inconditionnellement : la
-- contrainte porte sur elle et sur rien d'autre, pour que la forme du reste
-- puisse évoluer avec le service sans migration.
alter table public.profiles drop constraint if exists profiles_colorimetrie_statut_check;
alter table public.profiles add constraint profiles_colorimetrie_statut_check
  check (colorimetrie ->> 'statut' in ('aucune', 'encours', 'faite', 'erreur'));
