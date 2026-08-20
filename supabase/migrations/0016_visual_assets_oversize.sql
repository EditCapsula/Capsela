-- La cascade générique de réutilisation (step 3 : genre + sous_type +
-- couleur, sans lire visual_key) ignorait la coupe : une base ajustée et un
-- calque oversize du même sous_type/couleur/genre se faisaient réattribuer
-- le même asset dès que l'un des deux existait, malgré le suffixe
-- "oversize" désormais présent dans visual_key (qui ne joue que pour le
-- match exact, step 2). Colonne dédiée pour que step 3 puisse filtrer
-- explicitement dessus, comme il le fait déjà pour genre/sous_type/couleur.
alter table public.visual_assets add column if not exists oversize boolean not null default false;
