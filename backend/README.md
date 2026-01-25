# Clan Manager Backend

## Running Locally

### Business as Usual
```bash
npm run dev
```

### First Time Setup

**Node**
Make sure everything is installed
```bash
npm install
```

**Google Cloud Console**

You will need a service account set up in Google Cloud console. It will need to have the following roles added:
* Cloud Run Source Developer
* Service Account User
* Service Usage Consumer

You will need to create a JSON Key and download it. Move it to the root of the backend directory. You will reference this file in the `.env` file instructions below.

See also https://docs.cloud.google.com/docs/authentication/set-up-adc-local-dev-environment

**Local .env file**
You will need to set up a `.env` file in the root of backend with the following properties set:
* Set `GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY` to your service account's key file (e.g. `name-of-key-file.json`)

## Pushing to Production

From the backend folder, run this command:

```bash
gcloud run deploy clanmanager-backend \
    --source . \
    --region us-east1 \
    --allow-unauthenticated
```
