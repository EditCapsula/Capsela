# Textes légaux — brouillons du 30/09/2026, repassés le 15/10/2026

**BROUILLONS À FAIRE VALIDER PAR UN JURISTE AVANT PUBLICATION.** Ils sont
rédigés à partir de ce que le code fait réellement au 30/09/2026 (inventaire
fichier par fichier), pas d'un modèle générique : chaque phrase qui décrit
un traitement doit rester vraie dans le code. Si le code change (nouveau
prestataire, paiement ouvert, nouvelle donnée), le texte concerné change
avec lui.

| Fichier | Page | Obligatoire pour |
| --- | --- | --- |
| `mentions-legales.md` | Mentions légales | LCEN (art. 6 III) |
| `confidentialite.md` | Politique de confidentialité | RGPD (art. 13), App Store et Google Play (URL publique exigée) |
| `cgu.md` | Conditions générales d'utilisation | Cadre du service, compte, contenus |
| `cgv.md` | Conditions générales de vente (Premium) | Code de la consommation, dès que l'abonnement est vendu |
| `droits-rgpd.md` | Tes droits | RGPD (art. 15 à 22) — version courte, lisible dans l'app |
| `cookies.md` | Cookies et traceurs | Directive ePrivacy, lignes directrices CNIL |

Ton : tutoiement, comme toute l'app.

## Ce qui reste à compléter (`[À COMPLÉTER]`)

Rien de cela n'est dans le code ni dans les docs ; je ne l'ai pas inventé.

1. **Éditeur** : nom ou raison sociale, forme juridique, capital, SIREN/SIRET,
   RCS ou RNE, adresse, numéro de TVA intracommunautaire, directrice de la
   publication. En entreprise individuelle, l'adresse personnelle peut être
   remplacée par celle d'une domiciliation.
2. ~~**Adresse de contact**~~ : capsela.angela@gmail.com, donnée par la
   propriétaire le 22/10/2026 et reportée dans tous les textes.
3. **Région d'hébergement Supabase** (visible dans le tableau de bord :
   Settings → General → Region). Elle décide s'il y a transfert hors UE pour
   la base et les photos.
4. **Domaine public** de l'app (les textes et les stores exigent une URL).
5. **Mode de paiement** de Premium : achat intégré App Store / Google Play,
   ou paiement web (Stripe…). Les CGV en dépendent (facturation,
   remboursement, résiliation).
6. **Médiateur de la consommation** (obligatoire pour vendre à des
   consommateurs : art. L612-1 du Code de la consommation).

## Points à vérifier par le juriste (`[À VÉRIFIER]`)

- Adresses des prestataires (reprises de leurs sites, à contrôler au moment
  de publier).
- Mécanismes de transfert hors UE (Data Privacy Framework, clauses
  contractuelles types) : à confirmer dans les contrats (DPA) de chaque
  prestataire.
- Âge minimum retenu (15 ans dans les brouillons : majorité numérique pour
  le consentement en France, art. 45 de la loi Informatique et Libertés).
- Qualification des données de silhouette et des photos portées (ni
  données de santé ni biométrie au sens de l'art. 9 dans l'usage actuel —
  aucune identification de la personne — mais à confirmer).

## Écarts entre le code et ce que les textes devront pouvoir dire

Relevés en écrivant, par ordre d'importance. État au 01/10/2026.

1. **Export incomplet** : **traité.** `dataExport.ts` inclut désormais les
   tenues planifiées, les valises et les verdicts du jour (une table absente,
   migration non exécutée, donne une liste vide). Le statut Premium et le
   compteur de tenues n'y figurent toujours pas : ce ne sont pas des données
   fournies par l'utilisatrice.
