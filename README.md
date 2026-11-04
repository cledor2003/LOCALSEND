# PointageDistance

Application de pointage à distance par géolocalisation, avec deux pages séparées :
- `public/employe.html` — pointage employé (GPS + code PIN)
- `public/admin.html` — tableau de bord admin (stats, gestion, alertes, export Excel)

Un vrai serveur Node.js (`server.js`) sert de backend partagé : les deux pages
communiquent avec lui, donc tout reste synchronisé entre tous les appareils.

## Installation (dans VSCode)

1. Ouvre ce dossier dans VSCode
2. Ouvre un terminal (Terminal → New Terminal) et lance :

```bash
npm install
npm start
```

3. Le terminal affiche :
```
PointageDistance lancé sur http://localhost:3000
  Employés : http://localhost:3000/employe.html
  Admin    : http://localhost:3000/admin.html
```

4. Ouvre ces deux adresses dans ton navigateur pour tester en local.

## Déployer en ligne (pour avoir de vrais liens accessibles à distance)

Ce projet est un serveur Node.js classique — tu peux le déployer gratuitement sur :

**Render.com** (recommandé, simple)
1. Crée un compte sur render.com
2. "New +" → "Web Service" → connecte ton dépôt GitHub (pousse d'abord ce dossier sur GitHub)
3. Build command : `npm install` — Start command : `npm start`
4. Render te donne une URL du type `https://ton-app.onrender.com`
5. Tes liens définitifs :
   - Employés : `https://ton-app.onrender.com/employe.html`
   - Admin : `https://ton-app.onrender.com/admin.html`

**Railway.app** — même principe, aussi simple.

Ces deux URLs sont HTTPS par défaut (requis pour la géolocalisation) et sont
totalement sous ton contrôle — tu peux mettre l'admin derrière un accès restreint
plus tard si besoin (mot de passe, VPN, etc.), contrairement à un artefact publié
sur Claude.ai.

## Stockage des données

Les données (employés, pointages, heure limite) sont stockées dans
`data/db.json`, créé automatiquement au premier lancement. Pour une charge plus
importante ou plusieurs déploiements, on peut migrer vers une vraie base de
données (PostgreSQL, MongoDB) plus tard — la structure de l'API le permet sans
changer le frontend.

## Sécurité — à savoir

- Le code PIN protège contre une usurpation basique, mais n'est pas un vrai
  système d'authentification (pas de session, pas de hachage du PIN)
- La page admin n'est protégée que par le fait que son URL n'est pas devinable
  facilement — pour une vraie protection, ajoute une authentification (ex.
  `express-basic-auth`) devant les routes `/admin.html` et `/api/*` sensibles
- Les alertes de retard sont des notifications navigateur : elles ne fonctionnent
  que si la page admin reste ouverte dans un onglet

## Résolution de problèmes de géolocalisation

1. Ouvrir le lien dans un vrai navigateur (Chrome/Safari), pas dans WhatsApp/Messenger
2. Vérifier que la localisation est activée sur l'appareil (réglages système)
3. Vérifier l'autorisation du site (icône 🔒 à côté de l'adresse → Position → Autoriser)
4. L'app retente automatiquement en mode moins précis si la première tentative échoue
