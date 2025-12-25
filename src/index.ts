import { GraphQLError } from "graphql";
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, count } from 'drizzle-orm';
import { Hono } from 'hono';
import * as dbSchema from './db/schema';
import bcrypt from 'bcryptjs';
import { createSchema, createYoga } from 'graphql-yoga';
import { sign, verify } from 'hono/jwt';
import { cors } from 'hono/cors';
import {
  signupSchema,
  createSchoolSchema,
  createClassRoomSchema,
  createUserSchema,
  createSubjectSchema,
  addGradeSchema,
  createAdminSchema
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
    throw new GraphQLError("Unauthorized: Admin access required with a linked school.", { extensions: { code: "UNAUTHORIZED" } });
  }
};
const ensureTeacherOrAdmin = (currentUser: any) => {
  if (!currentUser) {
    throw new GraphQLError("Unauthorized: Access required.", { extensions: { code: "UNAUTHORIZED" } });
  }

  const allowedRoles = ['admin', 'teacher'];
  if (!allowedRoles.includes(currentUser.role)) {
    throw new GraphQLError("Unauthorized: Sufficient permissions required.", { extensions: { code: "UNAUTHORIZED" } });
  }

  return true;
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
    averageScore: Float
    successRate: Float
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
    grades: [StudentGrade]
    successRate: Float
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
  input GradeUpdateInput {
    id: ID!
    score: Int!
  }

  type Query {
    me: User
    mySchool: School
    myTeachers: [User]
    teacher(id: Int!): User
    myStudents(limit: Int, offset: Int, search: String): [User]
    totalStudentsCount: Int
    student(id: Int!): User
    classRooms: [ClassRoom]
    classRoom(id: Int!): ClassRoom
    subjects: [Subject]
    subject(id: Int!): Subject
    adminDashboardStats: AdminStats
    studentGrades(studentId: Int!): [StudentGrade]
    getSchoolFullDetails(schoolId: Int!): School
    topStudents: [User]
  }

  type Mutation {
    signup(email: String!, password: String!, userName: String!): User!
    login(email: String!, password: String!): AuthPayload!
    createUser(userName: String!, email: String!, role: String!, password: String!, classId: Int): User
    createSchool(name: String!): School
    createClassRoom(name: String!, schoolId: Int): ClassRoom
    createSubject(name: String!, classId: Int!, teacherId: Int!): Subject
    addGrade(studentId: Int!, subjectId: Int!, score: Int!): StudentGrade
    deleteUser(id: Int!): User
    deleteClassRoom(id: Int!): ClassRoom
    deleteSubject(id: Int!): Subject
    updateBulkGrades(grades: [GradeUpdateInput!]!): [StudentGrade!]!
    createAdmin(email: String!, password: String!, userName: String!): User!
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

      myStudents: async (_, { limit, offset, search }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        let query = db.select().from(dbSchema.user).where(
          and(
            eq(dbSchema.user.schoolId, currentUser.schoolId),
            eq(dbSchema.user.role, 'student'),
            search ? or(
              like(dbSchema.user.userName, `%${search}%`),
              like(dbSchema.user.email, `%${search}%`)
            ) : undefined
          )
        ).$dynamic();

        if (limit !== undefined) query = query.limit(limit);
        if (offset !== undefined) query = query.offset(offset);

        return await query.all();
      },

      totalStudentsCount: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const result = await db.select({ value: count() }).from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).get();
        return result?.value ?? 0;
      },

      student: async (_, { id }, { db, currentUser }) => {
        ensureTeacherOrAdmin(currentUser);
        return await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.id, id), eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).get();
      },

      classRooms: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
      },
      classRoom: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        if (!id) throw new GraphQLError("ClassRoom ID is required.");
        const classRoom = await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, id)).get();
        if (!classRoom) throw new GraphQLError("ClassRoom not found.");
        return classRoom;
      },

      subjects: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select({ subject: dbSchema.subject })
          .from(dbSchema.subject)
          .innerJoin(dbSchema.classRoom, eq(dbSchema.subject.classId, dbSchema.classRoom.id))
          .where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
          .all().then(rows => rows.map(r => r.subject));
      },

      subject: async (_, { id }, { db, currentUser }) => {
        ensureTeacherOrAdmin(currentUser);
        return await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, id)).get();
      },

      adminDashboardStats: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const [studentCountResult, teacherCountResult, classCountResult] = await Promise.all([
          db.select({ value: count() }).from(dbSchema.user).where(and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))).get(),
          db.select({ value: count() }).from(dbSchema.user).where(and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher'))).get(),
          db.select({ value: count() }).from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).get()
        ]);
        return {
          totalStudents: studentCountResult?.value ?? 0,
          totalTeachers: teacherCountResult?.value ?? 0,
          totalClassRooms: classCountResult?.value ?? 0
        };
      },

      studentGrades: async (_, { studentId }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const student = await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.id, studentId), eq(dbSchema.user.schoolId, currentUser.schoolId))
        ).get();
        if (!student) throw new GraphQLError("Access Denied: Student not found in your school.");
        return await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, Number(studentId))).all();
      },

      getSchoolFullDetails: async (_, { schoolId }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        if (!schoolId || Number(schoolId) !== Number(currentUser.schoolId)) throw new GraphQLError("Access Denied.");
        const school = await db.select().from(dbSchema.school).where(eq(dbSchema.school.id, schoolId)).get();
        if (!school) throw new GraphQLError("School not found.");
        return school;
      },

      topStudents: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const students = await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).all();

        const studentsWithAverages = await Promise.all(students.map(async (student) => {
          const grades = await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, student.id)).all();
          const avg = grades.length === 0 ? 0 : grades.reduce((acc, g) => acc + g.score, 0) / grades.length;
          return { ...student, avg };
        }));

        return studentsWithAverages.sort((a, b) => b.avg - a.avg).slice(0, 5);
      },
    },

    Mutation: {
      signup: async (_, args, { db }) => {
        const data = signupSchema.parse(args);
        const existing = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, data.email)).get();
        if (existing) throw new GraphQLError("Email already registered.");

        const hashedPassword = await bcrypt.hash(data.password, 10);
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
          throw new GraphQLError("Invalid credentials.");
        }
        const token = await sign({ id: user.id, role: user.role, schoolId: user.schoolId }, env.JWT_SECRET);
        return { user, token };
      },

      createAdmin: async (_, args, { db }) => {
        const data = createAdminSchema.parse(args);
        // منع تكرار المدير
        const existing = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, data.email)).get();
        if (existing) throw new GraphQLError("Admin email already exists.");

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const { id, ...insertData } = data as any;
        return await db.insert(dbSchema.user).values({
          ...insertData,
          password: hashedPassword,
          role: 'admin'
        }).returning().get();
      },

      createSchool: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'admin') throw new GraphQLError("Auth required.");
        const data = createSchoolSchema.parse(args);
        const result = await db.insert(dbSchema.school).values({ name: data.name, adminId: currentUser.id }).returning();
        await db.update(dbSchema.user).set({ schoolId: result[0].id }).where(eq(dbSchema.user.id, currentUser.id));
        return result[0];
      },

      createUser: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        let data;
        try {
          data = createUserSchema.parse(args);
        } catch (error: any) {
          if (error.issues) {
            const messages = error.issues.map((issue: any) => `${issue.path.join('.')}: ${issue.message}`).join(', ');
            throw new GraphQLError(`Validation Error: ${messages}`);
          }
          throw new GraphQLError(`Validation Error: ${error.message}`);
        }

        // Validate Class Existence for Students
        if (data.role === 'student') {
          // data.classId is guaranteed by Zod refinement
          const classRoom = await db.select().from(dbSchema.classRoom).where(
            and(eq(dbSchema.classRoom.id, data.classId!), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
          ).get();
          if (!classRoom) {
            throw new GraphQLError("Invalid Class ID: Class not found in this school.");
          }
        }

        // Prevent duplicate users
        const existingUser = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, data.email)).get();
        if (existingUser) throw new GraphQLError("Identity Conflict: Email already exists.");

        const hashedPassword = await bcrypt.hash(data.password, 10);



        // Transaction wrapper removed to debug "begin params" error
        const result = await db.insert(dbSchema.user).values({
          userName: data.userName,
          email: data.email,
          role: data.role,
          password: hashedPassword,
          schoolId: currentUser.schoolId,
          classId: data.classId || null,
          createdAt: new Date().toISOString()
        }).returning();

        const newUser = result[0];

        if (newUser.role === 'student' && newUser.classId) {
          const subjects = await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.classId, newUser.classId)).all();
          if (subjects.length > 0) {
            await db.insert(dbSchema.studentGrades).values(
              subjects.map(s => ({
                studentId: newUser.id,
                subjectId: s.id,
                classId: newUser.classId!,
                score: 0
              }))
            );
          }
        }
        return newUser;
      },

      createClassRoom: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const data = createClassRoomSchema.parse(args);

        // منع تكرار الفصل في نفس المدرسة
        const existing = await db.select().from(dbSchema.classRoom).where(
          and(eq(dbSchema.classRoom.name, data.name), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
        ).get();
        if (existing) throw new GraphQLError("Classroom already exists in your school.");

        const result = await db.insert(dbSchema.classRoom).values({
          name: data.name,
          schoolId: currentUser.schoolId
        }).returning();
        return result[0];
      },

      createSubject: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const data = createSubjectSchema.parse(args);

        // منع تكرار المادة في نفس الفصل
        const existing = await db.select().from(dbSchema.subject).where(
          and(eq(dbSchema.subject.name, data.name), eq(dbSchema.subject.classId, data.classId))
        ).get();
        if (existing) throw new GraphQLError("Subject already assigned to this classroom.");

        const result = await db.insert(dbSchema.subject).values(data).returning();
        return result[0];
      },

      addGrade: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const data = addGradeSchema.parse(args);
        const student = await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.id, data.studentId), eq(dbSchema.user.schoolId, currentUser.schoolId))
        ).get();
        if (!student) throw new GraphQLError("Student not found.");

        const result = await db.insert(dbSchema.studentGrades).values({
          ...data,
          classId: student.classId!
        }).returning();
        return result[0];
      },

      deleteUser: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const userToDelete = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, id)).get();
        if (!userToDelete || userToDelete.role === 'admin') throw new GraphQLError("Access Denied.");
        const result = await db.delete(dbSchema.user).where(eq(dbSchema.user.id, id)).returning();
        return result[0];
      },

      deleteClassRoom: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const classRoom = await db.select().from(dbSchema.classRoom).where(and(eq(dbSchema.classRoom.id, id), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))).get();
        if (!classRoom) throw new GraphQLError("ClassRoom not found.");
        const result = await db.delete(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, id)).returning();
        return result[0];
      },

      deleteSubject: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const subject = await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, id)).get();
        if (!subject) throw new GraphQLError("Subject not found.");
        const result = await db.delete(dbSchema.subject).where(eq(dbSchema.subject.id, id)).returning();
        return result[0];
      },

      updateBulkGrades: async (_, { grades }, { db, currentUser }) => {
        ensureTeacherOrAdmin(currentUser);
        const updatedGrades = [];
        for (const g of grades) {
          const id = typeof g.id === 'string' ? parseInt(g.id) : g.id;
          const result = await db.update(dbSchema.studentGrades).set({ score: g.score }).where(eq(dbSchema.studentGrades.id, id)).returning();
          if (result && result.length > 0) updatedGrades.push(result[0]);
        }
        return updatedGrades;
      },
    },

    User: {
      class: async (p, _, { db }) => p.classId ? db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get() : null,
      subjectsTaught: async (p, _, { db }) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.teacherId, p.id)).all(),
      grades: async (p, _, { db }) => db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, p.id)).all(),
      averageScore: async (p, _, { db }) => {
        const grades = await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, p.id)).all();
        return grades.length === 0 ? 0 : grades.reduce((acc, g) => acc + g.score, 0) / grades.length;
      },
      successRate: async (p, _, { db }) => {
        const grades = await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, p.id)).all();
        if (grades.length === 0) return 0;
        const passed = grades.filter(g => g.score >= 50).length;
        return (passed / grades.length) * 100;
      }
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
      grades: async (p, _, { db }) => db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.subjectId, p.id)).all(),
      successRate: async (p, _, { db }) => {
        const grades = await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.subjectId, p.id)).all();
        if (grades.length === 0) return 0;
        const passed = grades.filter(g => g.score >= 50).length;
        return (passed / grades.length) * 100;
      }
    },

    StudentGrade: {
      subject: async (p, _, { db }) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, p.subjectId)).get(),
      student: async (p, _, { db }) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.studentId)).get(),
    }
  }
});

const yoga = createYoga<GraphQLContext>({
  schema,
  graphqlEndpoint: '/graphql', maskedErrors: false,
  cors: {
    origin: ['http://localhost:8787', 'https://main.school-management-frontend-66i.pages.dev'],
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
      console.error("JWT Verification Failed.");
    }
  }

  const loaders = createLoaders(db);
  return yoga.handleRequest(c.req.raw, { db, env: c.env, currentUser, loaders });
});

export default app;