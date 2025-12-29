import { GraphQLError } from "graphql";
import depthLimit from 'graphql-depth-limit';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, like, or, count, inArray } from 'drizzle-orm';
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
  createAdminSchema,
  createScheduleSchema,
  createExamSchema,
  submitExamSchema
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

// Rate Limiting: 100 requests per 15 minutes
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

app.use('*', async (c, next) => {
  const ip = c.req.header('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  const windowMs = 15 * 60 * 1000;
  const maxRequests = 100;

  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + windowMs });
  } else {
    record.count++;
    if (record.count > maxRequests) {
      return c.json({ error: "Too Many Requests - Rate limit exceeded" }, 429);
    }
  }
  await next();
});

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
    schedules: [Schedule]
  }

  type StudentGrade {
    id: Int!
    studentId: Int!
    subjectId: Int!
    score: Int!
    type: String!
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
    schedules: [Schedule]
  }

  type AdminStats {
    totalStudents: Int
    totalTeachers: Int
    totalClassRooms: Int
  }

  type Schedule {
    id: Int!
    classId: Int!
    subjectId: Int!
    subject: Subject
    classRoom: ClassRoom
    day: String!
    startTime: String!
    endTime: String!
  }
  input GradeUpdateInput {
    id: ID!
    score: Int!
  }

  type Exam {
    id: Int!
    title: String!
    type: String!
    description: String
    durationInMinutes: Int!
    subjectId: Int!
    classId: Int!
    teacherId: Int!
    createdAt: String!
    subject: Subject
    class: ClassRoom
    teacher: User
    questions: [Question]
    submissions: [ExamSubmission]
    hasSubmitted: Boolean
  }

  type Question {
    id: Int!
    examId: Int!
    questionText: String!
    options: [String]!
    correctAnswerIndex: Int # Nullable for students
    points: Int!
  }

  type ExamSubmission {
    id: Int!
    studentId: Int!
    examId: Int!
    totalScore: Int!
    answers: String!
    submittedAt: String!
    student: User
    exam: Exam
  }

  input QuestionInput {
    questionText: String!
    options: [String]!
    correctAnswerIndex: Int!
    points: Int!
  }

  input StudentAnswerInput {
    questionId: Int!
    selectedIndex: Int!
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
    schedules: [Schedule]
    adminDashboardStats: AdminStats
    studentGrades(studentId: Int!): [StudentGrade]
    getSchoolFullDetails(schoolId: Int!): School
    topStudents: [User]
    getAvailableExams: [Exam]
    getExam(id: Int!): Exam
    getExamForTaking(id: Int!): Exam
    getTeacherExamReports(examId: Int!): [ExamSubmission]
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
    createSchedule(classId: Int!, subjectId: Int!, day: String!, startTime: String!, endTime: String!): Schedule
    updateSchedule(id: Int!, classId: Int!, subjectId: Int!, day: String!, startTime: String!, endTime: String!): Schedule
    deleteSchedule(id: Int!): Schedule
    createExamWithQuestions(
      title: String!, 
      type: String!,
      description: String, 
      durationInMinutes: Int!, 
      subjectId: Int!, 
      classId: Int!, 
      questions: [QuestionInput!]!
    ): Exam
    submitExamResponse(examId: Int!, answers: [StudentAnswerInput!]!): ExamSubmission
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
        ensureTeacherOrAdmin(currentUser);
        return await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
      },

      classRoom: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.classRoom).where(and(eq(dbSchema.classRoom.id, id), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))).get();
      },

      subjects: async (_, __, { db, currentUser }) => {
        ensureTeacherOrAdmin(currentUser);

        if (currentUser.role === 'teacher') {
          return await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.teacherId, currentUser.id)).all();
        }

        // Admin case: return all subjects in school
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

      schedules: async (_, __, { db, currentUser }) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.schedule).innerJoin(dbSchema.classRoom, eq(dbSchema.schedule.classId, dbSchema.classRoom.id)).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all().then(rows => rows.map(r => r.schedule));
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

      getAvailableExams: async (_, __, { db, currentUser }) => {
        if (!currentUser) return [];

        if (currentUser.role === 'student') {
          if (!currentUser.classId) return [];
          return await db.select().from(dbSchema.exams).where(eq(dbSchema.exams.classId, currentUser.classId)).all();
        }

        if (currentUser.role === 'teacher') {
          return await db.select().from(dbSchema.exams).where(eq(dbSchema.exams.teacherId, currentUser.id)).all();
        }

        if (currentUser.role === 'admin') {
          return await db.select({ exam: dbSchema.exams })
            .from(dbSchema.exams)
            .innerJoin(dbSchema.classRoom, eq(dbSchema.exams.classId, dbSchema.classRoom.id))
            .where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
            .all().then(rows => rows.map(r => r.exam));
        }

        return [];
      },

      getExam: async (_, { id }, { db, currentUser }) => {
        if (!currentUser) throw new GraphQLError("Unauthorized");

        const exam = await db.select().from(dbSchema.exams).where(eq(dbSchema.exams.id, id)).get();
        if (!exam) throw new GraphQLError("Exam not found");

        // Role-based access control
        if (currentUser.role === 'student') {
          if (exam.classId !== currentUser.classId) throw new GraphQLError("This exam is not for your class");
        } else if (currentUser.role === 'teacher') {
          if (exam.teacherId !== currentUser.id) throw new GraphQLError("You do not teach this exam");
        } else if (currentUser.role === 'admin') {
          // Admin has access to all within school, assuming school check implicit or add it
          // Simple school check via classRoom
          const classRoom = await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, exam.classId)).get();
          if (classRoom?.schoolId !== currentUser.schoolId) throw new GraphQLError("Exam not in your school");
        }

        // Return exam without side effects.
        // Questions might still be resolved by sub-resolver, but that's fine as long as we don't start a submission session.
        // Wait, for students we probably shouldn't return questions in the lobby?
        // The `questions` field is part of Exam type.
        // The resolver for `Exam.questions` simply fetches them.
        // If we want to hide them, we'd need logic in `Exam.questions` or return a partial object?
        // But the lobbying page only needs title, desc, duration.
        // We can just rely on the frontend not asking for questions in the value query.

        return exam;
      },

      getExamForTaking: async (_, { id }, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'student') throw new GraphQLError("Only students can take exams.");

        const exam = await db.select().from(dbSchema.exams).where(
          and(eq(dbSchema.exams.id, id), eq(dbSchema.exams.classId, currentUser.classId))
        ).get();
        if (!exam) throw new GraphQLError("Exam not found or not assigned to your class.");
        return exam;
      },

      getTeacherExamReports: async (_, { examId }, { db, currentUser }) => {
        ensureTeacherOrAdmin(currentUser);
        const exam = await db.select().from(dbSchema.exams).where(eq(dbSchema.exams.id, examId)).get();
        if (!exam) throw new GraphQLError("Exam not found.");

        if (currentUser.role === 'teacher' && exam.teacherId !== currentUser.id) {
          throw new GraphQLError("Unauthorized: You can only view reports for your own exams.");
        }

        return await db.select().from(dbSchema.examSubmissions).where(eq(dbSchema.examSubmissions.examId, examId)).all();
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
        return (result as any[])[0];
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
        const data = createUserSchema.parse(args);

        // منع تكرار المستخدم
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

        const existing = await db.select().from(dbSchema.classRoom).where(
          and(eq(dbSchema.classRoom.name, data.name), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))
        ).get();
        if (existing) throw new GraphQLError("Classroom already exists in your school.");

        const result = await db.insert(dbSchema.classRoom).values({
          name: data.name,
          schoolId: currentUser.schoolId
        }).returning();
        return (result as any[])[0];
      },

      createSubject: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const data = createSubjectSchema.parse(args);

        const existing = await db.select().from(dbSchema.subject).where(
          and(eq(dbSchema.subject.name, data.name), eq(dbSchema.subject.classId, data.classId))
        ).get();
        if (existing) throw new GraphQLError("Subject already assigned to this classroom.");

        const result = await db.insert(dbSchema.subject).values(data).returning();
        const newSubject = result[0];

        // Initialize grades for all students in this class
        const studentsInClass = await db.select().from(dbSchema.user).where(
          and(eq(dbSchema.user.classId, data.classId), eq(dbSchema.user.role, 'student'))
        ).all();

        if (studentsInClass.length > 0) {
          await db.insert(dbSchema.studentGrades).values(
            studentsInClass.map(student => ({
              studentId: student.id,
              subjectId: newSubject.id,
              classId: data.classId,
              score: 0
            }))
          );
        }

        return newSubject;
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
        return (result as any[])[0];
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
      createSchedule: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const classRoom = await db.select().from(dbSchema.classRoom).where(and(eq(dbSchema.classRoom.id, args.classId), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))).get();
        if (!classRoom) throw new GraphQLError("ClassRoom not found.");
        const subject = await db.select().from(dbSchema.subject).where(and(eq(dbSchema.subject.id, args.subjectId), eq(dbSchema.subject.classId, classRoom.id))).get();
        if (!subject) throw new GraphQLError("Subject not found.");

        const data = createScheduleSchema.parse(args);

        // 1. Check for ClassRoom Conflict
        const classSchedules = await db.select().from(dbSchema.schedule).where(
          and(
            eq(dbSchema.schedule.classId, classRoom.id),
            eq(dbSchema.schedule.day, data.day)
          )
        ).all();

        const isOverlapping = (start1: string, end1: string, start2: string, end2: string) => {
          return start1 < end2 && end1 > start2;
        };

        const classConflict = classSchedules.find(s => isOverlapping(data.startTime, data.endTime, s.startTime, s.endTime));
        if (classConflict) {
          throw new GraphQLError(`Classroom conflict: This time slot overlaps with ${classConflict.startTime}-${classConflict.endTime}.`);
        }

        // 2. Check for Teacher Conflict
        if (subject.teacherId) {
          // Find all subjects taught by this teacher
          const teacherSubjects = await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.teacherId, subject.teacherId)).all();
          const teacherSubjectIds = teacherSubjects.map(s => s.id);

          if (teacherSubjectIds.length > 0) {
            const teacherSchedules = await db.select().from(dbSchema.schedule).where(
              and(
                inArray(dbSchema.schedule.subjectId, teacherSubjectIds),
                eq(dbSchema.schedule.day, data.day)
              )
            ).all();

            const teacherConflict = teacherSchedules.find(s => isOverlapping(data.startTime, data.endTime, s.startTime, s.endTime));
            if (teacherConflict) {
              throw new GraphQLError(`Teacher conflict: The assigned teacher is already teaching another class at ${teacherConflict.startTime}-${teacherConflict.endTime}.`);
            }
          }
        }

        const result = await db.insert(dbSchema.schedule).values(data).returning();
        return result[0];
      },
      updateSchedule: async (_, args, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const schedule = await db.select().from(dbSchema.schedule).where(eq(dbSchema.schedule.id, args.id)).get();
        if (!schedule) throw new GraphQLError("Schedule not found.");
        const data = createScheduleSchema.parse(args);
        const result = await db.update(dbSchema.schedule).set(data).where(eq(dbSchema.schedule.id, args.id)).returning();
        return result[0];
      },
      deleteSchedule: async (_, { id }, { db, currentUser }) => {
        ensureAdmin(currentUser);
        const schedule = await db.select().from(dbSchema.schedule).where(eq(dbSchema.schedule.id, id)).get();
        if (!schedule) throw new GraphQLError("Schedule not found.");
        const result = await db.delete(dbSchema.schedule).where(eq(dbSchema.schedule.id, id)).returning();
        return result[0];
      },

      createExamWithQuestions: async (_, args, { db, currentUser }) => {
        ensureTeacherOrAdmin(currentUser);
        const data = createExamSchema.parse(args);

        // Validation: Verify if subject exists and belongs to the correct school/teacher
        const subject = await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, data.subjectId)).get();
        if (!subject) throw new GraphQLError("Subject not found.");

        if (currentUser.role === 'teacher' && subject.teacherId !== currentUser.id) {
          throw new GraphQLError("Unauthorized: You can only create exams for subjects you teach.");
        }

        // Verify classId ownership for Admin
        if (currentUser.role === 'admin') {
          const classRoom = await db.select().from(dbSchema.classRoom).where(and(eq(dbSchema.classRoom.id, data.classId), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))).get();
          if (!classRoom) throw new GraphQLError("Classroom not found in your school.");
        }

        // Duplicate Check: Same Title + Type in same Subject + Class
        const existingExam = await db.select().from(dbSchema.exams).where(
          and(
            eq(dbSchema.exams.title, data.title),
            eq(dbSchema.exams.type, data.type),
            eq(dbSchema.exams.subjectId, data.subjectId),
            eq(dbSchema.exams.classId, data.classId)
          )
        ).get();

        if (existingExam) {
          throw new GraphQLError(`An exam of type '${data.type}' with this title already exists for this subject.`);
        }

        const examResult = await db.insert(dbSchema.exams).values({
          title: data.title,
          type: data.type,
          description: data.description,
          durationInMinutes: data.durationInMinutes,
          subjectId: data.subjectId,
          classId: data.classId,
          teacherId: currentUser.role === 'teacher' ? currentUser.id : subject.teacherId,
          createdAt: new Date().toISOString()
        }).returning();

        const newExam = examResult[0] as any;

        if (data.questions.length > 0) {
          await db.insert(dbSchema.questions).values(
            data.questions.map(q => ({
              examId: newExam.id,
              questionText: q.questionText,
              options: JSON.stringify(q.options),
              correctAnswerIndex: q.correctAnswerIndex,
              points: q.points
            }))
          );
        }

        return newExam;
      },

      submitExamResponse: async (_, args, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'student') throw new GraphQLError("Only students can submit exams.");
        const data = submitExamSchema.parse(args);

        const exam = await db.select().from(dbSchema.exams).where(eq(dbSchema.exams.id, data.examId)).get();
        if (!exam) throw new GraphQLError("Exam not found.");

        const questions = await db.select().from(dbSchema.questions).where(eq(dbSchema.questions.examId, data.examId)).all();

        let totalScore = 0;
        for (const answer of data.answers) {
          const question = questions.find(q => q.id === answer.questionId);
          if (question && question.correctAnswerIndex === answer.selectedIndex) {
            totalScore += question.points;
          }
        }

        // Always insert a new record to allow multiple attempts
        const result = await db.insert(dbSchema.examSubmissions).values({
          studentId: currentUser.id,
          examId: data.examId,
          totalScore: totalScore,
          answers: JSON.stringify(data.answers),
          submittedAt: new Date().toISOString()
        }).returning();

        await db.insert(dbSchema.studentGrades).values({
          studentId: currentUser.id,
          subjectId: exam.subjectId,
          classId: exam.classId,
          score: totalScore,
          type: exam.type
        }).run();

        
        return result[0];
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
      },
      schedules: async (p, _, { db }) => {
        if (p.role === 'student' && p.classId) {
          return db.select().from(dbSchema.schedule).where(eq(dbSchema.schedule.classId, p.classId)).all();
        } else if (p.role === 'teacher') {
          const subjects = await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.teacherId, p.id)).all();
          if (subjects.length === 0) return [];
          const subjectIds = subjects.map(s => s.id);
          return db.select().from(dbSchema.schedule).where(inArray(dbSchema.schedule.subjectId, subjectIds)).all();
        }
        return [];
      },
    },

    School: {
      admin: async (p, _, { db }) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.adminId)).get(),
      classRooms: async (p, _, { loaders }) => loaders.classRoomsLoader.load(p.id),
    },

    ClassRoom: {
      subjects: async (p, _, { loaders }) => loaders.subjectsLoader.load(p.id),
      students: async (p, _, { loaders }) => loaders.studentsLoader.load(p.id),
      schedules: async (p, _, { db }) => db.select().from(dbSchema.schedule).where(eq(dbSchema.schedule.classId, p.id)).all(),
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
    },

    Schedule: {
      subject: async (p, _, { db }) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, p.subjectId)).get(),
      classRoom: async (p, _, { db }) => db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get(),
    },

    Exam: {
      subject: async (p, _, { db }) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, p.subjectId)).get(),
      class: async (p, _, { db }) => db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get(),
      teacher: async (p, _, { db }) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.teacherId)).get(),
      questions: async (p, _, { db }) => db.select().from(dbSchema.questions).where(eq(dbSchema.questions.examId, p.id)).all(),
      submissions: async (p, _, { db }) => db.select().from(dbSchema.examSubmissions).where(eq(dbSchema.examSubmissions.examId, p.id)).all(),
      hasSubmitted: async (p, _, { db, currentUser }) => {
        if (!currentUser || currentUser.role !== 'student') return false;
        const sub = await db.select().from(dbSchema.examSubmissions).where(
          and(eq(dbSchema.examSubmissions.examId, p.id), eq(dbSchema.examSubmissions.studentId, currentUser.id))
        ).get();
        return !!sub;
      }
    },

    Question: {
      options: (p) => {
        try {
          return JSON.parse(p.options);
        } catch (e) {
          console.error("Failed to parse options for question", p.id);
          return [];
        }
      },
      correctAnswerIndex: (p, _, { currentUser }) => {
        // Hide correct answer for students
        if (currentUser?.role === 'student') return null;
        return p.correctAnswerIndex;
      },
    },

    ExamSubmission: {
      student: async (p, _, { db }) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.studentId)).get(),
      exam: async (p, _, { db }) => db.select().from(dbSchema.exams).where(eq(dbSchema.exams.id, p.examId)).get(),
    },
  }
});

const yoga = createYoga<GraphQLContext>({
  schema,
  graphqlEndpoint: '/graphql',
  maskedErrors: true, // In production, this masks non-GraphQLErrors with a generic message
  cors: {
    origin: ['https://main.school-management-frontend-66i.pages.dev'],
    methods: ['POST', 'OPTIONS'],
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