# School Management API

A comprehensive School Management System API built with **Cloudflare Workers**, **D1 Database**, **Hono Framework**, and **Drizzle ORM**. This API provides complete management capabilities for schools, classes, subjects, teachers, students, grades, and their interconnections.

## 🚀 Live Deployment

**Production URL:** `https://myapp.amroaltayeb14.workers.dev`

## 📋 Table of Contents

- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [User Management](#user-management)
  - [School Management](#school-management)
  - [Class Management](#class-management)
  - [Subject Management](#subject-management)
  - [Connection Management](#connection-management)
  - [Grades Management](#grades-management)

---

## 🛠 Technology Stack

- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Framework:** Hono
- **ORM:** Drizzle ORM
- **Authentication:** JWT (JSON Web Tokens) with bcryptjs
- **Language:** TypeScript

---

## 📊 Database Schema

### Core Tables

#### 1. **user**
Stores all system users (students, teachers, and administrators).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `userName` | TEXT | User's display name |
| `email` | TEXT | Unique email address |
| `password` | TEXT | Hashed password (bcrypt) |
| `role` | TEXT | User role: `student`, `teacher`, or `admin` |
| `createdAt` | TEXT | Timestamp of creation |

#### 2. **school**
Represents educational institutions managed by administrators.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `name` | TEXT | School name |
| `adminId` | INTEGER | Foreign key to `user.id` (admin) |
| `createdAt` | TEXT | Timestamp of creation |

**Relationship:** Each school is managed by one admin user.

#### 3. **classRoom**
Represents individual classes within schools.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `name` | TEXT | Class name |
| `schoolId` | INTEGER | Foreign key to `school.id` |
| `createdAt` | TEXT | Timestamp of creation |

**Relationship:** Each class belongs to one school.

#### 4. **subject**
Represents academic subjects (e.g., Math, Science).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `name` | TEXT | Subject name |
| `createdAt` | TEXT | Timestamp of creation |

### Pivot Tables (Many-to-Many Relationships)

#### 5. **classSubjects**
Links classes with subjects and assigns teachers.

| Column | Type | Description |
|--------|------|-------------|
| `classRoomId` | INTEGER | Foreign key to `classRoom.id` |
| `subjectId` | INTEGER | Foreign key to `subject.id` |
| `teacherId` | INTEGER | Foreign key to `user.id` (teacher) |

**Primary Key:** Composite (`classRoomId`, `subjectId`)

**Relationship:** A teacher teaches a specific subject in a specific class. This allows:
- One subject to be taught in multiple classes
- One teacher to teach multiple subjects
- One class to have multiple subjects with different teachers

#### 6. **enrollments**
Links students to classes.

| Column | Type | Description |
|--------|------|-------------|
| `studentId` | INTEGER | Foreign key to `user.id` (student) |
| `classRoomId` | INTEGER | Foreign key to `classRoom.id` |
| `createdAt` | TEXT | Timestamp of enrollment |

**Primary Key:** Composite (`studentId`, `classRoomId`)

**Relationship:** Students can enroll in multiple classes, and classes can have multiple students.

#### 7. **studentGrades**
Stores student grades for subjects in specific classes.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `studentId` | INTEGER | Foreign key to `user.id` (student) |
| `classRoomId` | INTEGER | Foreign key to `classRoom.id` |
| `subjectId` | INTEGER | Foreign key to `subject.id` |
| `score` | INTEGER | The grade/score value |
| `type` | TEXT | Grade type: `assignment`, `midterm`, or `final` |
| `dateRecorded` | TEXT | Timestamp when grade was recorded |

**Relationship:** Allows tracking multiple grades per student for each subject in each class (e.g., assignments, midterms, finals).

---

## 🔐 Authentication

The API uses **JWT (JSON Web Tokens)** for authentication. Protected endpoints require a valid Bearer token in the `Authorization` header.

### Authentication Flow

1. **Sign Up:** Create a new user account
2. **Login:** Receive a JWT token
3. **Access Protected Routes:** Include token in requests

### Authorization Levels

- **Public:** No authentication required
- **Authenticated:** Valid JWT token required
- **Admin Only:** JWT token with `admin` role required

---

## 📡 API Endpoints

### User Management

#### **POST /users/signup**
Create a new user account.

**Authorization:** Public

**Request Body:**
```json
{
  "userName": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "student"
}
```

**Response (201):**
```json
{
  "id": 1,
  "userName": "John Doe",
  "email": "john@example.com",
  "role": "student",
  "createdAt": "2025-12-16 01:00:00"
}
```

---

#### **POST /users/login**
Authenticate and receive a JWT token.

**Authorization:** Public

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "userName": "John Doe",
    "email": "john@example.com",
    "password": "$2a$10$...",
    "role": "student",
    "createdAt": "2025-12-16 01:00:00"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### **GET /users**
Retrieve all users with their relationships.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 1,
    "userName": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "createdAt": "2025-12-16 01:00:00",
    "classesTaught": [],
    "enrollments": [
      {
        "studentId": 1,
        "classRoomId": 1,
        "createdAt": "2025-12-16 02:00:00"
      }
    ]
  }
]
```

---

#### **GET /users/students**
Retrieve all students with their enrolled classes, subjects, and teachers.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 2,
    "userName": "Alice Student",
    "email": "alice@example.com",
    "role": "student",
    "createdAt": "2025-12-16 01:00:00",
    "enrollments": [
      {
        "classRoom": {
          "name": "Class A",
          "createdAt": "2025-12-16 01:30:00",
          "classSubjects": [
            {
              "subjectId": 1,
              "teacherId": 3,
              "subject": {
                "name": "Mathematics",
                "createdAt": "2025-12-16 01:15:00"
              },
              "teacher": {
                "userName": "Mr. Smith",
                "email": "smith@example.com",
                "role": "teacher",
                "createdAt": "2025-12-16 01:10:00"
              }
            }
          ]
        }
      }
    ]
  }
]
```

---

#### **GET /users/teachers**
Retrieve all teachers with the classes and subjects they teach.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 3,
    "userName": "Mr. Smith",
    "email": "smith@example.com",
    "role": "teacher",
    "createdAt": "2025-12-16 01:10:00",
    "classesTaught": [
      {
        "classRoom": {
          "name": "Class A",
          "createdAt": "2025-12-16 01:30:00"
        },
        "subject": {
          "name": "Mathematics",
          "createdAt": "2025-12-16 01:15:00"
        }
      }
    ]
  }
]
```

---

#### **GET /users/admin**
Retrieve all administrators with their managed schools and classes.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 1,
    "userName": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "createdAt": "2025-12-16 01:00:00",
    "schoolsManaged": [
      {
        "id": 1,
        "name": "Springfield High School",
        "adminId": 1,
        "createdAt": "2025-12-16 01:25:00",
        "classes": [
          {
            "id": 1,
            "name": "Class A",
            "schoolId": 1,
            "createdAt": "2025-12-16 01:30:00"
          }
        ]
      }
    ]
  }
]
```

---

#### **DELETE /users/:id**
Delete a user by ID (cannot delete admins).

**Authorization:** Admin Only

**Response (200):**
```json
{
  "message": "User deleted successfully",
  "userToDelete": [
    {
      "id": 5,
      "role": "student"
    }
  ]
}
```

---

### School Management

#### **POST /schools**
Create a new school.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "name": "Springfield High School",
  "adminId": 1
}
```

**Response (201):**
```json
{
  "school": [
    {
      "id": 1,
      "name": "Springfield High School",
      "adminId": 1,
      "createdAt": "2025-12-16 01:25:00"
    }
  ]
}
```

---

#### **GET /schools**
Retrieve all schools with admin details, classes, subjects, and teachers.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Springfield High School",
    "adminId": 1,
    "createdAt": "2025-12-16 01:25:00",
    "admin": {
      "id": 1,
      "userName": "Admin User",
      "email": "admin@example.com",
      "password": "$2a$10$...",
      "createdAt": "2025-12-16 01:00:00",
      "role": "admin"
    },
    "classes": [
      {
        "id": 1,
        "name": "Class A",
        "schoolId": 1,
        "createdAt": "2025-12-16 01:30:00",
        "classSubjects": [
          {
            "teacher": {
              "id": 3,
              "userName": "Mr. Smith",
              "email": "smith@example.com",
              "password": "$2a$10$...",
              "createdAt": "2025-12-16 01:10:00",
              "role": "teacher"
            },
            "subject": {
              "id": 1,
              "name": "Mathematics",
              "createdAt": "2025-12-16 01:15:00"
            }
          }
        ]
      }
    ]
  }
]
```

---

#### **DELETE /schools/:id**
Delete a school by ID.

**Authorization:** Admin Only

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Springfield High School",
    "adminId": 1,
    "createdAt": "2025-12-16 01:25:00"
  }
]
```

---

### Class Management

#### **POST /classes**
Create a new class in a school.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "name": "Class A",
  "schoolId": 1
}
```

