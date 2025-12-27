# 🎓 EduDash Backend API

A high-performance, multi-tenant GraphQL API for the EduDash School Management System. Built with **Hono**, **GraphQL Yoga**, and **Drizzle ORM**, and optimized for deployment on **Cloudflare Workers**.

---

## ⚡ Key Features

- **🚀 Serverless First**: Designed for Cloudflare Workers with minimal cold starts and global edge delivery.
- **📊 Multi-Tenant Architecture**: Robust school-based isolation ensuring secure data partitioning.
- **🔐 Enterprise Auth**: JWT-based authentication with role-based access control (RBAC) for Admins, Teachers, and Students.
- **💎 GraphQL Power**: Flexible and efficient data fetching using GraphQL Yoga with optimized `Dataloader` patterns to prevent N+1 queries.
- **🛡️ Secure by Design**:
  - **Rate Limiting**: IP-based protection against brute force.
  - **Depth Limiting**: Protection against resource-exhaustion queries.
  - **CORS Protection**: Restricted access to authorized origins.
  - **Input Validation**: Strict Zod schemas for all mutations.
- **💾 Modern DB Integration**: Drizzle ORM managing data on Cloudflare D1 (SQLite at the edge).

---

## 🛠️ Technology Stack

- **Core**: [Hono](https://hono.dev/)
- **API Layer**: [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) via [Drizzle ORM](https://orm.drizzle.team/)
- **Security**: [jose](https://github.com/panva/jose) (JWT), [Bcrypt.js](https://github.com/dcodeIO/bcrypt.js)
- **Validation**: [Zod](https://zod.dev/)
- **Deployment**: [Wrangler](https://developers.cloudflare.com/workers/wrangler/)

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (current LTS)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-setup/)
- A Cloudflare account with a D1 database named `myAppD1` (configurable in `wrangler.toml`)

### Installation

1. Clone the repository and navigate to the backend directory:
   ```bash
   cd school-mangemt-system-Api-GraphQl
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment variables in `.dev.vars` (for local dev):
   ```env
   JWT_SECRET=your_super_secret_key
   ```

### Development

Run the local development server:
```bash
npm run dev
```
The GraphQL playground will be available at `http://localhost:8787/graphql`.

### Database Management

- **Generate migrations**: `npm run db:generate`
- **Push schema changes**: `npm run db:push`
- **Seed local database**: `npm run db:seed`
- **Seed remote D1**: `npm run seed:remote`

---

## 🌎 Deployment

Deploy to Cloudflare Workers with one command:
```bash
npm run deploy
```

---

## 📝 API Overview

### Core Entities
- **School**: The root tenant object.
- **User**: Admins, Teachers, and Students.
- **ClassRoom**: Physical or virtual learning groups.
- **Subject**: Academic modules linked to teachers and classes.
- **Grade**: Academic performance records.
- **Schedule**: Timetable entries for classes.

### Example Query
```graphql
query GetMyProfile {
  me {
    userName
    role
    averageScore
    schedules {
      day
      startTime
      subject { name }
      classRoom { name }
    }
  }
}
```

---

## ⚖️ License
MIT License - Copyright (c) 2025 EduDash Team
