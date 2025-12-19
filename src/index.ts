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
  }

  type Mutation {
    login(email: String!, password: String!): AuthPayload!
    createUser(userName: String!, email: String!, role: String!, password: String!, classId: Int): User
    createSchool(name: String!): School
    createClassRoom(name: String!): ClassRoom
    createSubject(name: String!, classId: Int!, teacherId: Int!): Subject
    assignStudentToClass(studentId: Int!, classId: Int!): User
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
        const school = await db.select().from(dbSchema.school).where(eq(dbSchema.school.id, currentUser.schoolId)).get();
        if (!school) return null;
        return school;

      },

      myTeachers: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher'))
        ).all();
      },

      myStudents: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const students = await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).all();

        return students;
      },

      classRooms: async (_, __, { db, currentUser }) => {
        if (!currentUser?.schoolId) throw new Error("Unauthorized");
        return await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
      },
      adminDashboardStats: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");

        const students = await db.select().from(dbSchema.user)
          .where(and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student')))
          .all();

        const teachers = await db.select().from(dbSchema.user)
          .where(and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher')))
          .all();

        const classes = await db.select().from(dbSchema.classRoom)
          .where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
          .all();

        return {
          totalStudents: students.length,
          totalTeachers: teachers.length,
          totalClassRooms: classes.length
        };
      },
      // داخل Query resolver:
      allSchoolData: async (_, __, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");

        if (!currentUser.schoolId) return null;

        const school = await db.select().from(dbSchema.school)
          .where(eq(dbSchema.school.id, currentUser.schoolId))
          .get();

        // إذا لم يجد مدرسة، نرجع null بدلاً من كائن فارغ يسبب خطأ الـ ID
        return school || null;
      },
    },

    Mutation: {
      login: async (_, { email, password }, { db, env }) => {
        const user = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, email)).get();
        console.log("Input Password:", password);
        console.log("DB Hash:", user?.password);
        if (!user || !(await bcrypt.compare(password, user?.password))) {
          throw new Error("Invalid credentials");
        }
        const token = await sign({
          id: user.id,
          role: user.role,
          schoolId: user.schoolId
        }, env.JWT_SECRET);
        return { user, token };
      },

      createSchool: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Admin only");
        const result = await db.insert(dbSchema.school).values({ ...args, adminId: currentUser.id }).returning();
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
        const result = await db.insert(dbSchema.classRoom).values({
          name,
          schoolId: currentUser.schoolId
        }).returning();
        return result[0];
      },

      createSubject: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new Error("Unauthorized");
        const result = await db.insert(dbSchema.subject).values(args).returning();
        return result[0];
      }
    },

    User: {
      class: async (parent, _, { db }) => {
        if (!parent.classId) return null;
        return await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, parent.classId)).get();
      },
      subjectsTaught: async (parent, _, { db }) => {
        return await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.teacherId, parent.id)).all();
      },
    },
    School: {
      admin: async (parent, _, { db }) => await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, parent.adminId)).get(),
      classRooms: async (parent, _, { db }) => await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, parent.id)).all(),
    },
    ClassRoom: {
      subjects: async (parent, _, { db }) => await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.classId, parent.id)).all(),
      students: async (parent, _, { db }) => await db.select().from(dbSchema.user).where(eq(dbSchema.user.classId, parent.id)).all(),
    },
    Subject: {
      teacher: async (parent, _, { db }) => await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, parent.teacherId)).get(),
      class: async (parent, _, { db }) => await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, parent.classId)).get(),
    }
  }
});

// --- 4. Hono & Yoga Integration ---
const yoga = createYoga<GraphQLContext>({ schema, graphqlEndpoint: '/graphql' })

app.all('/graphql', async (c) => {
  const db = drizzle(c.env.myAppD1, { schema: dbSchema });
  const authHeader = c.req.header("Authorization");
  let currentUser = null;

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const payload = await verify(token, c.env.JWT_SECRET);
      currentUser = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, Number(payload.id))).get();
    } catch (e) { console.error("JWT Error"); }
  }

  return yoga.handleRequest(c.req.raw, { db, env: c.env, currentUser });
});

export default app;