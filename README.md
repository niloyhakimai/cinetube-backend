# CineTube Backend API

Backend service for CineTube, a streaming-style movie and series platform with authentication, role-based admin tools, TMDB-powered discovery, Stripe billing, review moderation, profile management, and Groq-backed AI features.

## Live

- API: `https://cinetube-backend.onrender.com/api`
- Frontend repo: `https://github.com/niloyhakimai/cinetube-frontend`

## Core Features

- JWT authentication with email/password and Google login
- Demo account bootstrap for `USER`, `ADMIN`, `MODERATOR`, and `CURATOR`
- Role-aware admin dashboard capabilities
- Profile editing with avatar, favorite genres, and communication preferences
- Watchlist, purchases, subscription history, and payment tracking
- TMDB-powered browsing and detail enrichment
- Catalog explore API for filters and discovery pages
- Review moderation with comments, likes, spoiler flags, and approval flow
- AI recommendation feed
- AI review summary for title pages
- AI floating assistant / chat endpoint powered by Groq with fallback responses

## Demo Credentials

These demo users are created or refreshed by `POST /api/auth/demo-login`.

| Role | Email | Password |
| --- | --- | --- |
| User | `demo-user@cinetube.com` | `User123!` |
| Admin | `demo-admin@cinetube.com` | `Admin123!` |
| Moderator | `demo-moderator@cinetube.com` | `Moderator123!` |
| Curator | `demo-curator@cinetube.com` | `Curator123!` |

## Tech Stack

| Category | Technology |
| --- | --- |
| Runtime | Node.js |
| Framework | Express 5 |
| ORM | Prisma |
| Database | PostgreSQL |
| Auth | JWT, bcrypt, Google OAuth |
| Billing | Stripe |
| Email | Nodemailer |
| AI | Groq Chat Completions |
| External Data | TMDB |

## Scripts

```bash
npm run dev
npm run dev:nodemon
npm run build
npm run start
```

## Local Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create `.env`

```env
PORT=5000
DATABASE_URL="postgresql://..."
JWT_SECRET="replace-with-a-secure-secret"

CLIENT_URL="http://localhost:3000"

GOOGLE_CLIENT_ID="your_google_client_id"
GOOGLE_CLIENT_SECRET_ID="your_google_client_secret"

STRIPE_SECRET_KEY="your_stripe_secret_key"
STRIPE_WEBHOOK_SECRET="your_stripe_webhook_secret"

EMAIL_HOST="smtp.gmail.com"
EMAIL_PORT=465
EMAIL_USER="your_email@example.com"
EMAIL_PASS="your_email_app_password"

TMDB_API_READ_TOKEN="your_tmdb_read_token"
TMDB_BASE_URL="https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL="https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_BASE_URL="https://image.tmdb.org/t/p/original"

GROQ_API_KEY="your_groq_api_key"
GROQ_BASE_URL="https://api.groq.com/openai/v1"
GROQ_MODEL="llama-3.3-70b-versatile"
```

### 3. Generate Prisma client and sync schema

```bash
npx prisma generate
npx prisma db push
```

### 4. Run the API

```bash
npm run dev
```

Server runs on `http://localhost:5000`.

## Main Routes

- `/api/auth`
- `/api/media`
- `/api/catalog`
- `/api/tmdb`
- `/api/reviews`
- `/api/watchlist`
- `/api/payments`
- `/api/subscriptions`
- `/api/admin`
- `/api/ai`

## Project Structure

```text
src/controllers   request handlers
src/routes        express routes
src/services      TMDB, catalog, AI service layer
src/middlewares   auth and role guards
src/utils         serialization, email, payment helpers
prisma            schema and migrations
```

## Production Notes

- Put Groq keys only in the backend environment, never in the frontend
- Set `CLIENT_URL` to the production frontend domain on Render
- Restart or redeploy after changing env values
- Do not commit `.env`, logs, or temporary runtime files

## License

MIT
