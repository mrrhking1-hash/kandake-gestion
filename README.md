# Kandake Gestion — Maison & Beauté

PWA de pilotage de la boutique : caisse, stocks, ventes, finances et réglages.
Application 100 % statique (HTML/CSS/JS), fonctionne hors connexion grâce à un
service worker.

## Accès

L'application est publiée via GitHub Pages :

**https://<utilisateur>.github.io/kandake-gestion/**

Sur mobile, ouvrir le lien puis « Ajouter à l'écran d'accueil » pour l'installer
comme une application.

## Structure

| Chemin | Rôle |
| --- | --- |
| `index.html` | Shell unique de la SPA (routage par hash) |
| `views/*.html` | Fragments de vue injectés par le routeur |
| `js/app.js`, `js/router.js` | Logique applicative et routage |
| `js/views/*.js` | Contrôleurs de vue |
| `sw.js` | Service worker (précache + hors-ligne) |
| `manifest.json` | Manifeste PWA (icônes, raccourcis) |
| `hors-ligne.html` | Page de secours hors connexion |

## Développement local

Aucun build : servir le dossier avec un serveur statique (le service worker exige
`http://` ou `https://`).

```bash
python3 -m http.server 8080
# puis http://localhost:8080
```

## Déploiement

GitHub Pages sert la branche `main`, dossier racine. Toute modification poussée
sur `main` est publiée automatiquement. Penser à incrémenter `VERSION` dans
`sw.js` pour forcer la mise à jour du cache côté clients.
