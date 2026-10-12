# Le motif d'une pièce (11/10/2026)

**Phase 1 : lire, afficher, corriger. Le moteur de tenues ne lit PAS le motif.**

## Ce qui existe
- Huit valeurs : Uni, Rayures, Carreaux, Pois, Fleurs, Animalier, Graphique, Autre (`src/lib/motifs.ts`, miroir Deno dans `supabase/functions/_shared/enumsPiece.ts`, test de miroir).
- Lecture sur la photo par `analyze-dressing-photo` (Ajouter une pièce) et `importer-tenue` (Importer une tenue). Le modèle répond `null` dans le doute : un motif douteux n'est pas présenté comme détecté. Un bijou n'a pas de motif.
- Correction dans « Ajouter / modifier une pièce » (puces, « Rétablir ») et dans l'accordéon d'« Importer une tenue » ; affichage en puce « Motif » sur la fiche pièce.
- Colonne `dressing_items.motif` (migration `0051_motif.sql`, À EXÉCUTER À LA MAIN). Écriture isolée (`updateDressingItemMotif`, jamais dans `itemToRow`) : avant la migration, tout le reste se sauvegarde et l'échec du motif est signalé à l'écran.

## Ce qui n'existe pas (phase 2, non engagée)
Aucune règle d'association de motifs (deux motifs forts, motif et couleur…). Elle demande un ARBITRAGE ÉDITORIAL de style puis une mesure sur le catalogue (règle d'audit, points 3 à 7).

## Limites connues
- Fiabilité de la lecture : NON DÉMONTRÉE sur photos réelles.
- Sur une pièce à motif, la « couleur principale » lue reste la teinte dominante ; elle peut différer de ce que l'on nomme à l'œil.

## Tant que la migration 0051 n'est pas exécutée (12/10/2026)
L'app sait si la colonne existe (`motifDisponible`, `dressing.ts`) : au chargement du dressing (une ligne sans clé `motif`) ou au premier refus de la base (PGRST204). Colonne absente : le motif n'est plus proposé (ajout, import), plus rien n'est écrit et aucune erreur technique n'est affichée (avant : bandeau rouge « Could not find the 'motif' column »). Un motif déjà lu sur une photo n'est alors pas enregistré — la fonctionnalité attend la migration.
