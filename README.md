# Clan Manager

This application helps you manage your clan. More specifically, it focuses on summarizing contributions in order to make kick suggestions.

## Frontend
The frontend is Angular, TypeScript, and Tailwind. It is hosted by the same backend (NodeJS using express.static).

The frontend gets data from 2 sources:
1. The Clash Royale API indirectly through a proxy hosted by proxy.royaleapi.dev.
1. The backend for this application.

## Backend
The backend is NodeJS (but source is TypeScript) with a Firestore database hosted on Google's Cloud Run.

The backend stores snapshots of clan data. This data is a combination of Clash Royale API data along with additional computations made by this clan manager application.

## Running Locally

### Backend

```bash
cd backend
npm run dev
```

See more [backend details here](/backend/README.md)

### Frontend

```bash
cd frontend
ng serve
```

See more [frontend details here](/frontend/README.md)

## Pushing to Production

### Google Cloud Console

You will need a service account set up in Google Cloud console. It will need to have the following roles added:
* Cloud Run Source Developer
* Service Account User
* Service Usage Consumer

You will need to create a JSON Key and download it. Move it to the root of the backend directory. You will reference this file in the `.env` file instructions below.

See also https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment

### Local .env file
You will need to set up a `.env` file in the root of backend with the following properties set:
* Set `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY` to your service account's key file (e.g. `name-of-key-file.json`)

### Build and Deploy
From the root folder, run this command:

```bash
gcloud run deploy clanmanager-service \
    --source . \
    --region us-east1 \
    --allow-unauthenticated
```
