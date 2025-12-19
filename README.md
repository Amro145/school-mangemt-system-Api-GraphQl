# 🎓 School Management API

[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare_Workers-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://workers.cloudflare.com/)
[![Hono](https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
[![GraphQL](https://img.shields.io/badge/GraphQL-E10098?style=for-the-badge&logo=graphql&logoColor=white)](https://graphql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle_ORM-C5F74F?style=for-the-badge&logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)

> A modern, high-performance GraphQL API for managing schools, classrooms, teachers, students, and grades. Built for the Edge with Cloudflare Workers and D1 Database.

---

## 🚀 Overview

The **School Management API** is a robust backend solution designed to handle the complex data relationships of an educational institution. Leveraging the power of **GraphQL Yoga** and **Hono**, it provides a flexible and type-safe interface for clients. The data persistence layer is powered by **Cloudflare D1** (SQLite) accessed via **Drizzle ORM**, ensuring simplified query building and efficient migrations.

## ✨ Features

- **🔐 Authentication & Authorization**: Secure JWT-based authentication with role-based access control (Admin, Teacher, Student).
- **🏫 School Management**: Create and manage schools, assigning admins to oversee operations.
- **👩‍🏫 Class & Subject Management**: Organize classrooms and assign subjects with dedicated teachers.
- **👥 User Roles**: distinct workflows for Admins (management), Teachers (subjects), and Students (learning).
- **📝 Grading System**: Record and track student performance across different subjects.
- **📊 Admin Dashboard**: Quick statistics on total students, teachers, and classrooms.
- **⚡ Edge Deployment**: Deployed globally on Cloudflare's network for low-latency access.

## 🛠️ Tech Stack

- **Runtime**: [Cloudflare Workers](https://workers.cloudflare.com/)
- **Framework**: [Hono](https://hono.dev/)
- **API Spec**: [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server)
- **Database**: [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite)
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Package Manager**: NPM

## 🏁 Getting Started

Follow these steps to set up the project locally.

### Prerequisites

- [Node.js](https://nodejs.org/) (v16.13.0 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/school-management-api.git
    cd school-management-api
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.dev.vars` file in the root directory and add your secret:
    ```env
    JWT_SECRET=your_super_secret_key
    ```

4.  **Database Setup**
    Initialize the local D1 database:

    *Generate migrations:*
    ```bash
    npm run db:generate
    ```

    *Apply migrations to local database:*
    ```bash
    npx wrangler d1 execute myAppD1 --local --file=./drizzle/[timestamp]_init.sql
    # Or use the convenience script if configured (e.g., npm run db:migrate)
    npm run db:migrate
    ```

    *Seed initial data:*
    ```bash
    npm run db:seed
    ```

### 🏃‍♂️ Running Locally

Start the development server:

```bash
npm run dev
```

Visit the GraphQL Playground at `http://localhost:8787/graphql`.

## 📦 Database Commands

- **Generate Migrations**: `npm run db:generate`
- **Push Schema**: `npm run db:push`
- **Open Studio**: `npm run db:studio` (View your local DB data in a UI)

## 🔍 GraphQL Examples

Here are some common operations you can perform in the Playground:

### 1. Login (Get Token)
```graphql
mutation {
  login(email: "admin@example.com", password: "password123") {
    token
    user {
      id
      userName
      role
    }
  }
}
```

> **Note**: Copy the `token` from the response and add it to the HTTP Headers for protected routes:
> `{ "Authorization": "Bearer <YOUR_TOKEN>" }`

### 2. Get Current User Profile
```graphql
query {
  me {
    id
    userName
    email
    role
    schoolId
  }
}
```

### 3. Create a New School (Admin)
```graphql
mutation {
  createSchool(name: "Springfield Elementary") {
    id
    name
    admin {
      userName
    }
  }
}
```

### 4. Fetch Dashboard Stats
```graphql
query {
  adminDashboardStats {
    totalStudents
    totalTeachers
    totalClassRooms
  }
}
```

## 📂 Project Structure

```
├── drizzle/            # Database migrations
├── src/
│   ├── db/
│   │   ├── schema.ts   # Drizzle table definitions
│   │   └── seed.ts     # Data seeding script
│   ├── index.ts        # Main application entry & GraphQL setup
│   └── ...
├── drizzle.config.ts   # Drizzle configuration
├── package.json        # Dependencies & scripts
└── wrangler.jsonc      # Cloudflare Workers configuration
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is licensed under the [MIT License](LICENSE).
