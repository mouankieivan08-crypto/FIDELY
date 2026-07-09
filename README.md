# Fidely

CRM de fidélité pour tout type de commerce (salons, boutiques, restaurants,
cabinets, ateliers...) : programmes de fidélité, fiches clients avec carte QR
partageable, scan de visites, agenda de rendez-vous, prestations, employés et
pointage.

## Stack

- Frontend : React 19 + Vite + TypeScript + Tailwind
- Backend : Express (`server.ts`), servi par le même processus que Vite en dev
- Base de données : Postgres via Drizzle ORM (`src/db`)
- Authentification : Firebase Auth (connexion Google), vérifiée côté serveur
  avec `firebase-admin`

## Prérequis

- Node.js 20+
- Une base Postgres accessible

## Installation

1. Installer les dépendances :
   ```
   npm install
   ```
2. Copier `.env.example` vers `.env` et renseigner :
   - les variables `SQL_*` (connexion à votre base Postgres)
   - les variables `VITE_FIREBASE_*` (configuration de votre projet Firebase),
     ou copier `firebase-applet-config.example.json` vers
     `firebase-applet-config.json` et le remplir — ce fichier ne doit **jamais**
     être commité avec de vraies valeurs (il est dans `.gitignore`).
3. Pousser le schéma vers la base :
   ```
   npm run db:push
   ```
4. Lancer l'app :
   ```
   npm run dev
   ```

## Scripts

- `npm run dev` — serveur de dev (Express + Vite en middleware mode)
- `npm run build` — build de production (client + serveur)
- `npm run start` — lance le build de production
- `npm run lint` — vérification TypeScript (`tsc --noEmit`)
- `npm run db:push` — applique le schéma Drizzle à la base
