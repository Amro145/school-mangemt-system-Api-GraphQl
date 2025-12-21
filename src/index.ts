import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import * as dbSchema from './db/schema';
import bcrypt from 'bcryptjs';
import { createSchema, createYoga } from 'graphql-yoga';
import { sign, verify } from 'hono/jwt';

export type Env = {
  myAppD1: D1Database;
  JWT_SECRET: string;
}

type GraphQLContext = {
  db: ReturnType<typeof drizzle<typeof dbSchema>>;
  env: Env;
  currentUser?: any;
};

const app = new Hono<{ Bindings: Env }>()

// --- 1. GraphQL Schema Definitions ---
const typeDefs = /* GraphQL */ `
  type User {
    id: ID!
    userName: String!
    email: String!
    role: String!
    schoolId: Int
    classId: Int
    createdAt: String!
    class: ClassRoom
    subjectsTaught: [Subject]
    grades: [StudentGrade]
  }

  type StudentGrade {
    id: ID!
    studentId: Int!
    subjectId: Int!
    classId: Int!
    score: Int!
    subject: Subject
    student: User
  }

  type AuthPayload {
    user: User!
    token: String!
  }

  type School {
    id: ID!
    name: String!
    admin: User
    classRooms: [ClassRoom]
  }

  type Subject {
    id: ID!
    name: String!
    classId: Int
    teacher: User
    class: ClassRoom
    grades: [StudentGrade]
  }

  type ClassRoom {
    id: ID!
    name: String!
    schoolId: Int
    subjects: [Subject]
    students: [User]
  }

  type AdminStats {
    totalStudents: Int
    totalTeachers: Int
    totalClassRooms: Int
  }

  type Query {
    me: User
    profile(id: Int!): User
    mySchool: School
    myTeachers: [User]
    techer(id: Int!): User
    myStudents: [User]
    student(id: Int!): User
    classRooms: [ClassRoom]
    classRoom(id: Int!): ClassRoom
    subjects: [Subject]
    subject(id: Int!): Subject
    adminDashboardStats: AdminStats
    allSchoolData: School
    studentGrades(studentId: Int!): [StudentGrade]
    subjectGrades(subjectId: Int!): [StudentGrade]
  }

  type Mutation {
    signup(email: String!, password: String!, userName: String!): User!
    login(email: String!, password: String!): AuthPayload!
    createUser(userName: String!, email: String!, role: String!, password: String!, classId: Int): User
    createSchool(name: String!): School
    createClassRoom(name: String!): ClassRoom
    createSubject(name: String!, classId: Int!, teacherId: Int!): Subject
    addGrade(studentId: Int!, subjectId: Int!, score: Int!): StudentGrade
  }
`;

