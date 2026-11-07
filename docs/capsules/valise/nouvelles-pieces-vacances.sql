-- Cinq pièces de vacances réservées à la valise (07/11/2026, brief « Vacances », décisions validées le même jour) :
--   · une paire de claquettes par genre, pour la plage, la piscine et le spa ;
--   · une robe de plage, femme ;
--   · une veste imperméable par genre, proposée seulement quand une pluie est PRÉVUE (départ dans l'horizon de prévision, 4 jours).
-- Claquettes sans matière (07/11/2026) : « Synthétique » se décrit « synthetic fabric », faux pour une paire moulée.
-- Sans style (comme les chaussures de randonnée), étiquetées « vacances » : jamais dans une capsule ni dans la tenue du jour.
-- Nouvelles lignes seulement, aucune pièce existante modifiée. Visuels : image_status 'missing', générés plus tard, avec accord.
-- À lancer à la main dans l'éditeur SQL de Supabase, une seule fois, APRÈS la mise en ligne du code qui les reconnaît.

-- 0. Précaution : le compteur d'identifiants après le plus grand id existant. Ne modifie aucune ligne.
select setval(pg_get_serial_sequence('vestiaire_universel', 'id'), (select max(id) from vestiaire_universel));

-- 1. Les cinq pièces.
insert into vestiaire_universel (name, category, genre, styles, saison_capsule, sous_type, matiere, couleur_dominante, hex, manches, occasions, niveau_formalite, role_piece, est_basique_capsule, statement, image_status, frozen) values
  ('Claquettes de plage', 'chaussures', 'femme', null, 'Printemps, Été, Automne, Hiver', 'Claquettes', null, 'Sable', '#D9C9B2', null, 'quotidien,cocooning,vacances,plage,piscine,spa', 'decontracte', 'base', false, false, 'missing', false),
  ('Claquettes de plage', 'chaussures', 'homme', null, 'Printemps, Été, Automne, Hiver', 'Claquettes', null, 'Noir', '#2A2724', null, 'quotidien,cocooning,vacances,plage,piscine,spa', 'decontracte', 'base', false, false, 'missing', false),
  ('Robe de plage en coton', 'robes', 'femme', null, 'Printemps, Été', 'Robe de plage', 'Coton', 'Blanc', '#F2EEE6', 'sans', 'quotidien,vacances,plage,piscine', 'decontracte', 'piece_unique', false, false, 'missing', false),
  ('Veste imperméable légère', 'vestes_blazers', 'femme', null, 'Printemps, Été, Automne, Hiver', 'Veste imperméable', 'Nylon', 'Marine', '#3A4152', 'longues', 'quotidien,voyage,vacances', 'decontracte', 'calque', false, false, 'missing', false),
  ('Veste imperméable légère', 'vestes_blazers', 'homme', null, 'Printemps, Été, Automne, Hiver', 'Veste imperméable', 'Nylon', 'Kaki', '#5B5E3C', 'longues', 'quotidien,voyage,vacances', 'decontracte', 'calque', false, false, 'missing', false);

-- 2. Contrôle : les cinq pièces.
select id, name, genre, category, sous_type, occasions, image_status
  from vestiaire_universel
 where sous_type in ('Claquettes', 'Robe de plage', 'Veste imperméable')
 order by sous_type, genre;

-- Annulation (retour arrière seulement, avant toute utilisation) :
-- delete from vestiaire_universel where sous_type in ('Claquettes', 'Robe de plage', 'Veste imperméable')
--    and name in ('Claquettes de plage', 'Robe de plage en coton', 'Veste imperméable légère');
