# CineTube Backend API

This is the backend for CineTube, a Movie and Series Rating Portal.

## Tech Stack
- Node.js & Express.js
- Prisma ORM
- PostgreSQL (Neon DB)
- JSON Web Token (JWT) & Bcrypt

## Setup Instructions
1. Clone the repo.
2. Run `npm install`.
3. Create a `.env` file and add `DATABASE_URL` and `JWT_SECRET`.
4. Run `npx prisma generate` and `npx prisma migrate dev`.
5. Run `npm run dev` to start the server.