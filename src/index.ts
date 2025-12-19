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
    mySchool: School
    myTeachers: [User]
    myStudents: [User]
    classRooms: [ClassRoom]
    subjects: [Subject]
    adminDashboardStats: AdminStats
    allSchoolData: School
    studentGrades(studentId: Int!): [StudentGrade]
    subjectGrades(subjectId: Int!): [StudentGrade]
  }

  type Mutation {
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

      myStudents: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).all();
      },

      classRooms: async (_, __, { db, currentUser }) => {
        if (!currentUser?.schoolId) throw new Error("Unauthorized");
        return await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
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
      login: async (_, { email, password }, { db, env }) => {
        const user = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, email)).get();
        if (!user || !(await bcrypt.compare(password, user.password))) {
          throw new Error("Invalid credentials");
        }
        const token = await sign({ id: user.id, role: user.role, schoolId: user.schoolId }, env.JWT_SECRET);
        return { user, token };
      },

      createSchool: async (_, { name }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Admin only");
        const result = await db.insert(dbSchema.school).values({ name, adminId: currentUser.id }).returning();
        return result[0];
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

const yoga = createYoga<GraphQLContext>({ schema, graphqlEndpoint: '/graphql' })

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