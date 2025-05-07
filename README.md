# Yelp Web App

A web application for visualizing and interacting with business data, primarily sourced from Google BigQuery. The application features a React-based frontend, a backend built with Firebase Functions (potentially served via Google Cloud App Hosting), and Python ETL scripts for data ingestion into BigQuery.

This README provides instructions for setting up, running, and deploying the project.

## Project Overview

*   **Frontend (`frontend/`):** A React application built with Vite, responsible for user interface and data presentation.
*   **Backend (`functions/` & `apphosting.yaml`):** Backend logic implemented as Firebase Functions (Node.js). These functions handle data retrieval from BigQuery and other backend tasks. The `apphosting.yaml` file suggests deployment as a service on Google Cloud App Hosting.
*   **Data Store:** Google BigQuery is the primary data warehouse.
*   **ETL (`ETL/`):** Python scripts for extracting, transforming, and loading data into BigQuery.
*   **User Roles (`USERS.md`):** Refer to `USERS.md` for details on user roles implemented in the frontend.
*   **Dashboard Designs (`*.puml` files):** The root directory contains several PlantUML (`.puml`) files that describe the designs for various dashboard views (Admin, Investor, Marketing, Manager). These can be useful for understanding the UI/UX goals.

## Prerequisites

Before you begin, ensure you have met the following requirements:
*   Node.js and npm (or yarn) installed.
*   Python (3.x recommended) and pip installed.
*   Google Cloud SDK (`gcloud` CLI) installed and authenticated (`gcloud auth login` and `gcloud auth application-default login`).
*   A Google Cloud Platform (GCP) project with:
    *   Firebase enabled (for Authentication, Hosting, Functions).
    *   BigQuery API enabled and datasets/tables set up as required by the ETL scripts.
    *   Cloud App Hosting enabled if using `apphosting.yaml` for backend deployment.
*   A Firebase service account key JSON file (e.g., `yelp-456821-939594800d2e.json`). This key needs appropriate IAM permissions for Firebase services, BigQuery (e.g., BigQuery Data Editor, BigQuery User), and any other GCP services accessed.

## Setup