**Response (201):**
```json
{
  "classRoom": [
    {
      "id": 1,
      "name": "Class A",
      "schoolId": 1,
      "createdAt": "2025-12-16 01:30:00"
    }
  ]
}
```

---

#### **GET /classes**
Retrieve all classes with school details, subjects, and teachers.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "classes": [
    {
      "name": "Class A",
      "id": 1,
      "createdAt": "2025-12-16 01:30:00",
      "school": {
        "id": 1,
        "name": "Springfield High School",
        "adminId": 1,
        "createdAt": "2025-12-16 01:25:00"
      },
      "classSubjects": [
        {
          "subject": {
            "id": 1,
            "name": "Mathematics",
            "createdAt": "2025-12-16 01:15:00"
          },
          "teacher": {
            "id": 3,
            "userName": "Mr. Smith",
            "email": "smith@example.com",
            "password": "$2a$10$...",
            "createdAt": "2025-12-16 01:10:00",
            "role": "teacher"
          }
        }
      ]
    }
  ]
}
```

---

#### **DELETE /classes/:id**
Delete a class by ID.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "classRoom": [
    {
      "id": 1,
      "name": "Class A",
      "schoolId": 1,
      "createdAt": "2025-12-16 01:30:00"
    }
  ]
}
```

---

### Subject Management

