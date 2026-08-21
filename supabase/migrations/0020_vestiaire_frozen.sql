-- "Gel" réversible d'un article — demandé le 21/08/2026 : exclure du pool de
-- sélection de l'app (capsule/tenue) sans jamais supprimer la ligne.
-- Colonne booléenne dédiée plutôt que de détourner styles/saison_capsule :
-- ces deux colonnes sont volontairement permissives par défaut (une valeur
-- vide ou non reconnue retombe sur "toutes saisons"/aucune restriction de
-- style, cf. mapSaisonToSeason/styleFit côté app), donc les vider ne
-- garantirait pas l'exclusion — un article pourrait encore être choisi via
-- le repli.
alter table public.vestiaire_universel
  add column if not exists frozen boolean not null default false;

comment on column public.vestiaire_universel.frozen is
  'Gel réversible : true = exclu du pool de sélection app (jamais proposé en capsule/tenue), sans suppression de la ligne.';
