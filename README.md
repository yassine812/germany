# Deutschweg

Parcours d’allemand A1.1, A1.2 et A2.1. L’application réunit les leçons enregistrées, le PDF synchronisé, les exercices et le suivi des progrès.

`npm run build` prépare l’interface dans `public/`. Le dépôt contient le code de l’application. Les données de cours, les PDF, les vidéos et les audios sont servis en lecture depuis le stockage privé existant par une fonction Vercel.

Le projet Vercel utilise Vercel Authentication avec la protection « All Deployments ». Active cette protection avant de configurer le stockage sur un autre projet. La variable secrète `DEUTSCHWEG_MEDIA_TOKEN` est limitée aux environnements Preview et Production. La fonction transmet les requêtes de plage nécessaires à la lecture des vidéos et désactive la mise en cache partagée des contenus.

Le compte Deutschweg est configuré dans la variable secrète `DEUTSCHWEG_AUTH`. Renseigne `username`, `name`, un `salt` aléatoire de 16 octets, un `hash` de 32 octets dérivé du mot de passe avec scrypt (N=32768, r=8, p=1) et une `key` de signature aléatoire de 32 octets. Encode en hexadécimal les trois champs binaires. Les supports du cours nécessitent une session Deutschweg valide.

Le corrigé des cahiers A1.2 et A2.1 est chargé à l’ouverture du bilan via `/api/workbook-keys`. Les données restent dans la variable Vercel `DEUTSCHWEG_WORKBOOK_KEYS` sous forme de JSON compressé en gzip et encodé en base64. Le JSON est indexé par identifiant du cahier, page du PDF, numéro d’exercice et liste de couples repère-réponse.

Les progrès sont enregistrés par le navigateur. Pour les récupérer sur un autre domaine, exporte-les depuis les réglages de l’ancien site, puis importe la sauvegarde sur la nouvelle adresse.

L’analyse de prononciation s’exécute dans un Web Worker avec [ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/) et le modèle multilingue [ZIPA Small CR-CTC int8](https://huggingface.co/anyspeech/zipa-small-crctc-300k) d’Anyspeech sous licence CC BY 4.0. Le navigateur charge le modèle à la première analyse et traite les prises micro sur l’appareil. `scripts/build-phoneme-references.py` produit les repères phonétiques des voix du site à partir de la même version du modèle.
