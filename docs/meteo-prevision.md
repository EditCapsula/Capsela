# Météo : prévisions jusqu'à 16 jours et climatologie (09/2026)

**Pourquoi.** Le palier gratuit d'OpenWeather ne donne que 5 jours de prévision (4 retenus). La fonction Edge `weather` interroge désormais **Open-Meteo** (gratuit, sans clé) : prévision horaire sur 16 jours, ramenée à un point toutes les 3 h au fuseau du lieu — la même forme `{ city, country, timezone, slots }` qu'avant, le client ne change pas de lecture. Si Open-Meteo échoue, la branche OpenWeather d'origine répond (5 jours).

**Horizon.** `HORIZON_PREVISION_JOURS = 15` (`prevision.ts`) pour Planifier, Mon planning et la Valise. L'Accueil et Tenue gardent leur navigation sur 4 jours (`JOUR_MAX`, `jourConsulte.ts`) : décision séparée. `joursCouverts` reste la source de vérité du dernier jour réellement rendu.

**Au-delà (aucune prévision fiable n'existe).** `mode=climate` : les températures **habituelles** du lieu à la date (cinq années précédentes, ± 3 jours, via l'API d'archives d'Open-Meteo) : minimale, maximale moyennes et part des jours de pluie. L'écran dit « Températures habituelles à cette date » et ne la présente jamais comme une prévision. Le moteur reçoit la moyenne (`meteoPourLaDate`) ; sans climatologie (démo, réseau, fonction non redéployée), il retombe sur la température habituelle de la saison.

**Cache.** Prévision : 10 minutes par point (latitude et longitude arrondies à 0,01). Climatologie : pour la session, par point et par jour de l'année.

**Déploiement.** La fonction Edge `weather` se redéploie à chaque merge sur `main`. Avant son redéploiement, l'ancienne version répond comme avant : la prévision s'arrête à 5 jours, le client bascule sur la température habituelle de la saison.

**Licence.** Open-Meteo est gratuit pour un usage **non commercial** ; un usage commercial demande son plan payant (open-meteo.com/en/pricing). À régler avant le lancement public.
