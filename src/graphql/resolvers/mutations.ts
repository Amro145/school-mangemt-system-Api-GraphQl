import { eq, and, inArray } from 'drizzle-orm';
import * as dbSchema from '../../db/schema';
import { GraphQLContext, ensureAdmin, ensureTeacherOrAdmin } from '../../types/context';
import { GraphQLError } from 'graphql';
import bcrypt from 'bcryptjs';
import { sign } from 'hono/jwt';
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
} from '../../schemas';

export const mutations = {
    signup: async (_: any, args: any, { db }: GraphQLContext) => {
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

    login: async (_: any, { email, password }: any, { db, env }: GraphQLContext) => {
        const user = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, email)).get();
        if (!user || !(await bcrypt.compare(password, user.password))) {
            throw new GraphQLError("Invalid credentials.");
        }
        const token = await sign({ id: user.id, role: user.role, schoolId: user.schoolId }, env.JWT_SECRET);
        return { user, token };
    },

    createAdmin: async (_: any, args: any, { db }: GraphQLContext) => {
        const data = createAdminSchema.parse(args);
        const existing = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, data.email)).get();
        if (existing) throw new GraphQLError("Admin email already exists.");

        const hashedPassword = await bcrypt.hash(data.password, 10);
        const { id, ...insertData } = data as any;
        const result = await db.insert(dbSchema.user).values({
            ...insertData,
            password: hashedPassword,
            role: 'admin',
            createdAt: new Date().toISOString()
        }).returning();
        return result[0];
    },

    createSchool: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
        if (!currentUser || currentUser.role !== 'admin') throw new GraphQLError("Auth required.");
        const data = createSchoolSchema.parse(args);
        const result = await db.insert(dbSchema.school).values({ name: data.name, adminId: currentUser.id }).returning();
        await db.update(dbSchema.user).set({ schoolId: result[0].id }).where(eq(dbSchema.user.id, currentUser.id));
        return result[0];
    },

    createUser: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const data = createUserSchema.parse(args);

        const existingUser = await db.select().from(dbSchema.user).where(eq(dbSchema.user.email, data.email)).get();
        if (existingUser) throw new GraphQLError("Identity Conflict: Email already exists.");

        const hashedPassword = await bcrypt.hash(data.password, 10);

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
                        score: 0,
                        type: 'regular'
                    }))
                );
            }
        }
        return newUser;
    },

    createClassRoom: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
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

    createSubject: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const data = createSubjectSchema.parse(args);

        const existing = await db.select().from(dbSchema.subject).where(
            and(eq(dbSchema.subject.name, data.name), eq(dbSchema.subject.classId, data.classId))
        ).get();
        if (existing) throw new GraphQLError("Subject already assigned to this classroom.");

        const result = await db.insert(dbSchema.subject).values(data).returning();
        const newSubject = result[0];

        const studentsInClass = await db.select().from(dbSchema.user).where(
            and(eq(dbSchema.user.classId, data.classId), eq(dbSchema.user.role, 'student'))
        ).all();

        if (studentsInClass.length > 0) {
            await db.insert(dbSchema.studentGrades).values(
                studentsInClass.map(student => ({
                    studentId: student.id,
                    subjectId: newSubject.id,
                    classId: data.classId,
                    score: 0,
                    type: 'regular'
                }))
            );
        }

        return newSubject;
    },

    addGrade: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const data = addGradeSchema.parse(args);
        const student = await db.select().from(dbSchema.user).where(
            and(eq(dbSchema.user.id, data.studentId), eq(dbSchema.user.schoolId, currentUser.schoolId))
        ).get();
        if (!student) throw new GraphQLError("Student not found.");

        const result = await db.insert(dbSchema.studentGrades).values({
            ...data,
            classId: student.classId!,
            type: 'regular'
        }).returning();
        return (result as any)[0];
    },

    deleteUser: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const userToDelete = await db.select().from(dbSchema.user).where(eq(dbSchema.user.id, id)).get();
        if (!userToDelete || userToDelete.role === 'admin') throw new GraphQLError("Access Denied.");
        const result = await db.delete(dbSchema.user).where(eq(dbSchema.user.id, id)).returning();
        return (result as any)[0];
    },

    deleteClassRoom: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const classRoom = await db.select().from(dbSchema.classRoom).where(and(eq(dbSchema.classRoom.id, id), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))).get();
        if (!classRoom) throw new GraphQLError("ClassRoom not found.");
        const result = await db.delete(dbSchema.classRoom).where(eq(dbSchema.classRoom.id, id)).returning();
        return (result as any)[0];
    },

    deleteSubject: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const subject = await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, id)).get();
        if (!subject) throw new GraphQLError("Subject not found.");
        const result = await db.delete(dbSchema.subject).where(eq(dbSchema.subject.id, id)).returning();
        return (result as any)[0];
    },

    updateBulkGrades: async (_: any, { grades }: any, { db, currentUser }: GraphQLContext) => {
        ensureTeacherOrAdmin(currentUser);
        const updatedGrades = [];
        for (const g of grades) {
            const id = typeof g.id === 'string' ? parseInt(g.id) : g.id;
            const result = await db.update(dbSchema.studentGrades).set({ score: g.score }).where(eq(dbSchema.studentGrades.id, id)).returning();
            if (result && result.length > 0) updatedGrades.push(result[0]);
        }
        return updatedGrades;
    },

    createSchedule: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const classRoom = await db.select().from(dbSchema.classRoom).where(and(eq(dbSchema.classRoom.id, args.classId), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))).get();
        if (!classRoom) throw new GraphQLError("ClassRoom not found.");
        const subject = await db.select().from(dbSchema.subject).where(and(eq(dbSchema.subject.id, args.subjectId), eq(dbSchema.subject.classId, classRoom.id))).get();
        if (!subject) throw new GraphQLError("Subject not found.");

        const data = createScheduleSchema.parse(args);

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

        if (subject.teacherId) {
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
        return (result as any)[0];
    },

    updateSchedule: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const schedule = await db.select().from(dbSchema.schedule).where(eq(dbSchema.schedule.id, args.id)).get();
        if (!schedule) throw new GraphQLError("Schedule not found.");
        const data = createScheduleSchema.parse(args);
        const result = await db.update(dbSchema.schedule).set(data).where(eq(dbSchema.schedule.id, args.id)).returning();
        return (result as any)[0];
    },

    deleteSchedule: async (_: any, { id }: any, { db, currentUser }: GraphQLContext) => {
        ensureAdmin(currentUser);
        const schedule = await db.select().from(dbSchema.schedule).where(eq(dbSchema.schedule.id, id)).get();
        if (!schedule) throw new GraphQLError("Schedule not found.");
        const result = await db.delete(dbSchema.schedule).where(eq(dbSchema.schedule.id, id)).returning();
        return (result as any)[0];
    },

    createExamWithQuestions: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
        ensureTeacherOrAdmin(currentUser);
        const data = createExamSchema.parse(args);

        const subject = await db.select().from(dbSchema.subject).where(eq(dbSchema.subject.id, data.subjectId)).get();
        if (!subject) throw new GraphQLError("Subject not found.");

        if (currentUser.role === 'teacher' && subject.teacherId !== currentUser.id) {
            throw new GraphQLError("Unauthorized: You can only create exams for subjects you teach.");
        }

        if (currentUser.role === 'admin') {
            const classRoom = await db.select().from(dbSchema.classRoom).where(and(eq(dbSchema.classRoom.id, data.classId), eq(dbSchema.classRoom.schoolId, currentUser.schoolId))).get();
            if (!classRoom) throw new GraphQLError("Classroom not found in your school.");
        }

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

        const newExam = (examResult as any)[0];

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

    submitExamResponse: async (_: any, args: any, { db, currentUser }: GraphQLContext) => {
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
};
