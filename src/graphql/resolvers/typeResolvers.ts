import { eq, and, inArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema';
import { GraphQLContext } from '../../types/context';

export const typeResolvers = {
    User: {
        class: async (p: any, _: any, { db }: GraphQLContext) => p.classId ? db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get() : null,
        subjectsTaught: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.teacherId, p.id)).all(),
        grades: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, p.id)).all(),
        averageScore: async (p: any, _: any, { db }: GraphQLContext) => {
            const grades = await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, p.id)).all();
            return grades.length === 0 ? 0 : grades.reduce((acc, g) => acc + g.score, 0) / grades.length;
        },
        successRate: async (p: any, _: any, { db }: GraphQLContext) => {
            const grades = await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.studentId, p.id)).all();
            if (grades.length === 0) return 0;
            const passed = grades.filter(g => g.score >= 50).length;
            return (passed / grades.length) * 100;
        },
        schedules: async (p: any, _: any, { db }: GraphQLContext) => {
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
        admin: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.adminId)).get(),
        classRooms: async (p: any, _: any, { loaders }: GraphQLContext) => loaders.classRoomsLoader.load(p.id),
    },

    ClassRoom: {
        subjects: async (p: any, _: any, { loaders }: GraphQLContext) => loaders.subjectsLoader.load(p.id),
        students: async (p: any, _: any, { loaders }: GraphQLContext) => loaders.studentsLoader.load(p.id),
        schedules: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.schedule).where(eq(dbSchema.schedule.classId, p.id)).all(),
    },

    Subject: {
        teacher: async (p: any, _: any, { db }: GraphQLContext) => p.teacherId ? db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.teacherId)).get() : null,
        class: async (p: any, _: any, { db }: GraphQLContext) => p.classId ? db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get() : null,
        grades: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.subjectId, p.id)).all(),
        successRate: async (p: any, _: any, { db }: GraphQLContext) => {
            const grades = await db.select().from(dbSchema.studentGrades).where(eq(dbSchema.studentGrades.subjectId, p.id)).all();
            if (grades.length === 0) return 0;
            const passed = grades.filter(g => g.score >= 50).length;
            return (passed / grades.length) * 100;
        }
    },

    StudentGrade: {
        subject: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, p.subjectId)).get(),
        student: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.studentId)).get(),
    },

    Schedule: {
        subject: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, p.subjectId)).get(),
        classRoom: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get(),
    },

    Exam: {
        subject: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, p.subjectId)).get(),
        class: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, p.classId)).get(),
        teacher: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.teacherId)).get(),
        questions: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.questions).where(eq(dbSchema.questions.examId, p.id)).all(),
        submissions: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.examSubmissions).where(eq(dbSchema.examSubmissions.examId, p.id)).all(),
        hasSubmitted: async (p: any, _: any, { db, currentUser }: GraphQLContext) => {
            if (!currentUser || currentUser.role !== 'student') return false;
            const sub = await db.select().from(dbSchema.examSubmissions).where(
                and(eq(dbSchema.examSubmissions.examId, p.id), eq(dbSchema.examSubmissions.studentId, currentUser.id))
            ).get();
            return !!sub;
        }
    },

    Question: {
        options: (p: any) => {
            try {
                return JSON.parse(p.options);
            } catch (e) {
                console.error("Failed to parse options for question", p.id);
                return [];
            }
        },
        correctAnswerIndex: (p: any, _: any, { currentUser }: GraphQLContext) => {
            if (currentUser?.role === 'student') return null;
            return p.correctAnswerIndex;
        },
    },

    ExamSubmission: {
        student: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.user).where(eq(dbSchema.user.id, p.studentId)).get(),
        exam: async (p: any, _: any, { db }: GraphQLContext) => db.select().from(dbSchema.exams).where(eq(dbSchema.exams.id, p.examId)).get(),
    },
};
