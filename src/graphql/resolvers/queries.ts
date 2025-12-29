import { eq, and, like, or, count } from 'drizzle-orm';
import * as dbSchema from '../../db/schema';
import { GraphQLContext, ensureAdmin, ensureTeacherOrAdmin } from '../../types/context';
import { GraphQLError } from 'graphql';

export const queries = {
    me: (_: any, __: any, { currentUser }: GraphQLContext) => currentUser,

    mySchool: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
        if (!currentUser?.schoolId) return null;
        return await db.select().from(dbSchema.school).where(eq(dbSchema.school.id, currentUser.schoolId)).get();
    },

    myTeachers: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.user).where(
            and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher'))
        ).all();
    },

    teacher: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.user).where(
            and(eq(dbSchema.user.id, id), eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'teacher'))
        ).get();
    },

    myStudents: async (_: any, { limit, offset, search }: any, { db, currentUser }: GraphQLContext) => {
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

    totalStudentsCount: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const result = await db.select({ value: count() }).from(dbSchema.user).where(
            and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).get();
        return result?.value ?? 0;
    },

    student: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        ensureTeacherOrAdmin(currentUser);
        return await db.select().from(dbSchema.user).where(
            and(eq(dbSchema.user.id, id), eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).get();
    },

    classRooms: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
        ensureTeacherOrAdmin(currentUser);
        return await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all();
    },

    classRoom: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.classRoom).where(and(eq(dbSchema.classRoom.id, id), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))).get();
    },

    subjects: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
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

    subject: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        ensureTeacherOrAdmin(currentUser);
        return await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, id)).get();
    },

    schedules: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        return await db.select().from(dbSchema.schedule).innerJoin(dbSchema.classRoom, eq(dbSchema.schedule.classId, dbSchema.classRoom.id)).where(eq(dbSchema.classRoom.schoolId, currentUser.schoolId)).all().then(rows => rows.map(r => r.schedule));
    },

    adminDashboardStats: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
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

    studentGrades: async (_: any, { studentId }: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const student = await db.select().from(dbSchema.user).where(
            and(eq(dbSchema.user.id, studentId), eq(dbSchema.user.schoolId, currentUser.schoolId))
        ).get();
        if (!student) throw new GraphQLError("Access Denied: Student not found in your school.");
        return await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, Number(studentId))).all();
    },

    getSchoolFullDetails: async (_: any, { schoolId }: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        if (!schoolId || Number(schoolId) !== Number(currentUser.schoolId)) throw new GraphQLError("Access Denied.");
        const school = await db.select().from(dbSchema.school).where(eq(dbSchema.school.id, schoolId)).get();
        if (!school) throw new GraphQLError("School not found.");
        return school;
    },

    topStudents: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const students = await db.select().from(dbSchema.user).where(
            and(eq(dbSchema.user.schoolId, currentUser.schoolId), eq(dbSchema.user.role, 'student'))
        ).all();

        const studentsWithAverages = await Promise.all(students.map(async (student) => {
            const grades = await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, student.id)).all();
            const avg = grades.length === 0 ? 0 : grades.reduce((acc, g) => acc + g.score, 0) / grades.length;
            return { ...student, avg };
        }));

        return studentsWithAverages.sort((a, b: any) => b.avg - a.avg).slice(0, 5);
    },

    getAvailableExams: async (_: any, __: any, { db, currentUser }: GraphQLContext) => {
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

    getExam: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        if (!currentUser) throw new GraphQLError("Unauthorized");

        const exam = await db.select().from(dbSchema.exams).where(eq(dbSchema.exams.id, id)).get();
        if (!exam) throw new GraphQLError("Exam not found");

        // Role-based access control
        if (currentUser.role === 'student') {
            if (exam.classId !== currentUser.classId) throw new GraphQLError("This exam is not for your class");
        } else if (currentUser.role === 'teacher') {
            if (exam.teacherId !== currentUser.id) throw new GraphQLError("You do not teach this exam");
        } else if (currentUser.role === 'admin') {
            const classRoom = await db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, exam.classId)).get();
            if (classRoom?.schoolId !== currentUser.schoolId) throw new GraphQLError("Exam not in your school");
        }

        return exam;
    },

    getExamForTaking: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        if (!currentUser || currentUser.role !== 'student') throw new GraphQLError("Only students can take exams.");

        const exam = await db.select().from(dbSchema.exams).where(
            and(eq(dbSchema.exams.id, id), eq(dbSchema.exams.classId, currentUser.classId))
        ).get();
        if (!exam) throw new GraphQLError("Exam not found or not assigned to your class.");
        return exam;
    },

    getTeacherExamReports: async (_: any, { examId }: any, { db, currentUser }: GraphQLContext) => {
        ensureTeacherOrAdmin(currentUser);
        const exam = await db.select().from(dbSchema.exams).where(eq(dbSchema.exams.id, examId)).get();
        if (!exam) throw new GraphQLError("Exam not found.");

        if (currentUser.role === 'teacher' && exam.teacherId !== currentUser.id) {
            throw new GraphQLError("Unauthorized: You can only view reports for your own exams.");
        }

        return await db.select().from(dbSchema.examSubmissions).where(eq(dbSchema.examSubmissions.examId, examId)).all();
    },
};
