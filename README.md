# Deutschweg

Parcours d’allemand A1.1, A1.2 et A2.1. L’application réunit les leçons enregistrées, le PDF synchronisé, les exercices et le suivi des progrès.

`npm run build` prépare l’interface dans `public/`. Le dépôt contient le code de l’application. Les données de cours, les PDF, les vidéos et les audios sont servis en lecture depuis le stockage privé existant par une fonction Vercel.

Le projet Vercel utilise Vercel Authentication avec la protection « All Deployments ». Active cette protection avant de configurer le stockage sur un autre projet. La variable secrète `DEUTSCHWEG_MEDIA_TOKEN` est limitée aux environnements Preview et Production. La fonction transmet les requêtes de plage nécessaires à la lecture des vidéos et désactive la mise en cache partagée des contenus.

Les progrès sont enregistrés par le navigateur. Pour les récupérer sur un autre domaine, exporte-les depuis les réglages de l’ancien site, puis importe la sauvegarde sur la nouvelle adresse.
