-- Mise en valeur et coupes préférées (31/10/2026, brief « Évolution de l'onboarding Capsela »,
-- docs/onboarding-evolution/diagnostic-et-proposition.md § 2.3).
--
-- UNE COLONNE JSONB NULLABLE, sur le modèle de `colorimetrie` (0034). Forme écrite par l'app :
--   {"version":1,"miseEnValeur":["taille","jambes"] | [] | null,"coupes":["fluides"] | [] | null}
-- `null` (colonne ou champ) = question jamais posée ; `[]` = « aucune préférence » déclarée. La
-- différence est conservée, d'où aucune valeur par défaut : les profils existants restent à null.
--
-- RLS : les politiques de `profiles` (0001, lecture / insertion / mise à jour par la propriétaire de
-- la ligne) couvrent la colonne. Rien à ajouter.
--
-- Avant cette migration, l'app fonctionne : la colonne est écrite à part (auth.tsx, saveProfile),
-- jamais avec le reste du profil, et son échec est signalé à l'écran.

alter table public.profiles
  add column if not exists preferences_silhouette jsonb;

-- RETOUR ARRIÈRE (efface les réponses données depuis) :
-- alter table public.profiles drop column if exists preferences_silhouette;
