# ⚙️ CineTube - Backend REST API

This repository contains the **Backend API** for CineTube, a full-stack movie and TV series streaming platform. Built with **Node.js, Express, and Prisma ORM**, it handles authentication, payments, TMDB integration, and secure data management.

---

## 🚀 Live API

- 🌐 **API Base URL:** [Insert Backend Live URL here]  
- 🎬 **Frontend Repository:** https://github.com/niloyhakimai/cinetube-frontend  

---

## ✨ Key Features

### 🔐 Secure Authentication
- JWT-based authentication system  
- User registration & login  
- Role-based access control (Admin / User)  

### 💳 Payment Processing
- Stripe integration for:
  - Subscriptions (Monthly / Yearly)  
  - One-time purchases (Rent / Buy)  

### 🎥 TMDB Service Layer
- Proxy & cache TMDB API requests  
- Fetch movies, TV shows, posters, trailers  
- Improves performance & security  

### 📝 Review Moderation Engine
- Users can:
  - Submit reviews  
  - Add comments  
- Admin can:
  - Approve / delete reviews  
  - Moderate content  

### 🗄️ Robust Database Schema
- Managed via Prisma ORM  
- Relational data model:
  - Users  
  - Media  
  - Purchases  
  - Reviews  

---

## 🧰 Tech Stack

| Category            | Technology |
|--------------------|-----------|
| Runtime            | Node.js |
| Framework          | Express.js |
| Database           | PostgreSQL / MySQL |
| ORM                | Prisma ORM |
| Authentication     | JWT, bcryptjs |
| Payments           | Stripe API |
| External Services  | TMDB API |

---

## ⚙️ Local Setup Instructions

### 1️⃣ Clone Repository

```bash
git clone [Your Backend Repo URL]
cd cinetube-backend
```

---

### 2️⃣ Install Dependencies

```bash
npm install
```

---

### 3️⃣ Environment Variables

Create a `.env` file in the root directory and configure:

```env
PORT=5000

DATABASE_URL="your_postgresql_or_mysql_database_url_here"

JWT_SECRET="your_highly_secure_jwt_secret"

STRIPE_SECRET_KEY="your_stripe_secret_key"

# TMDB Configuration
TMDB_API_READ_TOKEN="your_tmdb_read_access_token_here"
TMDB_BASE_URL="https://api.themoviedb.org/3"
TMDB_IMAGE_BASE_URL="https://image.tmdb.org/t/p/w500"
TMDB_BACKDROP_BASE_URL="https://image.tmdb.org/t/p/original"
```

---

### 4️⃣ Database Setup (Prisma)

```bash
npx prisma generate
npx prisma db push
```

---

### 5️⃣ Run Development Server

```bash
npm run dev
```

👉 API will run at:  
**http://localhost:5000**

---

## 📦 Project Structure (Overview)

```
/controllers   → Request handlers  
/routes        → API routes  
/middleware    → Auth & validation  
/prisma        → Schema & migrations  
/utils         → Helper functions  
```

---

## 🔒 Security Notes

- Never expose `.env` file  
- Keep JWT & Stripe secret keys secure  
- Use HTTPS in production  
- Validate all incoming requests  

---

## 📈 Future Improvements

- 🔍 Advanced caching (Redis)  
- 📊 Analytics dashboard  
- 📱 Mobile API optimization  
- 🧠 AI-based recommendations  

---

## 🤝 Contribution

1. Fork the repository  
2. Create a new branch  
3. Commit changes  
4. Open a Pull Request  

---

## 📄 License

This project is licensed under the MIT License.

---

## 💡 Developer Note

> This backend is designed with scalability, security, and real-world production use in mind, including payments, authentication, and modular architecture.

---

## 👨‍💻 Author

**Niloy Hakim**  
Building scalable systems with Full Stack 🚀  

---

⭐ If you like this project, give it a star!