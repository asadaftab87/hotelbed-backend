# Hotel Bed Backend

**Author:** Asad Aftab
**License:** ISC

A Node.js backend for managing hotel bed data, built with TypeScript, Express, Prisma,Raw queries and supporting various integrations such as MySQL/MongoDB, and EC2 deployment.

---

## Table of Contents

* [Features](#features)
* [Prerequisites](#prerequisites)
* [Installation](#installation)
* [Environment Variables](#environment-variables)
* [Scripts](#scripts)
* [Database](#database)
* [Prisma Schema](#prisma-schema)
* [Testing](#testing)
* [Technologies Used](#technologies-used)

---

## Features

* Express-based REST API
* Database management with Prisma
* JWT and Passport.js integration
* File handling with `adm-zip`
* CSV data import/export
* Scheduled tasks via Node-Cron
* EC2 deployment with GitHub Actions and PM2

---

## Prerequisites

* Node.js v18+
* npm v9+
* MySQL or MongoDB instance
* Optional: PM2 for production process management

---

## Installation

1. Clone the repository:

```bash
git clone https://github.com/asadaftab87/wedding-sponsor-backend.git
cd hotel-bed-backend
```

2. Install dependencies:

```bash
npm install --force
```

3. Setup environment variables (see [Environment Variables](#environment-variables)).

4. Generate Prisma client:

```bash
npm run generate
```

---

## Environment Variables

Create a `.env` file in the root directory:

```env
DATABASE_URL=your_database_url
JWT_SECRET=your_jwt_secret
PORT=5000

---

## Scripts

| Script               | Description                      |
| -------------------- | -------------------------------- |
| `npm run dev`        | Start in development mode        |
| `npm run start:prod` | Start production server          |
| `npm run build`      | Clean and build project          |
| `npm run migrate`    | Run database migrations          |
| `npm run test`       | Run Jest tests                   |
| `npm run pm2`        | Start or restart server with PM2 |

---


## Prisma Schema Overview

**Key Models:**

* `HotelBedFile` – Main hotel file record
* `Contract`, `Promotion`, `Room`, `Restriction`, `Cost`, `MinMaxStay` – Hotel data details
* `Supplement`, `StopSale`, `CancellationFee`, `RateCode`, `ExtraStay`, `ExtraSupplement`, `Group`, `Offer` – Hotel offerings
* `ServiceInfoIn`, `ServiceInfoAp`, `ServiceInfoCf`, `ServiceInfoA` – Service info types


## Testing

Run tests with Jest:

```bash
npm run test
```

> Automatically detects open handles and force exits.

---

## Technologies Used

* **Node.js & Express** – Server framework
* **TypeScript** – Modern JS & type safety
* **Prisma** – Database ORM
* **MySQL** – Database
* **Jest & Supertest** – Testing
* **PM2** – Production process management
* **Node-Cron** – Scheduled jobs
* **Joi** – Input validation
