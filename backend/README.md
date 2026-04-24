# Parking Management Backend

Node.js + Express.js + MongoDB backend for a Parking Management System dashboard.

## Stack

- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- bcryptjs password hashing
- dotenv
- cors
- helmet
- morgan
- express-validator

## Features

- JWT-based authentication with role protection
- Dashboard overview with parking map data
- Vehicle management with check-in and check-out flows
- Parking slot management
- Transactions and payments with export support
- Reports with revenue and activity summaries
- User management
- Settings management
- Seed scripts for admin user and parking slots

## Folder Structure

```text
backend/
  config/
  controllers/
  middleware/
  models/
  routes/
  seed/
  utils/
  server.js
  package.json
  .env.example
```

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the environment file and update values:

```bash
cp .env.example .env
```

3. Start MongoDB locally or use a hosted MongoDB URI.

4. Seed the default admin and parking slots:

```bash
npm run seed:admin
npm run seed:slots
```

5. Run the development server:

```bash
npm run dev
```

## Default Admin

- Email: `admin@parking.com`
- Password: `Admin@12345`

## Main API Routes

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/dashboard/overview`
- `GET /api/vehicles`
- `POST /api/vehicles`
- `POST /api/vehicles/check-in`
- `POST /api/vehicles/check-out/:id`
- `GET /api/parking-slots`
- `GET /api/parking-slots/available`
- `GET /api/transactions`
- `GET /api/payments`
- `GET /api/reports`
- `GET /api/users`
- `GET /api/settings`

## Notes

- All dashboard routes require a valid JWT in the `Authorization` header as `Bearer <token>`.
- Revenue updates when payments are marked as paid.
- `POST /api/vehicles` and `POST /api/vehicles/check-in` both support direct slot assignment or auto-assignment.
- CSV export is available on transactions and payments endpoints using `?export=csv`.
