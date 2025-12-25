# ⚡ EduDash API - High Performance Edge Backend

![Cloudflare Workers](https://img.shields.io/badge/Run_On-Cloudflare_Workers-orange?style=for-the-badge&logo=cloudflare)
![GraphQL Yoga](https://img.shields.io/badge/Powered_By-GraphQL_Yoga-magenta?style=for-the-badge&logo=graphql)
![D1 Database](https://img.shields.io/badge/Database-Cloudflare_D1-blue?style=for-the-badge&logo=sqlite)
![TypeScript](https://img.shields.io/badge/Built_With-TypeScript-blue?style=for-the-badge&logo=typescript)

A robust, globally distributed GraphQL API built for the **EduDash School Management System**. Designed with a **Serverless-First** architecture, it delivers milli-second latency responses by running on the Edge.

---

## 🚀 Key Features

### 🛡️ Iron-Clad Security
*   **Role-Based Access Control (RBAC)**: Custom middlewares (`ensureAdmin`, `ensureTeacherOrAdmin`) enforce strict permission boundaries at the resolver level.
*   **Input Validation**: Powered by **Zod**, every mutation input is strictly validated before execution, preventing bad data from ever reaching the database.
*   **Stateless Auth**: Secure **JWT** (JSON Web Token) authentication ensures stateless, scalable user sessions.

### 🧠 Intelligent Logic
*   **Auto-Grade Initialization**: When a new Subject is created, the system **automatically** detects all students in the class and initializes their grade records to `0`. No manual setup required for teachers.
*   **Smart User Creation**: Dynamic validation ensures `Student` accounts must be linked to a Class, while `Teacher` accounts remain flexible.
*   **Multi-Tenancy**: Built-in support for multiple schools. Data is strictly isolated by `schoolId`.

### 🚅 Performance Engineering
*   **The N+1 Problem Solved**: Implements `DataLoader` pattern to batch and cache database requests, ensuring deep GraphQL queries (e.g., *School -> Classes -> Students -> Grades*) resolve in a single database round-trip.
*   **Edge Native**: Deployed on Cloudflare Workers, eliminating cold starts and bringing logic closer to the user.

---

## 🛠️ Technology Stack

| Component | Tech | Description |
| :--- | :--- | :--- |
| **Runtime** | [Cloudflare Workers](https://workers.cloudflare.com/) | V8-based JavaScript runtime at the edge. |
| **API Engine** | [Hono](https://hono.dev/) | Ultra-fast web framework standard for the Edge. |
| **GraphQL** | [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) | Cross-platform GraphQL server with subscriptions support. |
| **Database** | [Cloudflare D1](https://developers.cloudflare.com/d1/) | Distributed serverless SQLite. |
| **ORM** | [Drizzle ORM](https://orm.drizzle.team/) | Type-safe, lightweight abstraction for SQL. |

---

## 📂 Project Structure

```bash
src/
├── 📂 db/
│   └── schema.ts       # Database Tables (Users, Schools, Grades, Subjects)
├── 📂 utils/           # Shared utilities
├── index.ts            # ⚡ Application Entry & GraphQL Resolvers
├── loaders.ts          # 🚀 DataLoaders for Batching
├── schemas.ts          # 🛡️ Zod Validation Definitions
└── wrangler.jsonc      # Cloudflare Environment Configuration
```

---

## 🔌 API Reference (GraphQL)

### Queries
*   `me`: Get current user profile.
*   `myStudents(limit: Int, offset: Int, search: String)`: Paginated student search.
*   `adminDashboardStats`: Real-time counters for the admin dashboard.
*   `classRoom(id: Int!)`: Fetch deeply nested class data.

### Mutations
*   `createUser(...)`: Register new Students/Teachers (Admin only).
*   `createSubject(...)`: Add new curriculum (Triggers auto-grade init).
*   `updateBulkGrades(...)`: Batch update scores for an entire class.

---

## 🏁 Getting Started

### 1. Setup Environment
Install dependencies:
```bash
npm install
```

### 2. Database Migration (Local)
Initialize your local D1 database:
```bash
npm run db:generate
npm run db:migrate:local
```

### 3. Seed Data
Populate with test data:
```bash
npm run db:seed
```

### 4. Run Development Server
```bash
npm run dev
```
> The API will be live at `http://localhost:8787/graphql`.

---

## 📦 Deployment

Deploy to the global Cloudflare network with a single command:

```bash
npm run deploy
```

---

*Verified & Optimized by Antigravity Agent.*
