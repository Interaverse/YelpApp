# Yelp Web App

A web application that integrates with the Yelp API to display business information, reviews, and potentially other features.

## Prerequisites

Before you begin, ensure you have met the following requirements:
*   You have installed Node.js and npm (or yarn).
*   You have a Firebase project set up.
*   You have a Yelp Fusion API Key.

## Setup

To get the project up and running, follow these steps:

1.  **Clone the repository:**
    ```bash
    git clone <your-repository-url>
    cd yelp-web-app
    ```

2.  **Install dependencies:**
    Navigate to the `frontend` directory and install the necessary packages.
    ```bash
    cd frontend
    npm install
    # or
    # yarn install
    cd ..
    ```
    If there's a backend component, navigate to its directory (e.g., `backend`) and install its dependencies as well.
    ```bash
    # cd backend
    # npm install
    # # or
    # # yarn install
    # cd ..
    ```


3.  **Set up Firebase Service Account Key:**
    *   Rename `yelp-456821-939594800d2e.json.example` to `yelp-456821-939594800d2e.json`.
    *   Replace the placeholder values in `yelp-456821-939594800d2e.json` with your actual Firebase project's service account credentials. You can download this JSON file from your Firebase project settings.

4.  **Set up Environment Variables:**
    *   Create a `.env` file in the root of the project (or in the `frontend` directory if your setup expects it there - adjust path accordingly).
    *   Copy the contents of what would be in `.env.example` (see below) into your new `.env` file.
    *   Fill in the required API keys and Firebase configuration details.

    **Contents for your `.env` file (based on a typical setup):**
    ```env
    # Firebase Configuration
    REACT_APP_FIREBASE_API_KEY="YOUR_FIREBASE_API_KEY"
    REACT_APP_FIREBASE_AUTH_DOMAIN="YOUR_FIREBASE_AUTH_DOMAIN"
    REACT_APP_FIREBASE_PROJECT_ID="YOUR_FIREBASE_PROJECT_ID"
    REACT_APP_FIREBASE_STORAGE_BUCKET="YOUR_FIREBASE_STORAGE_BUCKET"
    REACT_APP_FIREBASE_MESSAGING_SENDER_ID="YOUR_FIREBASE_MESSAGING_SENDER_ID"
    REACT_APP_FIREBASE_APP_ID="YOUR_FIREBASE_APP_ID"

    # Yelp API Configuration
    REACT_APP_YELP_API_KEY="YOUR_YELP_API_KEY"
    # If you have server-side calls, you might also need:
    # YELP_API_KEY="YOUR_SERVER_SIDE_YELP_API_KEY"

    # Other API keys or configurations
    # Example: REACT_APP_GOOGLE_MAPS_API_KEY="YOUR_GOOGLE_MAPS_API_KEY"
    ```
    *Note: The `.env.example` file could not be created automatically. Please manually create a `.env` file and populate it using the structure above.*

## Installation

After setting up the environment, you can install the project dependencies.

**Frontend:**
```bash
cd frontend
npm install
# or
yarn install
```

**Backend (if applicable):**
```bash
# cd backend
# npm install
# # or
# yarn install
```

## Usage

**Development Server (Frontend):**
To run the frontend development server:
```bash
cd frontend
npm start
# or
yarn start
```
This will typically open the app in your default web browser at `http://localhost:3000`.

**Backend Server (if applicable):**
To run the backend server:
```bash
# cd backend
# npm start # or node server.js, etc.
```

**Building for Production:**
To build the frontend for production:
```bash
cd frontend
npm run build
# or
yarn build
```
The build artifacts will usually be in the `frontend/dist` or `frontend/build` directory.

## Deployment

This project uses Firebase. Ensure your Firebase CLI is configured and you are logged in.

1.  **Login to Firebase (if you haven't already):**
    ```bash
    firebase login
    ```
2.  **Initialize Firebase in your project (if not already done):**
    ```bash
    firebase init
    ```
    Follow the prompts, selecting Hosting and any other Firebase services you are using (e.g., Firestore, Functions). Make sure to configure the public directory correctly (e.g., `frontend/build` or `frontend/dist`).

3.  **Deploy to Firebase Hosting:**
    ```bash
    firebase deploy --only hosting
    ```
    If you are using other Firebase services like Functions or Firestore rules:
    ```bash
    firebase deploy
    ```

## Contributing

Contributions are welcome! Please follow these steps:
1.  Fork the repository.
2.  Create a new branch (`git checkout -b feature/your-feature-name`).
3.  Make your changes.
4.  Commit your changes (`git commit -m 'Add some feature'`).
5.  Push to the branch (`git push origin feature/your-feature-name`).
6.  Open a Pull Request.

---

*This README was generated with assistance from an AI.* 