#### **POST /subjects**
Create a new subject.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "name": "Mathematics"
}
```

**Response (201):**
```json
{
  "subject": [
    {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00"
    }
  ]
}
```

---

#### **GET /subjects**
Retrieve all subjects with classes and teachers.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "subjects": [
    {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00",
      "classesInvolved": [
        {
          "classRoomId": 1,
          "teacher": {
            "id": 3,
            "userName": "Mr. Smith",
            "email": "smith@example.com",
            "password": "$2a$10$...",
            "createdAt": "2025-12-16 01:10:00",
            "role": "teacher"
          }
        }
      ]
    }
  ]
}
```

---

#### **DELETE /subjects/:id**
Delete a subject by ID.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "subject": [
    {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00"
    }
  ]
}
```

---

### Connection Management

#### **POST /connections/connect**
Assign a teacher to teach a subject in a specific class.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "classRoomId": 1,
  "subjectId": 1,
  "teacherId": 3
}
```

**Response (200):**
```json
[
  {
    "classRoomId": 1,
    "subjectId": 1,
    "teacherId": 3
  }
]
```

**Validation:**
- Verifies that the class, subject, and teacher exist
- Ensures the user has the `teacher` role
- Prevents duplicate connections (one subject per class can only have one teacher)

---

#### **DELETE /connections/disconnect**
Remove a teacher's assignment from a class-subject combination.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "classRoomId": 1,
  "subjectId": 1,
  "teacherId": 3
}
```

**Response (200):**
```json
[
  {
    "classRoomId": 1,
    "subjectId": 1,
    "teacherId": 3
  }
]
```

---

#### **GET /connections/all**
Retrieve all class-subject-teacher connections with complete details including school and admin information.

**Authorization:** Authenticated

**Response (200):**
```json
[
  {
    "classSubjects": {
      "classRoomId": 1,
      "subjectId": 1,
      "teacherId": 3
    },
    "classRoom": {
      "id": 1,
      "name": "Class A",
      "schoolId": 1,
      "createdAt": "2025-12-16 01:30:00"
    },
    "subject": {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00"
    },
    "teacher": {
      "id": 3,
      "userName": "Mr. Smith",
      "email": "smith@example.com",
      "password": "$2a$10$...",
      "createdAt": "2025-12-16 01:10:00",
      "role": "teacher"
    },
    "school": {
      "id": 1,
      "name": "Springfield High School",
      "adminId": 1,
      "createdAt": "2025-12-16 01:25:00"
    },
    "admin": {
      "id": 1,
      "userName": "Admin User",
      "email": "admin@example.com",
      "password": "$2a$10$...",
      "createdAt": "2025-12-16 01:00:00",
      "role": "admin"
    }
  }
]
```

---

### Grades Management

#### **POST /grades**
Create a new grade for a student.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "studentId": 2,
  "classRoomId": 1,
  "subjectId": 1,
  "score": 95,
  "type": "final"
}
```

