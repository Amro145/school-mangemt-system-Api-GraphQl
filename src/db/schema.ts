import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, primaryKey, uniqueIndex, text } from "drizzle-orm/sqlite-core";


export const userRoles = ["student", "teacher", "admin"] as const;

export const user = sqliteTable("user", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userName: text("userName", { length: 256 }).notNull(),
    email: text("email", { length: 256 }).notNull().unique(),
    password: text("password", { length: 256 }).notNull(),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
    role: text("role", { enum: userRoles }).notNull().default("student"),
});

export const school = sqliteTable("school", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }).notNull(),
    adminId: integer("adminId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const classRoom = sqliteTable("classRoom", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }).notNull(),
    schoolId: integer("schoolId", { mode: "number" }).notNull().references(() => school.id, { onDelete: "cascade" }),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const subject = sqliteTable("subject", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }).notNull(),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
})


// --------------------------------------------------
// 2. Pivot Tables (Many-to-Many Relationships)
// --------------------------------------------------

// Defines which subjects are taught in each class and which teacher is responsible
export const classSubjects = sqliteTable("classSubjects", {
    classRoomId: integer("classRoomId", { mode: "number" }).notNull().references(() => classRoom.id, { onDelete: "cascade" }),
    subjectId: integer("subjectId", { mode: "number" }).notNull().references(() => subject.id, { onDelete: "cascade" }),
    teacherId: integer("teacherId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "restrict" }),
}, (t) => ({
    pk: primaryKey({ columns: [t.classRoomId, t.subjectId] }),
}));

// Student enrollment in classes
export const enrollments = sqliteTable("enrollments", {
    studentId: integer("studentId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "cascade" }),
    classRoomId: integer("classRoomId", { mode: "number" }).notNull().references(() => classRoom.id, { onDelete: "cascade" }),

    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.classRoomId] }),
}));

export const studentGrades = sqliteTable("studentGrades", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    studentId: integer("studentId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "cascade" }),
    classRoomId: integer("classRoomId", { mode: "number" }).notNull().references(() => classRoom.id, { onDelete: "cascade" }),
    subjectId: integer("subjectId", { mode: "number" }).notNull().references(() => subject.id, { onDelete: "cascade" }),

    score: integer("score", { mode: "number" }).notNull(),
    type: text("type", { enum: ['assignment', 'midterm', 'final'] }).default('final'),

    dateRecorded: text("dateRecorded").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --------------------------------------------------
// 3. Relations - Required for Drizzle ORM
// --------------------------------------------------

export const userRelations = relations(user, ({ many, one }) => ({
    schoolsManaged: many(school),
    classesTaught: many(classSubjects), // Classes and subjects taught by the teacher
    enrollments: many(enrollments), // Student enrollments
    studentGrades: many(studentGrades), // Student has multiple grades
}));

export const schoolRelations = relations(school, ({ many, one }) => ({
    admin: one(user, { fields: [school.adminId], references: [user.id] }),
    classes: many(classRoom),
}));

export const classRoomRelations = relations(classRoom, ({ many, one }) => ({
    school: one(school, { fields: [classRoom.schoolId], references: [school.id] }),
    classSubjects: many(classSubjects), // Subjects and teachers in this class
    enrollments: many(enrollments), // Students enrolled in this class
    studentGrades: many(studentGrades), // Class has multiple grades
}));

export const subjectRelations = relations(subject, ({ many }) => ({
    classesInvolved: many(classSubjects), // Classes where this subject is taught
    studentGrades: many(studentGrades), // Subject has multiple grades
}));

export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
    student: one(user, { fields: [enrollments.studentId], references: [user.id] }),
    classRoom: one(classRoom, { fields: [enrollments.classRoomId], references: [classRoom.id] }),
}));

export const classSubjectsRelations = relations(classSubjects, ({ one }) => ({
    classRoom: one(classRoom, { fields: [classSubjects.classRoomId], references: [classRoom.id] }),
    subject: one(subject, { fields: [classSubjects.subjectId], references: [subject.id] }),
    teacher: one(user, { fields: [classSubjects.teacherId], references: [user.id] }),
}));
export const studentGradesRelations = relations(studentGrades, ({ one }) => ({
    student: one(user, { fields: [studentGrades.studentId], references: [user.id] }),
    classRoom: one(classRoom, { fields: [studentGrades.classRoomId], references: [classRoom.id] }),
    subject: one(subject, { fields: [studentGrades.subjectId], references: [subject.id] }),
}));