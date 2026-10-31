-- Style Créatif — 04 : étiqueter le SPORT COMMUN avec tous les styles (option C2, validée le 31/10/2026).
-- À lancer à la main dans l'éditeur SQL, AVANT la mise en ligne du sport par étiquette (fusion de la PR) : une fois le code en ligne,
-- une pièce de sport n'entre dans une capsule que si elle porte le style du profil ; ces pièces, qui entrent aujourd'hui dans toutes
-- les capsules, doivent donc porter tous les styles. Mesuré (scripts/creatif-sport.audit.ts) : avec la règle actuelle, ce fichier ne
-- change aucune capsule (scénario S6) ; avec la nouvelle, non plus (S4).
--
-- Pièces : 491 Brassière de sport (femme) · 493 Sweat à capuche (femme) · 494 Legging de sport (femme) · 495 Jogging (femme)
--          522 Sweat à capuche (homme) · 523 Legging de sport (homme) · 524 Jogging (homme)
-- (521 T-shirt technique, 971 et 972 Baskets de sport portent déjà tous les styles.)
-- Ajout seulement : aucun style retiré, aucune autre colonne touchée. Idempotent : un style déjà présent n'est pas rajouté.

update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Minimaliste' else styles || ', Minimaliste' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Minimaliste%';
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Casual chic' else styles || ', Casual chic' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Casual chic%';
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Classique chic' else styles || ', Classique chic' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Classique chic%';
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Romantique' else styles || ', Romantique' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Romantique%';
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Bohème' else styles || ', Bohème' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Bohème%';
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Streetwear' else styles || ', Streetwear' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Streetwear%';
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Preppy' else styles || ', Preppy' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Preppy%';
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Glamour' else styles || ', Glamour' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Glamour%';
update vestiaire_universel set styles = case when coalesce(styles, '') = '' then 'Créatif' else styles || ', Créatif' end
where id in (491, 493, 494, 495, 522, 523, 524) and coalesce(styles, '') not like '%Créatif%';

-- Contrôle : chaque pièce de sport COMMUNE du catalogue doit porter les neuf styles (la gourde, sans style, entre toujours ; les pièces
-- de sport propres au Créatif, créées par 05, ne portent que « Créatif » et sont exclues du contrôle). Attendu : aucune ligne.
select id, name, styles from vestiaire_universel
where niveau_formalite = 'sport' and coalesce(styles, '') <> '' and styles <> 'Créatif'
  and not (styles like '%Minimaliste%' and styles like '%Casual chic%' and styles like '%Classique chic%' and styles like '%Romantique%'
           and styles like '%Bohème%' and styles like '%Streetwear%' and styles like '%Preppy%' and styles like '%Glamour%' and styles like '%Créatif%');
