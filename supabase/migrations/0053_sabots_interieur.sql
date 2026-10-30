-- LES CHAUSSURES D'INTÉRIEUR DEVIENNENT DES SABOTS FOURRÉS EN DAIM (30/10/2026, modèle choisi par la propriétaire : les chaussons en
-- éponge d'avant faisaient « démodé »). Le prompt de génération (imagePrompt.ts) et la clé visuelle (« sabots_fourres », visualKey.ts)
-- ont changé. Ce SQL détache l'ancien visuel des pièces concernées pour que scripts/generate-all-catalog-images.mjs, qui ne traite que
-- les lignes sans image, les régénère.
--
-- À exécuter À LA MAIN dans l'éditeur SQL, APRÈS le déploiement de generate-catalog-image. D'abord la lecture, pour voir les pièces
-- touchées ; puis la mise à jour. Les anciens visual_assets restent en base, intacts : rien n'est supprimé.

-- 1. Lecture : les pièces qui changeront.
select id, name, couleur_dominante, url_image
from public.vestiaire_universel
where lower(sous_type) = 'chaussures d''intérieur'
   or name ~* '(chausson|charentaise|pantoufle)';

-- 2. Mise à jour : l'image est détachée, la génération suivante la refait.
update public.vestiaire_universel
set url_image = null,
    url_image_hero = null,
    visual_asset_id = null,
    image_status = 'missing'
where lower(sous_type) = 'chaussures d''intérieur'
   or name ~* '(chausson|charentaise|pantoufle)';
