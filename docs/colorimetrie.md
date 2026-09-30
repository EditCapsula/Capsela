# Colorimétrie — questionnaire et photo

Arbitré le 30/09/2026. La demande : « la photo et une alternative
questionnaire ».

## Ce que la fonctionnalité fait

L'étape « Ta colorimétrie » de l'onboarding trouve une **saison** parmi quatre
— Printemps lumineux, Été doux, Automne chaleureux, Hiver contrasté — puis
montre ses couleurs signature, ses neutres et ses couleurs « avec modération »
(plutôt loin du visage). Le résultat entre dans la palette Capsela
(`paletteCapsela`, récapitulatif) et dans le contexte de l'avis de styliste
(`contexteDepuisProfil`).

**Il ne change pas le moteur de tenues.** `paletteHexes(profile)` continue de
rendre toutes les préférences, y compris celles placées « avec modération ».

## Deux chemins, une seule table

| | Questionnaire | Photo |
|---|---|---|
| Disponible | toujours | seulement si `NEXT_PUBLIC_COLORIMETRIE_PHOTO=1` (ou le mock) |
| Entrée | 5 réponses déclarées | une photo de visage, avec consentement |
| Sortie | une saison, ou « ne tranche pas » | une saison, ou un motif d'échec |
| Couleurs | `SAISONS` (`src/lib/colorimetrie.ts`) | `SAISONS`, jamais le modèle |

Les deux chemins rendent une **saison**, jamais une couleur : un service
externe ne peut pas inventer une teinte. Toutes les teintes de `SAISONS` sont
des couleurs de `PAL_COULEURS` (vérifié par les tests).

### Le questionnaire

Cinq questions (`QUESTIONS_COLORIMETRIE`) : bijoux, blanc préféré près du
visage, couleur de cheveux d'origine, couleur des yeux, couleurs qui valent
des compliments. **Aucune ne porte sur la peau.** Chaque réponse ajoute des
points sur deux axes, la chaleur et la profondeur ; `saisonDuQuestionnaire`
les combine. Une chaleur nulle (« Je ne sais pas », « Les deux ») ne tranche
pas : l'écran le dit, et aucune saison n'est inventée.

Les points de chaque réponse et le choix des couleurs de chaque saison sont
un **ARBITRAGE ÉDITORIAL**, à revoir sur des profils réels.

### La photo

- Fonction Edge `analyser-colorimetrie` ; toute la logique dans
  `supabase/functions/_shared/colorimetrie.ts`, testée
  (`colorimetrieServeur.test.ts`).
- Ordre des contrôles : session valide, puis **`consentement === true`**, puis
  JPEG valide (`validerImage`, repris de l'avis de styliste). Aucun appel au
  modèle avant les trois.
- Sortie structurée stricte à deux champs fermés : `qualite` (ok, lumiere,
  filtre, visage_non_visible, plusieurs_personnes) et `saison` (les quatre, ou
  indetermine). Le modèle ne peut écrire aucun texte libre.
- `store: false`, détail d'image `low`, aucune relance automatique, délai de
  30 s. Le journal ne contient que des codes et des comptes de tokens.
- Côté app (`colorimetrieClient.ts`) : la photo est ré-encodée
  (`preparerPhotoAvis`, EXIF et GPS retirés), envoyée une fois, jamais
  téléversée dans le stockage.
- Pas de score de confiance : le badge « Analyse fiable » ne s'affiche donc
  pas.

## Le cadre de l'exception (CLAUDE.md)

La règle du projet interdit toute logique fondée sur la couleur de peau.
L'analyse photo en est la **seule exception**, encadrée par : le consentement
explicite pour chaque photo, la sortie limitée à une saison, les couleurs
tirées de l'app, l'absence de conservation, l'usage réservé à l'affichage, et
l'interrupteur fermé en production tant que la revue juridique n'est pas
faite.

## Avant d'ouvrir la photo en production

1. **Revue juridique** : une photo de visage envoyée à un prestataire hors UE
   peut révéler une donnée sensible (RGPD, article 9). À faire valider : le
   texte du consentement (`EtapesColorimetrie.tsx`), la politique de
   confidentialité, le transfert vers OpenAI et sa durée de rétention côté
   prestataire.
2. **Déployer la fonction** : `supabase functions deploy analyser-colorimetrie`
   (le secret `OPENAI_API_KEY` existe déjà ; `COLORIMETRIE_MODEL` est
   facultatif).
3. **Vérifier la migration 0034** (`profiles.colorimetrie`) — sans elle, le
   résultat ne s'enregistre pas.
4. Poser `NEXT_PUBLIC_COLORIMETRIE_PHOTO=1` dans Vercel.

Sans l'étape 4, l'app ne montre que le questionnaire.

## Limites connues

- Aucune limite d'usage par compte sur la fonction photo : chaque analyse est
  un appel payant. À ajouter si l'usage le justifie.
- La fiabilité du questionnaire et de la photo n'est pas mesurée
  (**NON DÉMONTRÉ**) : le résultat est présenté comme « un repère pour
  t'inspirer, pas une règle ».