**Response (201):**
```json
{
  "grade": [
    {
      "id": 1,
      "studentId": 2,
      "classRoomId": 1,
      "subjectId": 1,
      "score": 95,
      "type": "final",
      "dateRecorded": "2025-12-16 03:52:30"
    }
  ]
}
```

**Grade Types:**
- `assignment` - Homework or assignment grade
- `midterm` - Midterm exam grade
- `final` - Final exam grade (default)

---

#### **GET /grades**
Retrieve all grades with student, class, and subject details.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 1,
    "score": 95,
    "type": "final",
    "classRoom": {
      "id": 1,
      "name": "Class A"
    },
    "subject": {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00"
    },
    "student": {
      "id": 2,
      "userName": "Alice Student",
      "email": "alice@example.com",
      "role": "student",
      "enrollments": [
        {
          "studentId": 2,
          "classRoomId": 1,
          "createdAt": "2025-12-16 02:00:00"
        }
      ]
    }
  }
]
```

**Description:** This endpoint provides a comprehensive view of all grades, including:
- The grade score and type
- The class where the grade was earned
- The subject for which the grade was given
- Complete student information including their enrollments

---

#### **PUT /grades/:id**
Update an existing grade.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "studentId": 2,
  "classRoomId": 1,
  "subjectId": 1,
  "score": 98,
  "type": "final"
}
```

**Response (200):**
```json
{
  "grade": [
    {
      "id": 1,
      "studentId": 2,
      "classRoomId": 1,
      "subjectId": 1,
      "score": 98,
      "type": "final",
      "dateRecorded": "2025-12-16 03:52:30"
    }
  ]
}
```

---

#### **DELETE /grades/:id**
Delete a grade by ID.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "grade": [
    {
      "id": 1,
      "studentId": 2,
      "classRoomId": 1,
      "subjectId": 1,
      "score": 95,
      "type": "final",
      "dateRecorded": "2025-12-16 03:52:30"
    }
  ]
}
```

---

## 🔑 Environment Variables

The following environment variables are required:

```env
JWT_SECRET=your-secret-key
MY_VAR=your-variable
PRIVATE=your-private-key
```

---

## 🚀 Deployment

### Local Development

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Apply migrations locally
npx wrangler d1 migrations apply myAppD1 --local
```

