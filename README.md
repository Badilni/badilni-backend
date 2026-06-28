# Badilni Backend

Backend API for the Badilni project. This repository is still in an early stage, so this README only covers the essentials needed to run the app locally.

## Requirements

- Node.js 20+
- npm
- MongoDB connection string

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file in the project root and add the required variables:

```env
NODE_ENV=development
PORT=3000

DB_URI=mongodb+srv://<db_username>:<db_password>@cluster.mongodb.net/dbname
DB_USERNAME=your_username
DB_PASSWORD=your_password

ACCESS_TOKEN_SECRET=your_access_token_secret
ACCESS_TOKEN_EXPIRES_IN=15m
ACCESS_TOKEN_COOKIE_EXPIRES_IN=1

REFRESH_TOKEN_SECRET=your_refresh_token_secret
REFRESH_TOKEN_EXPIRES_IN=7d
REFRESH_TOKEN_COOKIE_EXPIRES_IN=7

EMAIL_FROM=your-email@example.com
BREVO_HOST=smtp-relay.brevo.com
BREVO_PORT=587
BREVO_SMTP_LOGIN=your_smtp_login
BREVO_SMTP_KEY=your_smtp_key

CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret

GEMINI_API_KEY=your_gemini_api_key
```

## Run Locally

Development mode:

```bash
npm run dev
```

Watch mode:

```bash
npm run dev:watch
```

Build for production:

```bash
npm run build
```

Start production build:

```bash
npm start
```

## API Base Path

Current routes are mounted under:

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/categories`
- `/api/v1/skill-listings`
- `/api/v1/service-requests`
- `/api/v1/notifications`
- `/api/v1/transactions`
- `/api/v1/bookings`

## API Documentation

Check out the API documentation [here](https://o3kxqoynyc.apidog.io)

## Notes

- The project uses Express, TypeScript, and MongoDB.
- This README is intentionally minimal and will be expanded as the project grows.
