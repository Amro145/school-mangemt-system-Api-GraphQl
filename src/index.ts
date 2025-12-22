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
    throw new GraphQLError("Unauthorized: Admin access required with a linked school.", { extensions: { code: "UNAUTHORIZED" } });
  }
};
const ensureTeacherOrAdmin = (currentUser: any) => {
  if (!currentUser) {
    throw new GraphQLError("Unauthorized: Admin access required with a linked school.", { extensions: { code: "UNAUTHORIZED" } });
  }

  const allowedRoles = ['admin', 'teacher'];
  if (!allowedRoles.includes(currentUser.role)) {
    throw new GraphQLError("Unauthorized: Admin access required with a linked school.", { extensions: { code: "UNAUTHORIZED" } });
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
    subjects: [Subject]
    subject(id: Int!): Subject
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
    deleteUser(id: Int!): User
    deleteClassRoom(id: Int!): ClassRoom
    deleteSubject(id: Int!): Subject
    updateBulkGrades(grades: [GradeUpdateInput!]!): [StudentGrade!]!
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

        if (limit !== undefined) {
          query = query.limit(limit);
        }
        if (offset !== undefined) {
          query = query.offset(offset);
        }

        return await query.all();
      },

      totalStudentsCount: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const result = await db.select({ value: count() }).from(dbSchema.user).where(
          and(
            eq(dbSchema.user.schoolId, currentUser.schoolId),
            eq(dbSchema.user.role, 'student')
          )
        ).get();
        return result?.value ?? 0;
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
      subject: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, id)).get();
      },

      adminDashboardStats: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);

        const [studentCountResult, teacherCountResult, classCountResult] = await Promise.all([
          db.select({ value: count() }).from(dbSchema.user).where(
            and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
          ).get(),
          db.select({ value: count() }).from(dbSchema.user).where(
            and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher'))
          ).get(),
          db.select({ value: count() }).from(dbSchema.classRoom).where(
            eq(dbSchema.classRoom.schoolId, currentUser.schoolId)
          ).get()
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
        if (!student) throw new Error("Access Denied: Student not in your school");

        const studentIdNumber = Number(studentId);
        return await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, studentIdNumber)).all();
      },

      getSchoolFullDetails: async (_, { schoolId }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        if (!schoolId) throw new Error("School id is required");
        else if (Number(schoolId) !== Number(currentUser.schoolId)) throw new Error("Access Denied: School not in your school");
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

        return await db.transaction(async (tx) => {
          const result = await tx.insert(dbSchema.user).values({
            ...data,
            password: hashedPassword,
            schoolId: currentUser.schoolId
          }).returning();

          const newUser = result[0];

          // Logic for auto-initializing grades if the user is a student
          if (newUser.role === 'student' && newUser.classId) {
            const subjects = await tx.select()
              .from(dbSchema.subject)
              .where(eq(dbSchema.subject.classId, newUser.classId))
              .all();

            if (subjects.length > 0) {
              const gradeRecords = subjects.map(subject => ({
                studentId: newUser.id,
                subjectId: subject.id,
                classId: newUser.classId!,
                score: 0
              }));

              await tx.insert(dbSchema.studentGrades).values(gradeRecords);
            }
          }

          return newUser;
        });
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
      deleteUser: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const userToDelete = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, id)).get();
        if (!userToDelete) throw new Error("User not found");
        if (userToDelete.role === 'admin') throw new Error("Access Denied: User not in your school");
        const result = await db.delete(dbSchema.user).where(eq(dbSchema.user.id, id)).returning();
        return result[0];
      },
      deleteClassRoom: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const classRoom = await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, id)).get();
        if (!classRoom) throw new Error("ClassRoom not found");
        if (classRoom.schoolId !== currentUser.schoolId) throw new Error("Access Denied: ClassRoom not in your school");
        const result = await db.delete(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, id)).returning();
        return result[0];
      },
      deleteSubject: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const subject = await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, id)).get();
        const myClassRooms = await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
        if (!subject) throw new Error("Subject not found");
        if (!myClassRooms.some(classRoom => classRoom.id === subject.classId)) throw new Error("Access Denied: Subject not in your school");
        const result = await db.delete(dbSchema.subject).where(eq(dbSchema.subject.id, id)).returning();
        return result[0];
      },
      updateBulkGrades: async (_, { grades }, { db, currentUser }) => {
        ensureTeacherOrAdmin(currentUser);

        const updatedGrades = [];
        for (const g of grades) {
          const id = typeof g.id === 'string' ? parseInt(g.id) : g.id;

          // Check if the grade exists
          const existing = await db.select()
            .from(dbSchema.studentGrades)
            .where(eq(dbSchema.studentGrades.id, id))
            .get();

          if (!existing) {
            throw new GraphQLError(`Grade record with ID ${id} not found.`, {
              extensions: { code: 'NOT_FOUND' }
            });
          }

          // Execute update
          const result = await db.update(dbSchema.studentGrades)
            .set({ score: g.score })
            .where(eq(dbSchema.studentGrades.id, id))
            .returning();

          if (result && result.length > 0) {
            updatedGrades.push(result[0]);
          }
        }

        return updatedGrades;
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
      grades: async (p, _, { db }) => db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.subjectId, p.id)).all(),
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
      console.error("JWT Verification Failed");
    }
  }

  const loaders = createLoaders(db);

  return yoga.handleRequest(c.req.raw, { db, env: c.env, currentUser, loaders });
});

export default app;
