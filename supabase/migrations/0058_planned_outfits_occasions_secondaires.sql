-- 0058 — Tenue polyvalente (04/11/2026, brief « Évolution du parcours de planification »).
-- Un moment planifié peut répondre à plusieurs occasions (« Travail » puis « Soirée ») : `occasion` reste l'occasion
-- principale, celle pour laquelle le moteur compose ; les autres sont gardées ici. Colonne ajoutée, rien n'est modifié
-- ni supprimé. L'app la lit et l'écrit à part : avant cette migration, tout fonctionne, seules les autres occasions ne
-- sont pas gardées dans le compte (l'écran le dit).
--
-- Retour arrière : alter table public.planned_outfits drop column if exists occasions_secondaires;

alter table public.planned_outfits add column if not exists occasions_secondaires text[];
