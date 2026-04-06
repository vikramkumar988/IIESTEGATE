# 🏛️ IIEST E-Gate Pass System

A production-ready campus visitor management system built with **React Native (Expo)**, **Node.js/Express**, and **PostgreSQL**.

## Features
- **3 Roles**: Guard, Staff/Professor, Admin with separate dashboards
- **Professor Visit Flow**: Guard creates request → Professor approves/rejects → QR pass generated
- **General Visit Flow**: Bank, Post Office, etc. — instant QR pass, no approval needed
- **QR Code Scanning**: Any guard verifies visitor passes with camera scan
- **Push Notifications**: Real-time alerts for requests, approvals, rejections
- **Auto-Expiry**: Passes automatically expire when time limit is reached
- **Premium Dark UI**: Professional dark theme with glassmorphism effects

---

## Quick Start

### 1. Database Setup
```bash
# Create PostgreSQL database
psql -U postgres -c "CREATE DATABASE iiest_egatepass;"
```

### 2. Backend
```bash
cd backend
cp .env.example .env   # Edit DB credentials if needed
npm run seed            # Creates tables & seed users
npm run dev             # Starts server on port 3000
```

### 3. Mobile App
```bash
cd mobile
# Edit src/services/api.js — set API_BASE_URL to your IP
npx expo start          # Starts Expo dev server
```

### 4. Login Credentials (Seeded)
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@iiest.ac.in | admin123 |
| Guard | guard1@iiest.ac.in | guard123 |
| Guard | guard2@iiest.ac.in | guard123 |
| Staff | amit.sharma@iiest.ac.in | staff123 |
| Staff | priya.das@iiest.ac.in | staff123 |

---

## Project Structure
```
├── backend/          # Node.js + Express API
│   ├── config/       # DB pool, auth config
│   ├── controllers/  # 7 controllers (auth, visit, gatePass, etc.)
│   ├── middleware/    # JWT auth, role check, file upload, error handler
│   ├── routes/       # 7 route files
│   ├── utils/        # QR generator, push notifications, validators
│   ├── schema.sql    # PostgreSQL schema (7 tables)
│   ├── seed.js       # Database seeder
│   └── server.js     # Express entry point with cron job
│
└── mobile/           # React Native (Expo) App
    ├── src/
    │   ├── components/  # Reusable UI (Button, Card, Badge, etc.)
    │   ├── context/     # AuthContext with SecureStore
    │   ├── navigation/  # Role-based tab + stack navigation
    │   ├── screens/     # 14 screens (auth, guard, staff, admin, common)
    │   ├── services/    # API service with Axios interceptors
    │   └── theme/       # Design system (colors, spacing, shadows)
    └── App.js
```
