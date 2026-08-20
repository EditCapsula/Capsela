-- Correctif 20/08/2026 : marquer un article "tendance" (ou "intemporel")
-- et invalider url_image/image_status ne suffisait pas à faire regénérer
-- une image — la cascade de réutilisation (steps 3/4, indexée sur
-- genre/category/sous_type/couleur) retombait directement sur l'ancien
-- asset déjà "ready" (créé avant l'existence du système de tendance),
-- sans jamais rappeler OpenAI. Cette colonne permet de n'exclure de la
-- réutilisation générique que les assets qui NE correspondent PAS au
-- niveau de tendance demandé, tout en gardant intacte la réutilisation
-- pour les articles restés "contemporain" (comportement identique à
-- avant, jamais de régression sur les assets déjà générés).

alter table public.visual_assets add column if not exists niveau_tendance text;
