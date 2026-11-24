# Deutschweg

Parcours d’allemand A1.1, A1.2 et A2.1. L’application réunit les leçons enregistrées, le PDF synchronisé, les exercices et le suivi des progrès.

`npm run build` prépare l’interface dans `public/`. Le dépôt contient le code de l’application. Les données de cours, les PDF, les vidéos et les audios sont servis en lecture depuis le stockage privé existant par une fonction Vercel.

Le projet Vercel utilise l’authentification Vercel pour protéger les déploiements de prévisualisation. La variable secrète `DEUTSCHWEG_MEDIA_TOKEN` est réservée à cet environnement. Le serveur transmet les requêtes de plage nécessaires à la lecture de la vidéo et conserve les réponses privées.

Les progrès sont enregistrés par le navigateur. Pour les récupérer sur un autre domaine, exporte-les depuis les réglages de l’ancien site, puis importe la sauvegarde sur la nouvelle adresse.
