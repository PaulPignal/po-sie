# La Fontaine — apprendre des textes par cœur

Application locale d'apprentissage par cœur (fables de La Fontaine, et tout autre
texte versifié : psaumes, poésie…). Parcours « focus » : on travaille **un texte à
la fois**, un peu chaque jour, avec des exercices gradués et un test quotidien de
récitation noté en % du texte retrouvé de mémoire.

Monorepo pnpm : `apps/api` (Fastify 5 + `node:sqlite`), `apps/web` (React 19 + Vite),
`packages/shared` (types). En production, **un seul process** sert l'API *et* le front
compilé.

## Prérequis

- **Node ≥ 22** (l'app utilise `node:sqlite`, indisponible avant). `nvm use` lit le `.nvmrc`.
- **pnpm** (via Corepack : `corepack enable`).

## Démarrage rapide

```bash
pnpm install
pnpm import:fables       # importe les 241 fables depuis Wikisource (~1-2 min)
pnpm dev                 # API sur :3001, web sur :5173 (proxy /api -> :3001)
```

Ouvre http://localhost:5173.

> Pas envie de scraper ? Copie un fichier `data/la-fontaine.sqlite` existant : l'import
> n'est nécessaire que pour peupler la base (gitignorée).

## Production / accès depuis un autre appareil

```bash
pnpm build               # compile l'API et le front (apps/web/dist)
pnpm start               # sert tout sur http://127.0.0.1:3001
```

Pour ouvrir l'app **depuis un autre Mac / téléphone du même réseau** :

```bash
HOST=0.0.0.0 pnpm start
```

puis sur l'autre appareil : `http://<nom-du-mac>.local:3001` (mDNS, pas besoin de l'IP).

## Enrichir le catalogue (psaumes, poésie…)

Le moteur est agnostique du contenu. Pour ajouter des textes sans scraping, prépare un
manifest JSON (voir [`examples/textes-exemple.json`](examples/textes-exemple.json)) :

```json
{
  "kind": "psaume",
  "author": "Traduction Louis Segond (1910)",
  "collection": "Psaumes",
  "entries": [{ "title": "Psaume 23", "text": "L'Éternel est mon berger…\n…" }]
}
```

```bash
pnpm import:texts examples/textes-exemple.json
```

`kind` ∈ `fable | psaume | poeme | texte`. Les strophes se séparent par une ligne vide.
Les textes apparaissent dans le sélecteur, filtrables par genre.

## Déploiement cloud (optionnel)

Une image Docker est fournie. SQLite a besoin d'un **disque persistant** : monte un
volume sur `/app/data`.

```bash
docker build -t la-fontaine .
docker run -p 3001:3001 -v lafontaine-data:/app/data la-fontaine
```

Sur un PaaS (Fly.io, Render, Railway…) : attache un volume persistant à `/app/data`,
et **protège l'accès** (l'app n'a pas de comptes) en définissant `BASIC_AUTH_USER` /
`BASIC_AUTH_PASS`. La base démarre vide : lance l'import dans le conteneur, ou monte un
volume déjà peuplé.

## Variables d'environnement

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port d'écoute du serveur. |
| `HOST` | `127.0.0.1` | Mettre `0.0.0.0` pour exposer sur le réseau. |
| `DATABASE_PATH` | `data/la-fontaine.sqlite` | Fichier SQLite. |
| `DATA_DIR` | `data/` | Dossier de données (base, rapport d'import). |
| `SOURCE_INDEX_URL` | Wikisource | Index source de `import:fables`. |
| `BASIC_AUTH_USER` / `BASIC_AUTH_PASS` | — | Si définies, exige un HTTP Basic (sinon accès libre). `/api/health` reste public. |

## Scripts

| Commande | Effet |
|---|---|
| `pnpm dev` | API + web en watch. |
| `pnpm build` | Compile API + front. |
| `pnpm start` | Sert l'app compilée (prod). |
| `pnpm import:fables [--force]` | Importe/rafraîchit les fables (Wikisource). |
| `pnpm import:texts <manifest.json>` | Importe des textes locaux (psaumes, poésie…). |
| `pnpm test` | Tests (Vitest, côté API). |
| `pnpm typecheck` | Typecheck API + web. |