### Production Deployment

```bash
# Generate migrations
npm run db:generate

# Apply migrations to remote database
npx wrangler d1 migrations apply myAppD1 --remote

# Deploy to Cloudflare Workers
npm run deploy
```

---

## 📝 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

Amro Altayeb

Built with ❤️ using Cloudflare Workers, D1, Hono, and Drizzle ORM.

## 🚀 Live Deployment

**Production URL:** `https://myapp.amroaltayeb14.workers.dev`

## 📋 Table of Contents

- [Technology Stack](#technology-stack)
- [Database Schema](#database-schema)
- [Authentication](#authentication)
- [API Endpoints](#api-endpoints)
  - [User Management](#user-management)
  - [School Management](#school-management)
  - [Class Management](#class-management)
  - [Subject Management](#subject-management)
  - [Connection Management](#connection-management)

---

## 🛠 Technology Stack

- **Runtime:** Cloudflare Workers
- **Database:** Cloudflare D1 (SQLite)
- **Framework:** Hono
- **ORM:** Drizzle ORM
- **Authentication:** JWT (JSON Web Tokens) with bcryptjs
- **Language:** TypeScript

---

## 📊 Database Schema

### Core Tables

#### 1. **user**
Stores all system users (students, teachers, and administrators).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `userName` | TEXT | User's display name |
| `email` | TEXT | Unique email address |
| `password` | TEXT | Hashed password (bcrypt) |
| `role` | TEXT | User role: `student`, `teacher`, or `admin` |
| `createdAt` | TEXT | Timestamp of creation |

#### 2. **school**
Represents educational institutions managed by administrators.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `name` | TEXT | School name |
| `adminId` | INTEGER | Foreign key to `user.id` (admin) |
| `createdAt` | TEXT | Timestamp of creation |

**Relationship:** Each school is managed by one admin user.

#### 3. **classRoom**
Represents individual classes within schools.

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `name` | TEXT | Class name |
| `schoolId` | INTEGER | Foreign key to `school.id` |
| `createdAt` | TEXT | Timestamp of creation |

**Relationship:** Each class belongs to one school.

#### 4. **subject**
Represents academic subjects (e.g., Math, Science).

| Column | Type | Description |
|--------|------|-------------|
| `id` | INTEGER | Primary key (auto-increment) |
| `name` | TEXT | Subject name |
| `createdAt` | TEXT | Timestamp of creation |

### Pivot Tables (Many-to-Many Relationships)

#### 5. **classSubjects**
Links classes with subjects and assigns teachers.

| Column | Type | Description |
|--------|------|-------------|
| `classRoomId` | INTEGER | Foreign key to `classRoom.id` |
| `subjectId` | INTEGER | Foreign key to `subject.id` |
| `teacherId` | INTEGER | Foreign key to `user.id` (teacher) |

**Primary Key:** Composite (`classRoomId`, `subjectId`)

**Relationship:** A teacher teaches a specific subject in a specific class. This allows:
- One subject to be taught in multiple classes
- One teacher to teach multiple subjects
- One class to have multiple subjects with different teachers

#### 6. **enrollments**
Links students to classes.

| Column | Type | Description |
|--------|------|-------------|
| `studentId` | INTEGER | Foreign key to `user.id` (student) |
| `classRoomId` | INTEGER | Foreign key to `classRoom.id` |
| `createdAt` | TEXT | Timestamp of enrollment |

**Primary Key:** Composite (`studentId`, `classRoomId`)

**Relationship:** Students can enroll in multiple classes, and classes can have multiple students.

---

## 🔐 Authentication

The API uses **JWT (JSON Web Tokens)** for authentication. Protected endpoints require a valid Bearer token in the `Authorization` header.

### Authentication Flow

1. **Sign Up:** Create a new user account
2. **Login:** Receive a JWT token
3. **Access Protected Routes:** Include token in requests

### Authorization Levels

- **Public:** No authentication required
- **Authenticated:** Valid JWT token required
- **Admin Only:** JWT token with `admin` role required

---

## 📡 API Endpoints

### User Management

#### **POST /users/signup**
Create a new user account.

**Authorization:** Public

**Request Body:**
```json
{
  "userName": "John Doe",
  "email": "john@example.com",
  "password": "securePassword123",
  "role": "student"
}
```

**Response (201):**
```json
{
  "id": 1,
  "userName": "John Doe",
  "email": "john@example.com",
  "role": "student",
  "createdAt": "2025-12-16 01:00:00"
}
```

---

#### **POST /users/login**
Authenticate and receive a JWT token.

**Authorization:** Public

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "securePassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": 1,
    "userName": "John Doe",
    "email": "john@example.com",
    "password": "$2a$10$...",
    "role": "student",
    "createdAt": "2025-12-16 01:00:00"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

#### **GET /users**
Retrieve all users with their relationships.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 1,
    "userName": "John Doe",
    "email": "john@example.com",
    "role": "student",
    "createdAt": "2025-12-16 01:00:00",
    "classesTaught": [],
    "enrollments": [
      {
        "studentId": 1,
        "classRoomId": 1,
        "createdAt": "2025-12-16 02:00:00"
      }
    ]
  }
]
```

---

#### **GET /users/students**
Retrieve all students with their enrolled classes, subjects, and teachers.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 2,
    "userName": "Alice Student",
    "email": "alice@example.com",
    "role": "student",
    "createdAt": "2025-12-16 01:00:00",
    "enrollments": [
      {
        "classRoom": {
          "name": "Class A",
          "createdAt": "2025-12-16 01:30:00",
          "classSubjects": [
            {
              "subjectId": 1,
              "teacherId": 3,
              "subject": {
                "name": "Mathematics",
                "createdAt": "2025-12-16 01:15:00"
              },
              "teacher": {
                "userName": "Mr. Smith",
                "email": "smith@example.com",
                "role": "teacher",
                "createdAt": "2025-12-16 01:10:00"
              }
            },
            {
              "subjectId": 2,
              "teacherId": 4,
              "subject": {
                "name": "Science",
                "createdAt": "2025-12-16 01:20:00"
              },
              "teacher": {
                "userName": "Ms. Johnson",
                "email": "johnson@example.com",
                "role": "teacher",
                "createdAt": "2025-12-16 01:12:00"
              }
            }
          ]
        }
      }
    ]
  }
]
```

**Description:** This endpoint provides a complete view of each student's academic schedule, showing:
- All classes they're enrolled in
- All subjects taught in each class
- The assigned teacher for each subject

---

#### **GET /users/teachers**
Retrieve all teachers with the classes and subjects they teach.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 3,
    "userName": "Mr. Smith",
    "email": "smith@example.com",
    "role": "teacher",
    "createdAt": "2025-12-16 01:10:00",
    "classesTaught": [
      {
        "classRoom": {
          "name": "Class A",
          "createdAt": "2025-12-16 01:30:00"
        },
        "subject": {
          "name": "Mathematics",
          "createdAt": "2025-12-16 01:15:00"
        }
      },
      {
        "classRoom": {
          "name": "Class B",
          "createdAt": "2025-12-16 01:35:00"
        },
        "subject": {
          "name": "Mathematics",
          "createdAt": "2025-12-16 01:15:00"
        }
      }
    ]
  }
]
```

**Description:** Shows each teacher's teaching assignments across different classes and subjects.

---

#### **GET /users/admin**
Retrieve all administrators with their managed schools and classes.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 1,
    "userName": "Admin User",
    "email": "admin@example.com",
    "role": "admin",
    "createdAt": "2025-12-16 01:00:00",
    "schoolsManaged": [
      {
        "id": 1,
        "name": "Springfield High School",
        "adminId": 1,
        "createdAt": "2025-12-16 01:25:00",
        "classes": [
          {
            "id": 1,
            "name": "Class A",
            "schoolId": 1,
            "createdAt": "2025-12-16 01:30:00"
          },
          {
            "id": 2,
            "name": "Class B",
            "schoolId": 1,
            "createdAt": "2025-12-16 01:35:00"
          }
        ]
      }
    ]
  }
]
```

---

#### **DELETE /users/:id**
Delete a user by ID (cannot delete admins).

**Authorization:** Admin Only

**Response (200):**
```json
{
  "message": "User deleted successfully",
  "userToDelete": [
    {
      "id": 5,
      "role": "student"
    }
  ]
}
```

---

### School Management

#### **POST /schools**
Create a new school.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "name": "Springfield High School",
  "adminId": 1
}
```

**Response (201):**
```json
{
  "school": [
    {
      "id": 1,
      "name": "Springfield High School",
      "adminId": 1,
      "createdAt": "2025-12-16 01:25:00"
    }
  ]
}
```

---

#### **GET /schools**
Retrieve all schools with admin details, classes, subjects, and teachers.

**Authorization:** Public

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Springfield High School",
    "adminId": 1,
    "createdAt": "2025-12-16 01:25:00",
    "admin": {
      "id": 1,
      "userName": "Admin User",
      "email": "admin@example.com",
      "password": "$2a$10$...",
      "createdAt": "2025-12-16 01:00:00",
      "role": "admin"
    },
    "classes": [
      {
        "id": 1,
        "name": "Class A",
        "schoolId": 1,
        "createdAt": "2025-12-16 01:30:00",
        "classSubjects": [
          {
            "teacher": {
              "id": 3,
              "userName": "Mr. Smith",
              "email": "smith@example.com",
              "password": "$2a$10$...",
              "createdAt": "2025-12-16 01:10:00",
              "role": "teacher"
            },
            "subject": {
              "id": 1,
              "name": "Mathematics",
              "createdAt": "2025-12-16 01:15:00"
            }
          }
        ]
      }
    ]
  }
]
```

**Description:** Provides a complete hierarchical view of schools, including all organizational details.

---

#### **DELETE /schools/:id**
Delete a school by ID.

**Authorization:** Admin Only

**Response (200):**
```json
[
  {
    "id": 1,
    "name": "Springfield High School",
    "adminId": 1,
    "createdAt": "2025-12-16 01:25:00"
  }
]
```

---

### Class Management

#### **POST /classes**
Create a new class in a school.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "name": "Class A",
  "schoolId": 1
}
```

**Response (201):**
```json
{
  "classRoom": [
    {
      "id": 1,
      "name": "Class A",
      "schoolId": 1,
      "createdAt": "2025-12-16 01:30:00"
    }
  ]
}
```

---

#### **GET /classes**
Retrieve all classes with school details, subjects, and teachers.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "classes": [
    {
      "name": "Class A",
      "id": 1,
      "createdAt": "2025-12-16 01:30:00",
      "school": {
        "id": 1,
        "name": "Springfield High School",
        "adminId": 1,
        "createdAt": "2025-12-16 01:25:00"
      },
      "classSubjects": [
        {
          "subject": {
            "id": 1,
            "name": "Mathematics",
            "createdAt": "2025-12-16 01:15:00"
          },
          "teacher": {
            "id": 3,
            "userName": "Mr. Smith",
            "email": "smith@example.com",
            "password": "$2a$10$...",
            "createdAt": "2025-12-16 01:10:00",
            "role": "teacher"
          }
        }
      ]
    }
  ]
}
```

---

#### **DELETE /classes/:id**
Delete a class by ID.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "classRoom": [
    {
      "id": 1,
      "name": "Class A",
      "schoolId": 1,
      "createdAt": "2025-12-16 01:30:00"
    }
  ]
}
```

---

### Subject Management

#### **POST /subjects**
Create a new subject.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "name": "Mathematics"
}
```

**Response (201):**
```json
{
  "subject": [
    {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00"
    }
  ]
}
```

---

#### **GET /subjects**
Retrieve all subjects with classes and teachers.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "subjects": [
    {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00",
      "classesInvolved": [
        {
          "classRoomId": 1,
          "teacher": {
            "id": 3,
            "userName": "Mr. Smith",
            "email": "smith@example.com",
            "password": "$2a$10$...",
            "createdAt": "2025-12-16 01:10:00",
            "role": "teacher"
          }
        }
      ]
    }
  ]
}
```

---

#### **DELETE /subjects/:id**
Delete a subject by ID.

**Authorization:** Admin Only

**Response (200):**
```json
{
  "subject": [
    {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00"
    }
  ]
}
```

---

### Connection Management

#### **POST /connections/connect**
Assign a teacher to teach a subject in a specific class.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "classRoomId": 1,
  "subjectId": 1,
  "teacherId": 3
}
```

**Response (200):**
```json
[
  {
    "classRoomId": 1,
    "subjectId": 1,
    "teacherId": 3
  }
]
```

**Validation:**
- Verifies that the class, subject, and teacher exist
- Ensures the user has the `teacher` role
- Prevents duplicate connections (one subject per class can only have one teacher)

---

#### **DELETE /connections/disconnect**
Remove a teacher's assignment from a class-subject combination.

**Authorization:** Admin Only

**Request Body:**
```json
{
  "classRoomId": 1,
  "subjectId": 1,
  "teacherId": 3
}
```

**Response (200):**
```json
[
  {
    "classRoomId": 1,
    "subjectId": 1,
    "teacherId": 3
  }
]
```

---

#### **GET /connections/all**
Retrieve all class-subject-teacher connections with complete details including school and admin information.

**Authorization:** Authenticated

**Response (200):**
```json
[
  {
    "classSubjects": {
      "classRoomId": 1,
      "subjectId": 1,
      "teacherId": 3
    },
    "classRoom": {
      "id": 1,
      "name": "Class A",
      "schoolId": 1,
      "createdAt": "2025-12-16 01:30:00"
    },
    "subject": {
      "id": 1,
      "name": "Mathematics",
      "createdAt": "2025-12-16 01:15:00"
    },
    "teacher": {
      "id": 3,
      "userName": "Mr. Smith",
      "email": "smith@example.com",
      "password": "$2a$10$...",
      "createdAt": "2025-12-16 01:10:00",
      "role": "teacher"
    },
    "school": {
      "id": 1,
      "name": "Springfield High School",
      "adminId": 1,
      "createdAt": "2025-12-16 01:25:00"
    },
    "admin": {
      "id": 1,
      "userName": "Admin User",
      "email": "admin@example.com",
      "password": "$2a$10$...",
      "createdAt": "2025-12-16 01:00:00",
      "role": "admin"
    }
  }
]
```

**Description:** This endpoint performs a complex multi-table join to provide a complete view of the entire educational structure, showing how teachers, subjects, classes, schools, and administrators are interconnected.

---

## 🔑 Environment Variables

The following environment variables are required:

```env
JWT_SECRET=your-secret-key
MY_VAR=your-variable
PRIVATE=your-private-key
```

---

## 🚀 Deployment

### Local Development

```bash
# Install dependencies
npm install

# Run local development server
npm run dev

# Apply migrations locally
npx wrangler d1 migrations apply myAppD1 --local
```

### Production Deployment

```bash
# Generate migrations
npm run db:generate

# Apply migrations to remote database
npx wrangler d1 migrations apply myAppD1 --remote

# Deploy to Cloudflare Workers
npm run deploy
```

---

## 📝 License

This project is licensed under the MIT License.

---

## 👨‍💻 Author

Amro Altayeb

Built with ❤️ using Cloudflare Workers, D1, Hono, and Drizzle ORM.
