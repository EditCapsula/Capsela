-- La longueur et la couche d'une pièce du dressing (12/11/2026, retour d'une
-- testeuse : « robe longue noire + kimono + manteau court » ; choisi par la
-- propriétaire : les demander à l'ajout de la pièce et les lire sur la photo).
--
--   · longueur : 'courte', 'midi', 'longue' — une robe, une jupe, un manteau ;
--   · couche   : 'structuree', 'fluide'    — une veste (blazer / kimono).
--
-- Elles servent aux règles d'association des tenues (une veste fluide ne se
-- porte pas sous un manteau ; les proportions robe / manteau), à arbitrer et à
-- mesurer avant d'être branchées.
--
-- DEUX COLONNES NULLABLES, AUCUNE VALEUR PAR DÉFAUT : les lignes existantes ne
-- sont pas réécrites, et sans valeur le moteur se comporte comme avant. L'app
-- n'écrit ces colonnes que lorsque l'utilisatrice choisit une valeur ; tant que
-- cette migration n'est pas exécutée, les deux champs ne sont pas proposés et
-- rien d'autre ne casse (formeDisponible, src/lib/dressing.ts).
--
-- Pas de nouvelle politique RLS : « Users can update own dressing items »
-- (0021) couvre déjà ces colonnes comme les autres.

alter table public.dressing_items add column if not exists longueur text;
alter table public.dressing_items drop constraint if exists dressing_items_longueur_check;
alter table public.dressing_items add constraint dressing_items_longueur_check
  check (longueur is null or longueur in ('courte', 'midi', 'longue'));

alter table public.dressing_items add column if not exists couche text;
alter table public.dressing_items drop constraint if exists dressing_items_couche_check;
alter table public.dressing_items add constraint dressing_items_couche_check
  check (couche is null or couche in ('structuree', 'fluide'));
