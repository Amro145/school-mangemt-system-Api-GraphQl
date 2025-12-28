import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const userRoles = ['admin', 'teacher', 'student'] as const;
export const user = sqliteTable('user', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userName: text('userName').notNull(),
    email: text('email').notNull().unique(),
    password: text('password').notNull(),
    role: text('role').notNull(), // 'admin', 'teacher', 'student'
    schoolId: integer('schoolId').references(() => school.id),
    classId: integer('classId').references(() => classRoom.id),
    createdAt: text('createdAt').default(new Date().toISOString()),
});

export const school = sqliteTable('school', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    adminId: integer('adminId').references(() => user.id),
});

export const classRoom = sqliteTable('classRoom', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    schoolId: integer('schoolId').references(() => school.id).notNull(),
});
export const schedule = sqliteTable('schedule', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    classId: integer('classId').references(() => classRoom.id, { onDelete: 'cascade' }).notNull(),
    subjectId: integer('subjectId').references(() => subject.id, { onDelete: 'cascade' }).notNull(),
    day: text('day').notNull(),
    startTime: text('startTime').notNull(),
    endTime: text('endTime').notNull(),
});

export const subject = sqliteTable('subject', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    classId: integer('classId').references(() => classRoom.id).notNull(),
    teacherId: integer('teacherId').references(() => user.id).notNull(),
});

export const studentGrades = sqliteTable('studentGrades', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('studentId').references(() => user.id).notNull(),
    subjectId: integer('subjectId').references(() => subject.id).notNull(),
    classId: integer('classId').references(() => classRoom.id).notNull(),
    score: integer('score').notNull(),
});

export const exams = sqliteTable('exams', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    title: text('title').notNull(),
    description: text('description'),
    durationInMinutes: integer('durationInMinutes').notNull(),
    subjectId: integer('subjectId').references(() => subject.id, { onDelete: 'cascade' }).notNull(),
    classId: integer('classId').references(() => classRoom.id, { onDelete: 'cascade' }).notNull(),
    teacherId: integer('teacherId').references(() => user.id, { onDelete: 'cascade' }).notNull(),
    createdAt: text('createdAt').default(new Date().toISOString()),
});

export const questions = sqliteTable('questions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    examId: integer('examId').references(() => exams.id, { onDelete: 'cascade' }).notNull(),
    questionText: text('questionText').notNull(),
    options: text('options').notNull(), // JSON string: string[]
    correctAnswerIndex: integer('correctAnswerIndex').notNull(),
    points: integer('points').notNull(),
});

export const examSubmissions = sqliteTable('examSubmissions', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    studentId: integer('studentId').references(() => user.id, { onDelete: 'cascade' }).notNull(),
    examId: integer('examId').references(() => exams.id, { onDelete: 'cascade' }).notNull(),
    totalScore: integer('totalScore').notNull(),
    answers: text('answers').notNull(), // JSON string: { questionId: number, selectedIndex: number }[]
    submittedAt: text('submittedAt').default(new Date().toISOString()),
});
