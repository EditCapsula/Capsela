# Les visites guidées

Mises en place le 05/11/2026 (Driver.js 1.10.2). Contenus validés le même jour par la propriétaire. Principe : une découverte
progressive et non intrusive — une courte visite par écran clé, à la première ouverture, jamais un tutoriel sur chaque page.

## Les visites

| Visite | Écran | Étapes (cible `data-tour`) |
| --- | --- | --- |
| Découvrir Aujourd'hui | Accueil | `accueil-tenue` · `accueil-autre-tenue` · `jour-meteo` |
| Découvrir ton Dressing | Dressing | `dressing-ajouter` · `dressing-filtres` |
| Découvrir ta Capsule | Capsule | `capsule-saison` · `capsule-onglets` · `capsule-planche` |

Les textes sont dans `src/lib/visites.ts` (traduits par `src/lib/traductions/en.ts`). Boutons : « Suivant », « Retour »,
« C'est parti » (dernière étape), « Passer » (à tout moment).

## Architecture

- `src/lib/visites.ts` — toute la configuration : visites, écrans, étapes, ordre ; `visiteAMontrer` (testée) décide quelle visite
  lancer.
- `src/lib/memoireVisites.ts` — la mémoire sur l'appareil (`capsela.visites.<compte>`, effacée avec les données locales) et la
  demande de relance venue de l'Aide.
- `src/components/VisiteGuidee.tsx` — le SEUL composant qui manipule Driver.js, monté une fois dans `App.tsx`.
- Les écrans ne portent que des attributs `data-tour` ; le style de l'infobulle est dans `globals.css`
  (`.driver-popover.capsela-visite`), sur les tokens du design system.

## Déclenchement

- Une visite se lance à la première ouverture de son écran, une fois le compte prêt (connexion, profil chargé, questionnaire
  terminé) — y compris pour les comptes créés avant le 05/11/2026.
- Elle attend que l'écran se soit affiché (900 ms) et que sa première cible existe (4 s au plus). Les étapes dont l'élément est
  absent (dressing vide, autre onglet) sont sautées ; sans aucune cible, la visite n'est ni lancée ni marquée vue.
- Fermée de n'importe quelle façon (« Passer », « C'est parti », le voile, Échap, le Retour d'Android, un changement d'écran),
  elle est marquée vue : d'abord sur l'appareil, puis dans le compte (`profiles.prefs.visitesVues`, sans migration : `prefs` est
  déjà un JSON). Une visite vue ne revient pas, sur aucun appareil.
- Relance : Gérer mon compte → Support → « Aide » ouvre la liste des visites ; en choisir une ouvre son écran et la rejoue, même
  déjà vue. « Nous contacter » ouvre un e-mail à capsela.app@gmail.com.
- « Réinitialiser mes préférences » garde les visites vues.
