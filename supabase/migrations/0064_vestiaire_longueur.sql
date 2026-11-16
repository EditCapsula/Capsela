-- LA LONGUEUR DES PIÈCES DU CATALOGUE (16/11/2026, arbitré par la propriétaire : « une colonne longueur dans le catalogue » ; remplie
-- par un tri d'après le nom des pièces, relu, puis par l'analyse des images pour le reste).
--
-- La même règle que `dressing_items.longueur` (migration 0062) : courte, midi ou longue, facultative. Lue par l'app pour les robes,
-- jupes, manteaux et vestes (forme.ts, vestiaire.ts) ; vide, la pièce reste inconnue, comme avant. Elle permet à R-B25 (la longueur
-- des couches) de jouer pour les manteaux de la capsule, et à « Pour l'extérieur » de proposer un manteau assez long.
--
-- Non destructive, relançable : aucune ligne n'est modifiée. Exécutée à la main le 16/11/2026.

alter table public.vestiaire_universel add column if not exists longueur text;
alter table public.vestiaire_universel drop constraint if exists vestiaire_universel_longueur_check;
alter table public.vestiaire_universel add constraint vestiaire_universel_longueur_check
  check (longueur is null or longueur in ('courte', 'midi', 'longue'));

-- Annulation (retour arrière seulement) :
-- alter table public.vestiaire_universel drop column if exists longueur;
