-- Élargit la plage de taille_haut au-delà du standard S–XL jusqu'aux
-- grandes tailles (recette 13/08/2026). taille_bas n'a pas de contrainte
-- CHECK (texte libre) : rien à migrer côté base pour cette colonne, seule
-- la liste de choix côté app (src/lib/profile.ts) change.

alter table public.profiles drop constraint if exists profiles_taille_haut_check;

alter table public.profiles add constraint profiles_taille_haut_check
  check (taille_haut in ('XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', '5XL'));
