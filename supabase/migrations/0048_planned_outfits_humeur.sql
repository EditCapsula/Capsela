-- « Une dernière préférence ? » du parcours Planifier (07/10/2026) : l'humeur d'un événement (élégante, féminine,
-- décontractée, audacieuse, confortable). Nullable : « Aucune préférence » n'écrit rien. Ce n'est PAS un style du profil.
-- Le type de lieu existe déjà (colonne type_lieu, migration 0030) : aucune colonne location_type n'est ajoutée.
-- À exécuter à la main dans l'éditeur SQL. L'app fonctionne avant : la tenue est gardée sans préférence et l'échec est signalé.

alter table public.planned_outfits
  add column if not exists mood_style text
  check (mood_style is null or mood_style in ('elegant', 'feminin', 'decontracte', 'audacieux', 'confortable'));
