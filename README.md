# 🌐 School Management System - Backend API

![Status](https://img.shields.io/badge/Status-Production%20Ready-green)
![Cloudflare](https://img.shields.io/badge/Cloudflare-Workers-orange)
![Drizzle](https://img.shields.io/badge/ORM-Drizzle-yellow)
![GraphQL](https://img.shields.io/badge/API-GraphQL-pink)

The High-Performance API powering the EduDash platform. Built on the **Cloudflare Workers** edge runtime, it offers a globally distributed, low-latency GraphQL interface for managing schools, users, and academic records.

---

## ⚡ Architecture & Analysis

This backend eschews traditional containerized servers for a **Serverless Edge Architecture**.

### 🏗️ Technical Stack

*   **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/) - Javascript at the Edge.
*   **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) - Serverless SQLite distributed globally.
*   **Web Framework**: [Hono](https://hono.dev/) - Ultra-fast web standard framework for edges.
*   **API Spec**: [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) - Fully compliant GraphQL 2.0 implementation.
*   **ORM**: [Drizzle ORM](https://orm.drizzle.team/) - Type-safe SQL builder with zero runtime overhead.
*   **Protection**:
    *   **JWT Auth**: Stateless authentication using `hono/jwt`.
    *   **Bcrypt**: Secure password hashing.
    *   **Zod**: Strict runtime schema validation for mutations.
    *   **DataLoaders**: Optimized batching to solve the N+1 query problem.

### 🔍 Key Capabilities

1.  **GraphQL Schema**: A rich, deeply nested schema allowing clients to fetch students, their classes, grades, and subject details in a single request.
2.  **Role-Based Security**:
    *   `ensureAdmin()`: middleware protecting sensitive administrative mutations.
    *   `ensureTeacherOrAdmin()`: Middleware for grade management.
    *   **Context Isolation**: Every request is scoped to `schoolId`, preventing data leaks between different schools (Multi-tenant design).
3.  **Performance**:
    *   **Dataloaders** for `classRooms`, `subjects`, and `students` ensure efficient relational data fetching.
    *   **Edge Caching**: Static assets and queries can be cached close to the user.

---

## 📂 Project Structure

```bash
src/
├── db/
│   └── schema.ts       # D1/SQLite Database definitions (Users, Classes, Grades)
├── utils/              # Helper functions
├── index.ts            # Entry point, Hono app, and GraphQL Resolvers
├── loaders.ts          # DataLoader definitions for batching
├── schemas.ts          # Zod validation schemas for Input
└── wrangler.jsonc      # Cloudflare Infrastructure config
```

---

## 🚀 Deployment & Development

### Prerequisites
*   Node.js v18+
*   [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### Local Development

1.  **Install Dependencies**:
    ```bash
    npm install
    ```

2.  **Run Locally (with D1 emulation)**:
    ```bash
    npm run dev
    ```
    API available at `http://localhost:8787/graphql`.

3.  **Database Management**:
    *   Generate Migrations: `npm run db:generate`
    *   Apply Migrations (Local): `npm run db:migrate`
    *   Seed Data (Local): `npm run db:seed`

### Production Deployment

1.  **Deploy to Cloudflare Workers**:
    ```bash
    npm run deploy
    ```

2.  **Production Database**:
    *   Apply Migrations (Remote): `npm run db:migrate:prod` (check `package.json` for specific script aliases)
    *   Seed Remote: `npm run seed:remote`

---

## 🔐 API Security

*   **Authentication**: Bearer Token required for most queries.
*   **Authorization**: Resolvers check `currentUser.role` before execution.
*   **Input Validation**: All mutation arguments are parsed via Zod to prevent injection and invalid states.

---

*Verified Analysis by Antigravity Agent.*
