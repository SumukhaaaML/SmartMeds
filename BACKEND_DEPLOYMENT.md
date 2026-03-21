# Backend Deployment Guide (Render)

We have configured the project to easily deploy to **Render**.

## Steps to Deploy

1.  **Push to GitHub**
    Make sure all recent changes (including `render.yaml` and `backend/app.py`) are pushed to your GitHub repository.
    
2.  **Connect to Render**
    - Go to [Dashboard - Render](https://dashboard.render.com).
    - Click **New** > **Blueprint**.
    - Connect your GitHub repository (e.g., `SmartMeds` or whatever you named it).
    - Render will automatically detect the `render.yaml` config and set up the `smartmeds-backend` web service.

3.  **Configure Environment Variables**
    Because you cannot safely commit `serviceAccountKey.json` to GitHub, you will need to set it as an environment variable in Render.
    - Go to your new **Web Service** settings in the Render dashboard.
    - Click on **Environment** in the left sidebar, and add a new secret.
    - **Key**: `FIREBASE_CREDENTIALS_JSON`
    - **Value**: The raw JSON contents of your `serviceAccountKey.json` file. Copy the entire file exactly as it is.
    *(Also add your `FIREBASE_DATABASE_URL` if it's different than the default)*

4.  **Verify Deployment**
    Wait for the first deploy to complete (you can monitor the logs in the Render dashboard). Open the provided Render link in your browser (e.g. `https://smartmeds-backend-xxxx.onrender.com/health`). If you get a `"status": "ok"` response, your backend is online!
