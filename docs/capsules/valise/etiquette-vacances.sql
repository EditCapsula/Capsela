-- L'étiquette « vacances » sur les pièces réservées à la valise (07/11/2026, brief « Création de l'occasion Vacances », étape 2).
-- Ajoute à la colonne `occasions` la valeur « vacances » et les activités que la pièce sert ; les occasions déjà présentes sont gardées
-- telles quelles (rien n'est retiré ni remplacé). Les valeurs ajoutées sont ignorées par le moteur de tenues, qui ne lit que les
-- occasions de Capsela : le comportement ne change pas, l'app reconnaît seulement ces pièces à leur étiquette plutôt qu'à leur type.
-- Aucune ligne créée ni supprimée, aucune image touchée. Sans effet sur une ligne déjà étiquetée : on peut le relancer.
-- À lancer à la main dans l'éditeur SQL de Supabase.

-- 0. Contrôle avant : les pièces concernées et leurs occasions actuelles.
select id, name, genre, sous_type, occasions
  from vestiaire_universel
 where sous_type in ('Maillot de bain', 'Short de bain', 'Surchemise de plage', 'Chemise de plage', 'Kimono de plage', 'Chaussures de randonnée')
 order by sous_type, genre, id;

-- 1. Tenues de bain : plage, piscine, spa.
update vestiaire_universel
   set occasions = concat_ws(',', nullif(trim(occasions), ''), 'vacances,plage,piscine,spa')
 where sous_type in ('Maillot de bain', 'Short de bain')
   and coalesce(occasions, '') not ilike '%vacances%';

-- 2. Surchemises, chemises et kimonos de plage : plage, piscine.
update vestiaire_universel
   set occasions = concat_ws(',', nullif(trim(occasions), ''), 'vacances,plage,piscine')
 where sous_type in ('Surchemise de plage', 'Chemise de plage', 'Kimono de plage')
   and coalesce(occasions, '') not ilike '%vacances%';

-- 3. Chaussures de randonnée : randonnée.
update vestiaire_universel
   set occasions = concat_ws(',', nullif(trim(occasions), ''), 'vacances,randonnee')
 where sous_type = 'Chaussures de randonnée'
   and coalesce(occasions, '') not ilike '%vacances%';

-- 4. Contrôle après : chaque ligne porte « vacances », ses occasions d'avant en tête.
select id, name, sous_type, occasions
  from vestiaire_universel
 where coalesce(occasions, '') ilike '%vacances%'
 order by sous_type, genre, id;

-- Annulation (retour arrière) : retire exactement ce qui a été ajouté.
-- update vestiaire_universel set occasions = nullif(regexp_replace(occasions, ',?vacances(,(plage|piscine|spa|randonnee))*$', ''), '')
--  where coalesce(occasions, '') ilike '%vacances%';