Follow these steps to set up the project components:

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd yelp-web-app
    ```

2.  **Firebase Service Account Key:**
    *   Place your downloaded Firebase service account key JSON file in the project root and rename it to `yelp-456821-939594800d2e.json`.
    *   **Important:** This file is listed in `.gitignore` and should NOT be committed to your repository.
    *   This key will be used by backend services (Firebase Functions / App Hosting) and potentially by ETL scripts for authentication.
    *   An example file `yelp-456821-939594800d2e.json.example` is provided as a template.
    *   Copy this key into the `functions/` directory as well, as it might be directly referenced there:
        ```bash
        cp yelp-456821-939594800d2e.json functions/
        ```

3.  **Backend Setup (`functions/` directory & App Hosting):
    *   Navigate to the Firebase Functions directory:
        ```bash
        cd functions
        ```
    *   Install dependencies:
        ```bash
        npm install
        ```
    *   The backend is defined in `functions/index.js` (or `functions/src/` if using TypeScript and compiling to `lib/`).
    *   It utilizes `@google-cloud/bigquery`, `firebase-admin`, etc.
    *   **Local Emulation:** To run functions locally (requires Firebase Emulators setup):
        ```bash
        npm run serve 
        ```
    *   Refer to `functions/README.md` for any specific instructions related to the backend functions.
    *   The `apphosting.yaml` in the root directory is configured for deploying this backend using Google Cloud App Hosting. It uses the `npm start` script from `functions/package.json`.

4.  **Frontend Setup (`frontend/` directory):
    *   Navigate to the frontend directory:
        ```bash
        cd frontend
        ```
    *   Install dependencies:
        ```bash
        npm install
        ```
    *   The frontend is a Vite-React application.

5.  **ETL Setup (`ETL/` directory):
    *   Navigate to the ETL directory:
        ```bash
        cd ETL
        ```
    *   **Virtual Environment (Recommended):**
        ```bash
        python -m venv .venv
        source .venv/bin/activate  # On Linux/macOS
        # .\.venv\Scripts\activate   # On Windows PowerShell
        ```
    *   **Dependencies:** Install required Python packages. It is highly recommended to have a `requirements.txt` file in the `ETL/` directory. If it doesn't exist, create one based on the imports in the scripts (e.g., `google-cloud-bigquery`, `pandas`).
        ```bash
        pip install -r requirements.txt 
        # or pip install google-cloud-bigquery pandas etc.
        ```
    *   **Configuration:** Each ETL script (`investorsETL.py`, `marketingETL.py`, `managersETL.py`) needs to be configured with:
        *   Your Google Cloud Project ID.
        *   The target BigQuery Dataset ID.
        *   Specific BigQuery Table IDs.
        *   Paths to source data files or connection details for source databases.
        *   Consult the comments and code within each script for detailed configuration.

6.  **Set up Environment Variables (`.env` files):
    *   **Frontend (`frontend/.env`):**
        *   Create a `.env` file in the `frontend/` directory (you can copy `frontend/.env.example` if it exists, or create it manually).
        *   This file should contain variables for the Firebase client-side SDK (these are typically public and safe to include in a `.env` file that gets bundled with the frontend).
            ```env
            REACT_APP_FIREBASE_API_KEY="YOUR_FIREBASE_CLIENT_API_KEY"
            REACT_APP_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_CLIENT_AUTH_DOMAIN"
            REACT_APP_FIREBASE_PROJECT_ID="YOUR_FIREBASE_CLIENT_PROJECT_ID"
            REACT_APP_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_CLIENT_STORAGE_BUCKET"
            REACT_APP_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_CLIENT_MESSAGING_SENDER_ID"
            REACT_APP_FIREBASE_APP_ID="YOUR_FIREBASE_CLIENT_APP_ID"
            ```
    *   **Backend/ETL (Environment Configuration):
        *   **Firebase Functions/App Hosting:** Environment variables for the backend are typically managed through:
            *   Google Cloud Secret Manager.
            *   Directly in `apphosting.yaml` (for build or run `env` variables, though less secure for secrets).
            *   Within Firebase Functions configuration (`firebase functions:config:set your.variable="value"`).
            *   The service account key (`yelp-456821-939594800d2e.json`) provides authentication and project context.
        *   **ETL Scripts:** Configuration like Project ID, Dataset ID is often hardcoded or passed as arguments in the scripts. For sensitive connection details, consider using environment variables or a secure configuration method.
    *   An `.env.example` file is provided in the root to show structure for frontend variables.

7.  **Populate BigQuery Tables using ETL Scripts:**
    *   After configuring the ETL scripts and your Python environment:
        ```bash
        cd ETL
        # Ensure your virtual environment is active if you created one
        # Ensure gcloud auth application-default login has been run
        python investorsETL.py
        python marketingETL.py
        python managersETL.py
        ```
    *   Monitor the output of each script for success or errors.

## Usage

**Frontend Development Server:**
```bash
cd frontend
npm start
```
This will typically open the app at `http://localhost:5173` (Vite's default) or `http://localhost:3000`.

**Backend Local Emulation (Firebase Functions):**
```bash
cd functions
npm run serve
```
This starts the Firebase Emulators for functions. You'll need to configure your frontend to point to the local emulator URLs for testing.

## Linting & Formatting

*   **Frontend:**
    ```bash
    cd frontend
    npm run lint
    ```
*   **Backend (Firebase Functions):**
    ```bash
    cd functions
    npm run lint
    ```

## Deployment

Deployment involves multiple components:

1.  **Frontend (Firebase Hosting):
    *   Build the frontend application:
        ```bash
        cd frontend
        npm run build
        ```
    *   Deploy to Firebase Hosting (ensure `firebase.json` is configured to point to the correct build output directory, e.g., `frontend/dist`):
        ```bash
        firebase deploy --only hosting
        ```

2.  **Backend (Firebase Functions / Google Cloud App Hosting):
    *   **Option A: Deploy directly as Firebase Functions:**
        ```bash
        cd functions
        # npm run build # If using TypeScript and it's not automatically built by deploy
        firebase deploy --only functions
        ```
    *   **Option B: Deploy using Google Cloud App Hosting (`apphosting.yaml`):**
        This method uses the configuration in `apphosting.yaml` to deploy the backend as a service. This is often preferred for more complex backend setups or different scaling needs.
        ```bash
        # Ensure you are in the project root directory
        gcloud app deploy apphosting.yaml
        ```
    *   **Clarification Needed:** The project should define which backend deployment strategy (Firebase Functions direct deploy or App Hosting) is primary or if they serve different purposes. `firebase.json` might also contain rewrites to functions that could interact with or be superseded by App Hosting.

3.  **ETL Scripts:**
    *   These are run manually or can be scheduled using Google Cloud Scheduler, Cloud Workflows, or other orchestration tools to regularly update BigQuery data.

## Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

---

*This README was generated and updated with assistance from an AI.* 