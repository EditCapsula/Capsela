# Carrousel de l'accueil (14/10/2026)

Trois tenues par occasion à la place d'une seule : **pour le travail**, **pour ton quotidien**, **pour ta soirée**, dans cet ordre fixe. Carte sur le fond des hero (`--color-hero-background`, #F0E1D9), composition (flat lay) en point focal, repères de pagination dessous.

## Qui occupe quelle slide (`carrousel.ts`, pur, testé)
- La **tenue du jour** du store (`state.outfit`, celle qui porte l'avis, le quota, le plan appliqué) occupe la slide de SON occasion (`slideDeLOccasion` : travail, quotidien, soirée ; « date » compte comme soirée).
- Une **tenue planifiée pour aujourd'hui** prend la PREMIÈRE slide, quelle que soit son occasion ; son libellé est celui du plan (« Look planifié », « Look du jour »).
- Les autres slides sont des **propositions du moteur** (`state.carrousel`) : le même `regen` que la tenue du jour (météo, occasion, règles, diversité) appliqué à l'occasion de la slide, en évitant les tenues déjà montrées. Une slide sans tenue complète n'est pas affichée ; deux slides ne montrent jamais la même tenue (la tenue du jour l'emporte).
- Une occasion hors carrousel (sport, cocooning, voyage…) : seules les propositions s'affichent.
- Un autre jour que le jour même, une tenue passée, le chargement ou l'absence de tenue : la carte seule d'avant (même fond des hero, `--color-hero-background`).

## Actions
- « Sauvegarder » : sur la tenue du jour, l'avis « J'adore » (inchangé) ; sur une proposition, `enregistrerIdeeLook` (sans doublon).
- « Autre idée » : sur la tenue du jour, le comportement d'avant (avis « pas aujourd'hui », quota) ; sur une proposition, `autreIdeeSlide` — une autre proposition pour SON occasion, sans toucher aux autres slides ni au planning. Même quota gratuit.
- « Voir le look » : `consulterTenue` ouvre Tenue sur CETTE tenue (voir plus bas).

## « Voir le look » : la page Tenue, occasion présélectionnée
`consulterTenue(ids, occasion, planId)` ouvre l'écran Tenue sur la tenue de la slide, avec son occasion déjà choisie (les occasions restent changeables) et le fond des hero (`--color-hero-background`, #F0E1D9 depuis le 14/10/2026). La tenue du jour est mise de côté dans `state.consultation` pendant la consultation et RENDUE en quittant Tenue pour un onglet (accueil, dressing, capsule, planifier, journal), sauf si la tenue consultée a été portée entre-temps (elle devient celle du jour). Les écrans ouverts depuis Tenue (fiche d'une pièce…) gardent la consultation. L'application automatique d'un plan est suspendue le temps de la consultation. (Une première version ouvrait une page dédiée ; retirée le 14/10/2026 à la demande de la propriétaire : on doit atterrir sur Tenue.)

## Tirage des propositions
Un effet du store les tire une fois la tenue du jour posée, seulement pour aujourd'hui et accueil affiché ; recalculées si le jour, le dressing, la météo, le profil ou le mode de travail changent, jamais à chaque nouvelle tenue du jour. Rien n'est écrit en base.

## Vérifié (14/10/2026, rendu réel, mode démo, 390 px)
3 slides, aucun débordement horizontal, défilement et repères, « Voir le look » de la slide 2 ouvre la tenue de la slide 2, retour à l'accueil sans changement, « Autre idée » de la slide 3 laisse les trois slides en place.

**NON VÉRIFIÉ** : rendu avec les vraies images (réseau Supabase bloqué dans cet environnement) ; petits écrans (320/360 px) ; tenue planifiée avec alerte météo sur fond clair ; défilement au doigt sur un vrai Android.