2. **Photo du dressing envoyée avec ses métadonnées** : **traité.**
   `compressDressingPhoto` refuse (`PhotoNonPreparee`) une photo qu'elle ne sait
   pas ré-encoder, et envoie toujours le JPEG ré-encodé. L'arbitrage du
   10/09 (« ne jamais bloquer l'ajout ») cède devant celui-ci.
3. **Liens « Acheter »** : **vérifié le 15/10/2026** — aucune pièce du
   catalogue n'a de `lien_affiliation` (0 ligne). Si des liens sont ajoutés,
   ils devront être signalés comme liens commerciaux.
4. **Inscription** : **traité.** Date de naissance obligatoire, inscription
   refusée sous 15 ans (`ageMinimum.ts`), et « Conditions » et « Politique de
   confidentialité » sont des liens vers les pages publiques `/legal/cgu` et
   `/legal/confidentialite`. « Continuer avec Google » demande la date juste
   après la connexion (`DateNaissanceScreen`) à tout compte connecté sans date
   dont le profil n'est pas terminé ; sous 15 ans, le compte qui vient d'être
   créé est supprimé. Le contrôle est déclaratif : il ne prouve pas l'âge.
5. **Géolocalisation activée d'office** (`geoConsent: true`) : non traité.
   Le navigateur demande l'autorisation, ce qui recueille le consentement ;
   un réglage désactivé au départ serait plus prudent. À arbitrer.
6. **Suppression du compte** : **traité.** Les valises en cache, la dernière
   ville et l'intention d'inscription sont effacées de l'appareil
   (`donneesLocales.ts`). Le choix de mesure d'audience reste : il tient à
   l'appareil.
7. **Consentement à la mesure d'audience sans échéance** : **traité.** Le
   choix expire au bout de six mois (183 jours) et la question est reposée ;
   un choix enregistré avant la règle, sans date, est redemandé une fois.
8. **Sentry** : le stockage des adresses IP se désactive dans le tableau de
   bord Sentry (Settings → Security & Privacy → « Prevent Storing of IP
   Addresses »). Le texte suppose que c'est fait. Hors code : à faire.

## Repasse du 15/10/2026

Les textes ont été relus contre ce que le code fait au 15/10/2026 (fonctions serveur, appels sortants, tables, stockage de
l'appareil). Ce qui avait changé depuis le 30/09, et ce qui a été fait :

**Textes mis à jour**
- **Nouveaux prestataires**, absents des textes : **Photoroom** (détourage des photos du dressing, `detourer-photo`, depuis le
  04/10), **Open-Meteo** (prévisions à 16 jours, températures habituelles et recherche de ville, fonction `weather`, depuis
  09/2026), **restcountries.com** (capitale d'un pays saisi, appelé DIRECTEMENT depuis l'appareil, `weather.ts`). Ajoutés au
  tableau des destinataires de la Politique de confidentialité, avec leurs `[À VÉRIFIER]`.
- **Nouveaux traitements** : le repérage des pièces d'une tenue entière (`importer-tenue` : la photo, qui peut montrer la
  personne, est lue par OpenAI puis découpée ; les découpes non gardées et l'original sont supprimés), le détourage automatique
  à l'ajout, l'humeur d'un look planifié (0048), les retours sur les associations de couleurs (0047). Politique de
  confidentialité, CGU (ce que propose Capsela, contenus, suggestions), « Tes droits ».
- **Stockage de l'appareil** : `capsela.villesRecentes`, `capsela.recommandees.…`, `capsela.accords.…` et
  `capsela.dernierEcran` ajoutés à « Cookies et traceurs ».

**Code corrigé**
- **Export** : les retours sur les associations de couleurs (`accord_retours`, 0047) n'y figuraient pas. Ajoutés
  (`retours_accords_couleurs`, testé).
- **Suppression du compte** : les villes récentes (`capsela.villesRecentes`) et les anciennes check-lists de valise
  (`capsela.valise.check.<id>`) restaient sur l'appareil. Effacées (`donneesLocales.ts`, testé).

**Reste à décider ou à vérifier (avant le lancement)**
- **Photoroom** : contrat de traitement des données (annoncé seulement en offre Enterprise), hébergement sans résidence
  européenne annoncée, durée réelle de conservation des images (cf. `docs/detourage.md`).
- **Open-Meteo** : gratuit pour un usage NON commercial seulement. Une app avec abonnement payant relève du plan commercial :
  à souscrire avant le lancement, avec ses conditions de traitement.
- **restcountries.com** : seul service tiers appelé depuis l'appareil (il reçoit l'adresse IP). Le faire passer par la
  fonction `weather` le retirerait des textes ; non fait.
- **Mise à plat** (Photoroom Flat Lay, générative) : masquée (`NEXT_PUBLIC_MISE_A_PLAT`). Si elle est réactivée, dire dans
  la Politique et les CGU que l'image produite est générée et peut différer de la pièce.
- **Vidéo récompensée** : aucun réseau publicitaire branché (`video-recompense` refuse tout). Le jour où il l'est, les textes
  disent faux (« aucun cookie publicitaire ») : consentement, Cookies et Politique à refaire avant la mise en ligne.

## Pages publiques

Les six textes sont publiés par l'app sur `/legal/<page>` (`mentions-legales`,
`confidentialite`, `cgu`, `droits-rgpd`, `cookies`, `cgv`), rendus à la
compilation depuis ce dossier. Une page qui contient encore un
`[À COMPLÉTER]` ou un `[À VÉRIFIER]` affiche « Version provisoire ». La liste
« Informations légales » de l'app y renvoie, hors CGV (Premium ne s'achète pas
encore).
