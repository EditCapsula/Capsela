-- Ajoute "homme" aux valeurs de genre autorisées (recette 18/08/2026 —
-- duplication d'articles unisexe en paires femme/homme pour des visuels
-- correctement genrés).

alter table public.vestiaire_universel drop constraint if exists vestiaire_universel_genre_check;
alter table public.vestiaire_universel add constraint vestiaire_universel_genre_check
  check (genre in ('femme', 'homme', 'unisexe'));
