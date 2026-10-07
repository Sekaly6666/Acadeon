# 🎓 Acadéon — Assistant & Plateforme de Suivi Académique

**Acadéon** est une application web conçue pour accompagner les étudiants et chercheurs tout au long de la rédaction de leurs travaux académiques (**mémoires**, **thèses**, **rapports de stage**, **exposés**, **projets de recherche**).

---

## 🏗️ 1. Architecture du Projet

Le projet est structuré en deux parties principales issues d'un monorepo :

1. **`api-server/` (Backend Express 5 / Node.js)**
   - **Framework** : Express 5, TypeScript.
   - **Base de données** : PostgreSQL gérée avec **Drizzle ORM** (hébergée sur Neon Cloud).
   - **Validation des données** : Schémas stricts avec **Zod**.
   - **Authentification** : Intégration Clerk (avec mode fallback de développement local).
   - **Assistance IA** : Services d'assistance méthodologique et simulation de jury.

2. **`acadeon/` (Frontend React 19 / Vite)**
   - **Interface** : React 19, Tailwind CSS, Radix UI, Lucide Icons.
   - **Gestion d'état serveur** : TanStack React Query.
   - **Routage** : Wouter.
   - **Build statique** : Déjà compilé et prêt dans `acadeon/dist/public/`.

---

## ⚡ 2. Comment lancer Acadéon en Bash (Backend + Frontend)

### Lancer les deux services simultanément en Bash :
À la racine du projet (`Acadeon`), exécutez simplement :

```bash
./start.sh
```
*(ou `npm start` ou `bash start.sh`)*

Cela démarre automatiquement les **deux composantes en parallèle** :
1. **Backend API Server** : `http://localhost:8080/api`
2. **Frontend Acadéon (Web)** : `http://localhost:5173` *(avec proxy API intégré vers le backend)*

> Pour tout arrêter proprement, faites simplement un **`Ctrl + C`** dans le terminal.

---

### Ou lancer séparément dans deux terminaux :
- **Terminal 1 (Backend API)** :
  ```bash
  npm run start:server
  ```
- **Terminal 2 (Frontend Web)** :
  ```bash
  npm run start:frontend
  ```

---

### Étape 2 : Lancer les tests automatisés au terminal
Dans un second terminal (pendant que le serveur tourne), exécutez :

```powershell
npm test
```
*(ou `node test-terminal.mjs`)*

Ce script effectue automatiquement les tests suivants :
- ✅ **Test de santé de l'API** (`GET /api/healthz`)
- ✅ **Vérification des guides académiques** (`GET /api/guides`)
- ✅ **Création d'un projet académique** dans PostgreSQL (`POST /api/projects`)
- ✅ **Vérification des 11 étapes méthodologiques** (`GET /api/projects/:id`)
- ✅ **Mise à jour d'étape** (`PATCH /api/projects/:id/steps/subject`)
- ✅ **Listing des projets de recherche** (`GET /api/projects`)

---

## 📡 3. Principaux Endpoints de l'API

| Méthode | Route | Description |
| :--- | :--- | :--- |
| `GET` | `/api/healthz` | Vérification de l'état de l'API |
| `GET` | `/api/guides` | Liste des guides méthodologiques |
| `GET` | `/api/projects` | Liste des projets de l'utilisateur |
| `POST` | `/api/projects` | Créer un nouveau projet (mémoire, rapport, etc.) |
| `GET` | `/api/projects/:id` | Récupérer un projet et ses 11 étapes |
| `PATCH` | `/api/projects/:id` | Mettre à jour les métadonnées d'un projet |
| `PATCH` | `/api/projects/:id/steps/:key` | Mettre à jour une étape (`subject`, `outline`, etc.) |
| `GET` | `/api/projects/:id/sources` | Liste des sources bibliographiques |
| `POST` | `/api/projects/:id/sources` | Ajouter une source bibliographique |

---

## 🔐 4. Variables d'environnement (`api-server/.env`)

Le fichier `api-server/.env` est déjà configuré :
- `PORT=8080`
- `DATABASE_URL=postgresql://...` (Base PostgreSQL Neon configurée)
- `NODE_ENV=development`
- `OPENAI_API_KEY=` *(optionnel : pour activer les requêtes LLM réelles)*
- `CLERK_SECRET_KEY=` *(optionnel : pour activer l'authentification Clerk)*
