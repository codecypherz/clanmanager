# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Clan Manager is a Clash Royale clan management app that summarizes member contributions and makes kick suggestions. It combines data from the Clash Royale API (via proxy.royaleapi.dev) with historical snapshots stored in Firestore.

## Monorepo Structure

Three npm workspaces: `frontend`, `backend`, `shared`.

- **frontend**: Angular 21 + Tailwind CSS 4, standalone components, Vitest for testing
- **backend**: Express server (Node 20, ESM), serves the Angular SPA via `express.static`, Firestore for persistence
- **shared**: Models and interfaces (`ClanResult`, `ClanMember`, `ClanSnapshot`, `Eval` enum) imported as `@clan-manager/shared`

Frontend builds output to `../backend/dist/public` so the backend serves everything.

## Commands

```bash
# Install all workspace dependencies from root
npm install

# Frontend
cd frontend
ng serve              # Dev server
npm test              # Run tests (Vitest)
npx ng test --watch   # Watch mode tests
ng build              # Production build

# Backend
cd backend
npm run dev           # Dev server with hot reload (tsx watch)
npm run build         # TypeScript compile
npm start             # Run production build

# Deploy to Cloud Run
gcloud run deploy clanmanager-service --source . --region us-east1 --allow-unauthenticated
```

## Testing

Frontend only. Uses **Vitest** with Angular TestBed integration. Test files are colocated with source (`*.spec.ts`). HTTP calls are mocked with `HttpClientTestingModule` / `HttpTestingController`.

## Key Architecture

- **ClashRoyaleService** (`frontend/src/service/clash-royale.ts`): Main data service. Uses `forkJoin` to make parallel API calls (members, current war, war log), then combines results with snapshot history to compute kick suggestions, war evaluations, and role codes.
- **SnapshotService** (`frontend/src/service/snapshot-service.ts`): Merges local snapshots (localStorage, max 100) with remote (Firestore via backend). Throttles saves to 4-hour intervals.
- **Backend** (`backend/src/server.ts`): Single-file Express server with two API endpoints: `POST /api/snapshots` and `GET /api/snapshots/:clanTag` (supports `?since` filter).
- **Shared models** (`shared/models/clan-member.ts`): All data types used across frontend and backend.

## TypeScript Config

Root `tsconfig.json` defines the path alias `@clan-manager/shared` → `shared/index.ts`. Both frontend and backend extend/reference this. Strict mode is enabled. Target is ES2022.

## Environment Variables

- `backend/.env`: `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY` (path to Firebase service account JSON)
- `frontend/.env`: `NG_APP_CLASH_API_KEY` (Bearer token for RoyaleAPI proxy)