// --- 2. Resolvers Implementation ---
const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      me: (_, __, { currentUser }) => currentUser,

      profile: async (_, { id }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const user = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, id)).get() || null;
        if (!user) throw new Error("User not found");
        return user;
      },
      mySchool: async (_, __, { db, currentUser }) => {
        if (!currentUser?.schoolId) return null;
        return await db.select().from(dbSchema.school).where(eq(dbSchema.school.id, currentUser.schoolId)).get() || null;
      },

      myTeachers: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher'))
        ).all();
      },
      techer: async (_, { id }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const teacher = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, id)).get() || null;
        if (!teacher || teacher.role !== 'teacher') throw new Error("Teacher not found");
        return teacher;
      },

      myStudents: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).all();
      },
      student: async (_, { id }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const student = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, id)).get() || null;
        if (!student || student.role !== 'student') throw new Error("Student not found");
        return student;
      },

      classRooms: async (_, __, { db, currentUser }) => {
        if (!currentUser?.schoolId) throw new Error("Unauthorized");
        return await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
      },
      classRoom: async (_, { id }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const classRoom = await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, id)).get() || null;
        if (!classRoom) throw new Error("ClassRoom not found");
        return classRoom;
      },

      adminDashboardStats: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const users = await db.select().from(dbSchema.user).where(eq(dbSchema.user.schoolId, currentUser.schoolId)).all();
        const classes = await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();

        return {
          totalStudents: users.filter(u => u.role === 'student').length,
          totalTeachers: users.filter(u => u.role === 'teacher').length,
          totalClassRooms: classes.length
        };
      },
      allSchoolData: async (_, __, { db, currentUser }) => {
        if (!currentUser?.schoolId || currentUser.role !== 'admin') throw new Error("Unauthorized");
        return await db.select().from(dbSchema.school).where(eq(dbSchema.school.id, currentUser.schoolId)).get() || null;
      },
      subjects: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");

        if (!currentUser.schoolId) {
          return []; // إرجاع مصفوفة فارغة بدلاً من null لتجنب أخطاء الفرونت إند
        }

        const result = await db
          .select({
            id: dbSchema.subject.id,
            name: dbSchema.subject.name,
            classId: dbSchema.subject.classId,
            teacherId: dbSchema.subject.teacherId,
            createdAt: dbSchema.subject.createdAt,
          })
          .from(dbSchema.subject)
          .innerJoin(
            dbSchema.classRoom,
            eq(dbSchema.subject.classId, dbSchema.classRoom.id)
          )
          .where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
          .all();

        // 4. التأكد من إرجاع مصفوفة (حتى لو كانت فارغة)
        return result || [];
      },

      subject: async (_, { id }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");

        const result = await db
          .select({ subject: dbSchema.subject })
          .from(dbSchema.subject)
          .innerJoin(dbSchema.classRoom, eq(dbSchema.subject.classId, dbSchema.classRoom.id))
          .where(
            and(
              eq(dbSchema.subject.id, id),
              eq(dbSchema.classRoom.schoolId, currentUser.schoolId)
            )
          )
          .get();
        if (!result) throw new Error("Subject not found or unauthorized");
        return result.subject;
      },
      studentGrades: async (_, { studentId }, { db, currentUser }) => {
        if (!currentUser) throw new Error("Unauthorized");
        const student = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, studentId)).get();
        if (!student || student.schoolId !== currentUser.schoolId) throw new Error("Student not found in your school");
        return await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, studentId)).all();
      },
      subjectGrades: async (_, { subjectId }, { db, currentUser }) => {
        if (!currentUser) throw new Error("Unauthorized");
        const grades = await db.select()
          .from(dbSchema.studentGrades)
          .where(eq(dbSchema.studentGrades.subjectId, subjectId))
          .all();
        return grades;
      },
    },

    Mutation: {
      signup: async (_, { email, password, userName }, { db }) => {
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, email)).get();
        if (user) throw new Error("User already exists");
        const result = await db.insert(dbSchema.user).values({
          email,
          userName,
          password: hashedPassword,
          role: 'admin',
          schoolId: null,
          classId: null,
          createdAt: new Date().toISOString(),
        }).returning();
        return result[0];
      },
      login: async (_, { email, password }, { db, env }) => {
        const user = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, email)).get();
        if (!user || !(await bcrypt.compare(password, user.password))) {
          throw new Error("Invalid credentials");
        }
        const token = await sign({ id: user.id, role: user.role, schoolId: user.schoolId }, env.JWT_SECRET);
        return { user, token };
      },
       createUser: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Admin only");
        const hashedPassword = await bcrypt.hash(args.password, 10);
        const result = await db.insert(dbSchema.user).values({
          ...args,
          password: hashedPassword,
          schoolId: currentUser.schoolId
        }).returning();
        return result[0];
      },
      createSchool: async (_, { name }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Admin only");
        const result = await db.insert(dbSchema.school).values({ name, adminId: currentUser.id }).returning();
        currentUser.schoolId = result[0].id;
        return result[0];
      },
      createClassRoom: async (_, { name }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const result = await db.insert(dbSchema.classRoom).values({ name, schoolId: currentUser.schoolId }).returning();
        return result[0];
      },

      createSubject: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const result = await db.insert(dbSchema.subject).values(args).returning();
        return result[0];
      },

      addGrade: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Only admin can add grades currently");
        const student = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, args.studentId)).get();
        if (!student || student.schoolId !== currentUser.schoolId) throw new Error("Student not found in your school");

        const result = await db.insert(dbSchema.studentGrades).values({
          studentId: args.studentId,
          subjectId: args.subjectId,
          classId: student.classId!,
          score: args.score,
        }).returning();
        return result[0];
      },
    },

    User: {
      class: async (p, _, { db }) => p.classId ? await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get() : null,
      subjectsTaught: async (p, _, { db }) => await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.teacherId, p.id)).all(),
      grades: async (p, _, { db }) => await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, p.id)).all(),
    },
    School: {
      admin: async (p, _, { db }) => await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.adminId)).get(),
      classRooms: async (p, _, { db }) => await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, p.id)).all(),
    },
    ClassRoom: {
      subjects: async (p, _, { db }) => await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.classId, p.id)).all(),
      students: async (p, _, { db }) => await db.select().from(dbSchema.user).where(eq(dbSchema.user.classId, p.id)).all(),
    },
    Subject: {
      teacher: async (p, _, { db }) => p.teacherId ? await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.teacherId)).get() : null,
      class: async (p, _, { db }) => p.classId ? await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get() : null,
      grades: async (p, _, { db }) => await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.subjectId, p.id)).all(),
    },
    StudentGrade: {
      subject: async (p, _, { db }) => await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, p.subjectId)).get(),
      student: async (p, _, { db }) => await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.studentId)).get(),
    }
  }
});

const yoga = createYoga<GraphQLContext>({
  schema, graphqlEndpoint: '/graphql',
  cors: {
    origin: [
      'http://localhost:3000',
      'https://955c9608.school-mangemt-system-client.pages.dev'
    ],
    methods: ['GET', 'POST', 'DELETE', 'PUT'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-graphql-yoga-id'],
    credentials: true, // مهم جداً إذا كنت تستخدم ملفات تعريف الارتباط أو الجلسات
  },
})

app.all('/graphql', async (c) => {
  const db = drizzle(c.env.myAppD1, { schema: dbSchema });
  const authHeader = c.req.header("Authorization");
  let currentUser = null;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const payload = await verify(authHeader.split(" ")[1], c.env.JWT_SECRET);
      currentUser = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, Number(payload.id))).get();
    } catch (e) { console.error("JWT Error"); }
  }

  return yoga.handleRequest(c.req.raw, { db, env: c.env, currentUser });
});

export default app;