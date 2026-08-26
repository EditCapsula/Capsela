-- Referme le journal de génération d'images (audit avant lancement,
-- 26/08/2026). La politique de la migration 0011 était en `using (true)` :
-- n'importe qui, même non authentifié, pouvait lire les clés visuelles, les
-- coûts estimés, les motifs d'erreur et les volumes quotidiens. Ce ne sont
-- pas des données personnelles, mais c'est de la télémétrie financière — elle
-- n'a rien à faire en accès public.
--
-- Aucune politique de remplacement : la table n'est lue par personne côté
-- client (vérifié sur src/ et scripts/), et la fonction Edge
-- generate-catalog-image y écrit avec la clé service_role, qui contourne RLS.
-- RLS restant activé sans aucune politique, la table devient inaccessible
-- depuis les clés anonyme et authentifiée, ce qui est l'état voulu.
--
-- Si une page d'administration doit un jour la lire, ajouter une politique
-- restreinte à un rôle admin plutôt que de rétablir `using (true)`.

drop policy if exists "Anyone can read image_generation_logs" on public.image_generation_logs;
