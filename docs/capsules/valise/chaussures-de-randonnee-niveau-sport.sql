-- Chaussures de randonnée : niveau de formalité « sport » (06/11/2026, signalé : deux journées de randonnée d'une valise pour le
-- Cap-Vert sans aucun look). Les deux paires (chaussures-de-randonnee.sql) avaient été créées en 'decontracte' ; une randonnée
-- passe par les règles Sport du moteur, qui n'admettent que des chaussures de niveau sport : la paire était refusée, et la journée
-- restait sans tenue. Mesuré le même jour, même pool, seul ce levier changé : 0 look sur 20 en 'decontracte', 20 sur 20 en 'sport'.
-- Deux lignes modifiées, une seule colonne ; aucune autre pièce touchée. À lancer à la main dans l'éditeur SQL de Supabase.

update vestiaire_universel
   set niveau_formalite = 'sport'
 where id in (1353, 1354)
   and sous_type = 'Chaussures de randonnée';

-- Contrôle : les deux paires, en 'sport'.
select id, name, genre, niveau_formalite from vestiaire_universel where sous_type = 'Chaussures de randonnée' order by id;

-- Annulation : update vestiaire_universel set niveau_formalite = 'decontracte' where id in (1353, 1354);
