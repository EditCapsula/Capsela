-- Enrichissement de vestiaire_universel suite au premier jeu de données réel
-- (export "vestiaire_universel_corrigé", 14/08) : plusieurs colonnes utiles
-- au moteur de règles n'existaient pas encore, et la contrainte sur
-- `matiere` était trop stricte pour des descriptions de contenu réelles
-- (ex. "Maille fine", "lin, jean"). Additif/idempotent.

alter table public.vestiaire_universel add column if not exists statement boolean null;

alter table public.vestiaire_universel add column if not exists coupe text null;
alter table public.vestiaire_universel
  drop constraint if exists vestiaire_universel_coupe_check;
alter table public.vestiaire_universel
  add constraint vestiaire_universel_coupe_check
  check (coupe is null or coupe in ('Serré', 'Ajusté', 'Ample'));

alter table public.vestiaire_universel add column if not exists metal_dominant text null;
alter table public.vestiaire_universel
  drop constraint if exists vestiaire_universel_metal_dominant_check;
alter table public.vestiaire_universel
  add constraint vestiaire_universel_metal_dominant_check
  check (metal_dominant is null or metal_dominant in ('or', 'argent'));

-- Rôle de la couleur dans la palette personnelle du profil (base/neutres/
-- accents, cf. migration 0004 et 0005) — pas encore consommé par le moteur
-- de sélection de capsule, colonne posée en avance pour ne pas perdre la
-- donnée déjà saisie.
alter table public.vestiaire_universel add column if not exists role_couleur_palette text null;
alter table public.vestiaire_universel
  drop constraint if exists vestiaire_universel_role_couleur_palette_check;
alter table public.vestiaire_universel
  add constraint vestiaire_universel_role_couleur_palette_check
  check (role_couleur_palette is null or role_couleur_palette in ('base', 'neutre', 'accent'));

alter table public.vestiaire_universel add column if not exists couleur_secondaire text null;

-- Lien affilié — alimente le bouton "Acheter" sur l'écran Capsule.
alter table public.vestiaire_universel add column if not exists lien_affiliation text null;

-- La contrainte initiale (migration 0003) forçait une seule valeur exacte
-- parmi 7 ; les données réelles combinent plusieurs matières ou utilisent
-- des descriptions plus fines ("Maille fine", "Grosse maille"). Colonne
-- laissée libre, interprétée côté app (vestiaire.ts, lecture souple avec
-- repli sur detectMatiere).
alter table public.vestiaire_universel
  drop constraint if exists vestiaire_universel_matiere_check;
