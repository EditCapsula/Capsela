# Détourage des photos du dressing

Créé le 04/10/2026, à la demande de la propriétaire (« l'API Détourage de photos »). Périmètre arbitré : **à l'ajout d'une pièce**. Envoi des photos de vêtements à un fournisseur tiers : **accepté** (04/10/2026), à dire dans les textes légaux (voir « À faire avant le lancement »).

## Ce que ça fait

Quand une personne photographie une pièce, le fond est retiré : la pièce se mêle alors aux visuels détourés du catalogue dans les compositions de tenue, au lieu d'apparaître comme une photo carrée à part.

```text
photo choisie → compression (JPEG, 1 200 px) → envoi dans le stockage privé → analyse (OpenAI, lit l'ORIGINAL)
                                                                                    ↓
                       photo détourée affichée ← Edge Function detourer-photo ← (une fois l'analyse terminée)
                       (l'original est supprimé par l'app)
```

Jamais bloquant : si le détourage n'est pas branché, si le plafond du jour est atteint, si la photo est refusée ou si le réseau tombe, **la photo d'origine reste** et l'ajout continue. L'écran ne dit rien de faux : « retire le fond… » n'apparaît que pendant l'appel, « Le fond de ta photo a été retiré » que quand la photo affichée est bien la détourée.

## Où c'est dans le code

| Quoi | Où |
| --- | --- |
| L'appel au service, la lecture du type d'image, le nommage | `supabase/functions/_shared/detourage.ts` (pur, testé) |
| La fonction serveur | `supabase/functions/detourer-photo/index.ts` |
| L'appel côté app, `estPhotoDetouree` | `src/lib/dressing.ts` (`detourerPhoto`) |
| L'enchaînement à l'ajout | `src/lib/store.tsx` (`uploadAddPhoto`, état `addPhotoDetourage`) |
| L'affichage | `catalogImages.ts` (`resolveItemImage` rend `kind: "detouree"`, `fondPhotoPiece`), `AddScreen.tsx`, `PieceScreen.tsx`, `WardrobePiecesScreen.tsx`, `CreateLookScreen.tsx` ; les compositions (`OutfitComposition.tsx`) traitent déjà toute image non « photo » comme un visuel détouré |
| Les essais | `src/lib/__tests__/detourage.test.ts` |

## Choix de conception

- **Aucune migration.** Une photo détourée est reconnue au nom de son fichier (`{user}/{uuid}.detouree.webp`), pas à une colonne : la fonctionnalité marche avant toute migration, comme l'exige le projet. Le fichier reste dans le dossier de la personne : la politique du bucket, `urlPhotoAutorisee` et `delete-account` le couvrent sans changement.
- **L'original est supprimé par l'app, jamais par le serveur.** Si la personne enregistre sa pièce pendant le détourage, elle porte encore l'original : le serveur qui l'effacerait casserait sa photo. L'app ne le supprime que si la photo en cours est bien remplacée.
- **L'analyse passe avant.** Elle lit la photo d'origine (les couleurs réelles) ; le détourage vient ensuite.
- **WebP à fond transparent**, 800 px au plus (`toWebp`, comme le catalogue) ; repli sur le PNG si la conversion échoue.
- **Affichage** : une photo détourée se montre entière (`contain`) sur la tuile, jamais recadrée comme une photo réelle (`cover`) : elle serait tronquée.

## Protection et coût

Même protection qu'`analyze-dressing-photo` : personne connectée, photo qui est la sienne, plafond par compte et par jour (`consommer_edge_quota`, fonction `detourer-photo`, 10 par défaut, secret `MAX_DETOURAGES_PER_USER_PER_DAY`). **ARBITRAGE ÉDITORIAL provisoire** : le plafond est le seul garde-fou financier ; réserver le détourage à Premium, ou le lier à la vidéo récompensée, n'est pas décidé (question posée le 04/10/2026, sans réponse).

Coût indicatif : 0,02 $ par image chez Photoroom (plan Basic), plus un éventuel minimum mensuel (voir plus bas) ; non vérifié sur la page des tarifs, inaccessible depuis le conteneur de développement.

## Ce qui est confirmé, et ce qui ne l'est pas (04/10/2026)

Le site et la documentation de Photoroom sont BLOQUÉS depuis le conteneur de développement : ce qui suit vient d'extraits de pages et de comparatifs (recherche web), pas d'une lecture des pages elles-mêmes.

**Confirmé par les extraits de la documentation du fournisseur** : le point d'entrée `https://sdk.photoroom.com/v1/segment`, l'en-tête `x-api-key`, le champ `image_file`, un retour **PNG à fond transparent par défaut**, des entrées jusqu'à 25 mégapixels et 50 Mo (le contrat que `_shared/detourage.ts` implémente). Prix : **0,02 $ par image** sur le plan Basic, 10 images gratuites par mois.

**DÉMONTRÉ** : le comportement de notre code face à chaque réponse possible du fournisseur, par des essais avec un faux réseau.

**NON DÉMONTRÉ** :
- **L'appel réel** : aucun essai n'a été fait, faute de clé.
- **La qualité du détourage** sur de vrais vêtements (voiles, mailles, bijoux fins, chaussures sur fond clair). Les comparatifs qui la vantent émanent du fournisseur.
- **Un minimum mensuel** : les plans Basic semblent commencer vers 20 $ par mois (récapitulatif tiers) ; non confirmé sur la page des tarifs.
- **Le contrat de traitement des données (RGPD)** : le fournisseur se déclare conforme (SOC 2 Type 2) et dit effacer les images après chaque appel, mais héberge sur GCP et AWS **sans résidence de données européenne annoncée**, et ne semble proposer un contrat de traitement qu'en Enterprise. À obtenir et à lire avant le lancement.
- **Les conditions d'utilisation du plan Basic** pour une application grand public.

**Avant de s'engager** : essayer sur dix vraies pièces difficiles avec les 10 images gratuites. Le fournisseur est isolé dans `_shared/detourage.ts` : en changer (Bria via fal.ai à 0,018 $, remove.bg) ne touche que ce fichier.

## À faire avant le lancement

1. Créer le compte chez le fournisseur et poser le secret **`PHOTOROOM_API_KEY`** (Supabase → Edge Functions → Secrets). Sans lui, la fonction répond `non_configure` et rien ne change pour les utilisatrices.
2. Déployer : le workflow « Déployer les fonctions Supabase » le fait à la fusion dans `main`.
3. **Essayer sur quelques vraies photos** (vêtement clair sur fond clair, maille, sac, chaussures) avant d'ouvrir à tous ; relire la documentation du fournisseur contre `_shared/detourage.ts`.
4. Dire dans la **politique de confidentialité** et les **mentions légales** que les photos de vêtements sont traitées par un sous-traitant, lequel, où, combien de temps (les textes sont encore à compléter, `src/lib/legal/contenu.ts`).
5. Décider **qui paie** (plafond seul, Premium, vidéo récompensée).
