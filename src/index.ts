import { drizzle } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import { Hono } from 'hono';
import * as dbSchema from './db/schema';
import bcrypt from 'bcryptjs';
import { createSchema, createYoga } from 'graphql-yoga';
import { sign, verify } from 'hono/jwt';
import { z } from 'zod';
import {
  signupSchema,
  createSchoolSchema,
  createClassRoomSchema,
  createUserSchema,
  createSubjectSchema,
  addGradeSchema
} from './schemas';
import { createLoaders, Loaders } from './loaders';

export type Env = {
  myAppD1: D1Database;
  JWT_SECRET: string;
}

type GraphQLContext = {
  db: ReturnType<typeof drizzle<typeof dbSchema>>;
  env: Env;
  currentUser?: any;
  loaders: Loaders;
};

// --- Helper: Auth & Permissions ---
const ensureAdmin = (currentUser: any) => {
  if (!currentUser || currentUser.role !== 'admin' || !currentUser.schoolId) {
    throw new Error("Unauthorized: Admin access required with a linked school.");
  }
};

const app = new Hono<{ Bindings: Env }>()

const typeDefs = /* GraphQL */ `
  type User {
    id: Int!
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
    id: Int!
    studentId: Int!
    subjectId: Int!
    score: Int!
    subject: Subject
    student: User
  }

  type AuthPayload {
    user: User!
    token: String!
  }

  type School {
    id: Int!
    name: String!
    admin: User
    classRooms: [ClassRoom]
  }

  type Subject {
    id: Int!
    name: String!
    classId: Int
    teacher: User
    class: ClassRoom
  }

  type ClassRoom {
    id: Int!
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
    teacher(id: Int!): User
    myStudents: [User]
    student(id: Int!): User
    classRooms: [ClassRoom]
    subjects: [Subject]
    adminDashboardStats: AdminStats
    studentGrades(studentId: Int!): [StudentGrade]
    getSchoolFullDetails(schoolId: Int!): School
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

const schema = createSchema<GraphQLContext>({
  typeDefs,
  resolvers: {
    Query: {
      me: (_, __, { currentUser }) => currentUser,

      mySchool: async (_, __, { db, currentUser }) => {
        if (!currentUser?.schoolId) return null;
        return await db.select().from(dbSchema.school).where(eq(dbSchema.school.id, currentUser.schoolId)).get();
      },

      myTeachers: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher'))
        ).all();
      },

      teacher: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.id, id), eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher'))
        ).get();
      },

      myStudents: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).all();
      },

      student: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.id, id), eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).get();
      },

      classRooms: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
      },

      subjects: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select({ subject: dbSchema.subject })
          .from(dbSchema.subject)
          .innerJoin(dbSchema.classRoom, eq(dbSchema.subject.classId, dbSchema.classRoom.id))
          .where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
          .all().then(rows => rows.map(r => r.subject));
      },

      adminDashboardStats: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const users = await db.select().from(dbSchema.user).where(eq(dbSchema.user.schoolId, currentUser.schoolId)).all();
        const classes = await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
        return {
          totalStudents: users.filter(u => u.role === 'student').length,
          totalTeachers: users.filter(u => u.role === 'teacher').length,
          totalClassRooms: classes.length
        };
      },

      studentGrades: async (_, { studentId }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const student = await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.id, studentId), eq(dbSchema.user.schoolId, currentUser.schoolId))
        ).get();
        if (!student) throw new Error("Access Denied: Student not in your school");

        const studentIdNumber = Number(studentId);
        return await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, studentIdNumber)).all();
      },

      getSchoolFullDetails: async (_, { schoolId }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        if(!schoolId) throw new Error("School id is required");
        else if(Number(schoolId) !== Number(currentUser.schoolId)) throw new Error("Access Denied: School not in your school");
        const school = await db.select().from(dbSchema.school).where(eq(dbSchema.school.id, schoolId)).get();
        if (!school) throw new Error("School not found");
        return school;
      },
    },

    Mutation: {
      signup: async (_, args, { db }) => {
        const data = signupSchema.parse(args);
        const existing = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, data.email)).get();
        if (existing) throw new Error("Email already registered");

        const hashedPassword = await bcrypt.hash(data.password, 10);
        // FORCE role to 'student'
        const result = await db.insert(dbSchema.user).values({
          email: data.email,
          userName: data.userName,
          password: hashedPassword,
          role: 'student',
          createdAt: new Date().toISOString()
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
        ensureAdmin(currentUser);
        const data = createUserSchema.parse(args);
        const hashedPassword = await bcrypt.hash(data.password, 10);
        const result = await db.insert(dbSchema.user).values({
          ...data,
          password: hashedPassword,
          schoolId: currentUser.schoolId
        }).returning();
        return result[0];
      },

      createSchool: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Auth required");
        const data = createSchoolSchema.parse(args);
        const result = await db.insert(dbSchema.school).values({ name: data.name, adminId: currentUser.id }).returning();
        await db.update(dbSchema.user).set({ schoolId: result[0].id }).where(eq(dbSchema.user.id, currentUser.id));
        return result[0];
      },

      createClassRoom: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const data = createClassRoomSchema.parse(args);
        const result = await db.insert(dbSchema.classRoom).values({
          name: data.name,
          schoolId: currentUser.schoolId
        }).returning();
        return result[0];
      },

      createSubject: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const data = createSubjectSchema.parse(args);
        const classRoom = await db.select().from(dbSchema.classRoom).where(
          and(eq(dbSchema.classRoom.id, data.classId), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
        ).get();
        if (!classRoom) throw new Error("Invalid ClassRoom");

        const result = await db.insert(dbSchema.subject).values(data).returning();
        return result[0];
      },

      addGrade: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const data = addGradeSchema.parse(args);
        const student = await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.id, data.studentId), eq(dbSchema.user.schoolId, currentUser.schoolId))
        ).get();
        if (!student) throw new Error("Student not found in your school");

        const result = await db.insert(dbSchema.studentGrades).values({
          ...data,
          classId: student.classId! // safe bang because student checks usually imply valid data, but logic says classId required for student here
        }).returning();
        return result[0];
      },
    },

    // --- Field Resolvers ---
    User: {
      class: async (p, _, { db }) => p.classId ? db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get() : null,
      subjectsTaught: async (p, _, { db }) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.teacherId, p.id)).all(),
      grades: async (p, _, { db }) => db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, p.id)).all(),
    },
    School: {
      admin: async (p, _, { db }) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.adminId)).get(),
      classRooms: async (p, _, { loaders }) => loaders.classRoomsLoader.load(p.id),
    },
    ClassRoom: {
      subjects: async (p, _, { loaders }) => loaders.subjectsLoader.load(p.id),
      students: async (p, _, { loaders }) => loaders.studentsLoader.load(p.id),
    },
    Subject: {
      teacher: async (p, _, { db }) => p.teacherId ? db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.teacherId)).get() : null,
      class: async (p, _, { db }) => p.classId ? db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get() : null,
    },
    StudentGrade: {
      subject: async (p, _, { db }) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, p.subjectId)).get(),
      student: async (p, _, { db }) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.studentId)).get(),
    }
  }
});

const yoga = createYoga<GraphQLContext>({
  schema,
  graphqlEndpoint: '/graphql',
  cors: {
    origin: ['http://localhost:3000', 'https://955c9608.school-mangemt-system-client.pages.dev'],
    methods: ['POST'],
    credentials: true,
  },
});

app.all('/graphql', async (c) => {
  const db = drizzle(c.env.myAppD1, { schema: dbSchema });
  const authHeader = c.req.header("Authorization");
  let currentUser = null;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const token = authHeader.split(" ")[1];
      const payload = await verify(token, c.env.JWT_SECRET);
      currentUser = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, Number(payload.id))).get();
    } catch (e) {
      console.error("JWT Verification Failed");
    }
  }

  const loaders = createLoaders(db);

  return yoga.handleRequest(c.req.raw, { db, env: c.env, currentUser, loaders });
});

export default app;
