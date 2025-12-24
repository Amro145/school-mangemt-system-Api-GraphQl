# 🎓 Modern School Management System API

> A high-performance, edge-ready GraphQL API built with **Hono**, **GraphQL Yoga**, and **Cloudflare Workers**. Powered by **Drizzle ORM** and **Cloudflare D1**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-Orange)
![GraphQL Yoga](https://img.shields.io/badge/GraphQL_Yoga-Pink)

---

## 🚀 Overview

This project is the backend infrastructure for the **School Management System**, designed to run on the **Cloudflare Edge**. It provides a robust **GraphQL API** for managing schools, classrooms, students, teachers, and academic grades.

### ✨ Key Features

*   **⚡ Edge-First Architecture**: Deployed on Cloudflare Workers for global low-latency access.
*   **🔒 Secure Authentication**: JWT-based auth with Bcrypt password hashing.
*   **🛡️ Role-Based Access Control (RBAC)**: Granular permissions for **Admins**, **Teachers**, and **Students**.
*   **🗄️ Drizzle ORM + D1 SQLite**: Type-safe database interactions with Cloudflare's distributed database.
*   **✅ Input Validation**: Zod-powered validation for all mutations.
*   **🚀 N+1 Optimization**: Implements `DataLoader` for efficient nested fetching.
*   **📂 Seeding Support**: Includes automated scripts for seeding complex relational data.

---

## 🛠️ Tech Stack

*   **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) (Serverless Edge)
*   **Framework**: [Hono](https://hono.dev/) (Ultra-fast web framework)
*   **API**: [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
*   **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
*   **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
*   **Validation**: [Zod](https://zod.dev/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)

---

## 📂 Project Structure

```bash
📦 school-management-api
├── 📂 drizzle           # Database migrations & config
├── 📂 src
│   ├── 📂 db            # Schema definitions
│   ├── 📂 graphql       # (Optional) Type definitions
│   ├── 📜 index.ts      # Application entry point (Hono + Yoga)
│   ├── 📜 loaders.ts    # DataLoaders for performance
│   ├── 📜 schemas.ts    # Zod validation schemas
│   └── 📜 seed.ts       # Database seeding logic
├── 📜 wranger.jsonc     # Cloudflare deployment config
├── 📜 seed.sql          # SQL Seed Data
└── 📜 package.json      # Dependencies & Scripts
```

---

## 🏁 Getting Started

### Prerequisites

*   **Node.js** (v20+ recommended)
*   **Wrangler CLI**: `npm install -g wrangler`

### 1. Clone & Install

```bash
git clone https://github.com/your-username/school-management-api.git
cd school-management-api
npm install
```

### 2. Configure Environment

Ensure you have your Cloudflare account set up and authorized:

```bash
npx wrangler login
```

### 3. Database Setup (Local & Remote)

This project uses Cloudflare D1. You can run it locally or deploy to the edge.

**Local Development:**

```bash
# Generate SQL migrations
npm run db:generate

# Apply migrations locally
npm run db:migrate:local
```

### 4. Run Development Server

Start the Hono/Yoga server locally:

```bash
npm run dev
```

Visit `http://localhost:8787/graphql` to access the **GraphiQL Playground**.

---

## 🌱 Seeding the Database

We provide robust scripts to populate your database with dummy data (Schools, Teachers, Students, Grades).

### Remote Seeding (Cloudflare D1)

To seed your **production/remote** database:

```bash
npm run db:seed:remote
```

> **Note**: This executes `seed.sql`, creating 2 Schools, 4 Teachers, and 300+ Students with auto-generated grades.

---

## 🚀 Deployment

Deploy the entire API to Cloudflare Workers with a single command:

```bash
npm run deploy
```

The output will provide your deployed URL (e.g., `https://school-management-api.your-subdomain.workers.dev`).

---

## 🔍 API Documentation

The API exposes a GraphQL endpoint. Here are some common operations:

### 🔐 Authentication

**Mutation: Login**

```graphql
mutation {
  login(email: "admin1@school.edu", password: "amroamro") {
    token
    user {
      id
      role
    }
  }
}
```

### 🏫 Queries

**Query: Fetch Students (Paginated)**

```graphql
query {
  myStudents(limit: 10, offset: 0) {
    id
    userName
    averageScore
    class {
      name
    }
  }
}
```

---

## 🤝 Contributing

1.  Fork the repository.
2.  Create a feature branch (`git checkout -b feature/amazing-feature`).
3.  Commit your changes (`git commit -m 'Add amazing feature'`).
4.  Push to the branch (`git push origin feature/amazing-feature`).
5.  Open a Pull Request.

---

Made with ❤️ by the **Amro Altayeb**.
