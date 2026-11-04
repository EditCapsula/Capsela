-- « Je porterai cette tenue » sur la page Look planifié (04/11/2026, demandé ; arbitré : gardé en base). La personne confirme qu'elle
-- prévoit de porter ce look. Ce n'est PAS « porté » : le Journal (outfit_history) ne l'enregistre que le jour même, depuis la tenue
-- du jour. Faux par défaut : les tenues déjà planifiées restent non confirmées.
-- À exécuter à la main dans l'éditeur SQL. L'app fonctionne avant : la confirmation s'affiche, et l'écran dit qu'elle n'a pas pu
-- être gardée. Les règles d'accès existantes (0030 : chacun lit et modifie ses propres lignes) s'appliquent à la colonne.
--
-- Retour arrière : alter table public.planned_outfits drop column if exists confirme;

alter table public.planned_outfits
  add column if not exists confirme boolean not null default false;
