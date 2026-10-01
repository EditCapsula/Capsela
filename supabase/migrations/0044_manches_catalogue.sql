-- La longueur des manches des pièces du catalogue (01/10/2026).
-- Renseignée à la main par la propriétaire (fichier manches-a-renseigner), 116 pièces
-- sur 282 ; les 166 autres restent à NULL et sont traitées comme aujourd'hui.
-- Idempotent : ne touche que les lignes encore à NULL et ne dépend que de la
-- colonne ajoutée par 0042. À exécuter À LA MAIN dans l'éditeur SQL Supabase.

update public.vestiaire_universel set manches = 'sans'
where manches is null and id in (450, 453, 491, 529, 531, 545, 547, 561, 589, 590, 600, 630, 633, 641, 643, 658, 659, 663, 689, 699, 703, 712, 716, 759, 760, 761, 763, 767, 779, 1074, 1079);  -- 31 pièces

update public.vestiaire_universel set manches = 'courtes'
where manches is null and id in (448, 449, 451, 501, 502, 521, 530, 532, 533, 535, 544, 548, 559, 560, 563, 573, 585, 586, 607, 608, 612, 613, 632, 634, 647, 648, 660, 668, 669, 710, 711, 713, 714, 715, 764, 778, 1064, 1080);  -- 38 pièces

update public.vestiaire_universel set manches = 'longues'
where manches is null and id in (452, 526, 527, 528, 534, 536, 562, 564, 565, 566, 572, 587, 588, 609, 610, 611, 631, 649, 650, 670, 671, 706, 726, 749, 762, 855, 856, 869, 890, 927, 928, 937, 946, 951, 959, 965, 992, 993, 1004, 1007, 1014, 1020, 1037, 1059, 1061, 1063, 1076);  -- 47 pièces

-- Contrôle : doit renvoyer sans = 31, courtes = 38, longues = 47 (et 166 à NULL sur ces catégories).
select manches, count(*) from public.vestiaire_universel group by manches order by manches;
