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
// 2. جداول الربط (Pivot Tables)
// --------------------------------------------------

// يحدد المواد الموجودة في الفصل ومن هو المدرس المسؤول عنها
export const classSubjects = sqliteTable("classSubjects", {
    classRoomId: integer("classRoomId", { mode: "number" }).notNull().references(() => classRoom.id, { onDelete: "cascade" }),
    subjectId: integer("subjectId", { mode: "number" }).notNull().references(() => subject.id, { onDelete: "cascade" }),
    teacherId: integer("teacherId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "restrict" }),
}, (t) => ({
    pk: primaryKey({ columns: [t.classRoomId, t.subjectId] }),
}));

// جدول تسجيل الطلاب في الفصول
export const enrollments = sqliteTable("enrollments", {
    studentId: integer("studentId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "cascade" }),
    classRoomId: integer("classRoomId", { mode: "number" }).notNull().references(() => classRoom.id, { onDelete: "cascade" }),

    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.classRoomId] }),
}));



// --------------------------------------------------
// 3. العلاقات (Relations) - ضرورية لعمل Drizzle ORM
// --------------------------------------------------

export const userRelations = relations(user, ({ many, one }) => ({
    schools: one(school, { fields: [user.id], references: [school.adminId] }),
    classesTaught: many(classSubjects), // الفصول والمواد التي يدرسها المدرس
    enrollments: many(enrollments), // تسجيلات الطالب
}));

export const schoolRelations = relations(school, ({ many, one }) => ({
    admin: one(user, { fields: [school.adminId], references: [user.id] }),
    classes: many(classRoom),
    users: many(user), // جميع المستخدمين المرتبطين بالمدرسة
}));

export const classRoomRelations = relations(classRoom, ({ many, one }) => ({
    school: one(school, { fields: [classRoom.schoolId], references: [school.id] }),
    classSubjects: many(classSubjects), // المواد والمدرسون في هذا الفصل
    enrollments: many(enrollments), // الطلاب المسجلون في هذا الفصل
}));

export const subjectRelations = relations(subject, ({ many }) => ({
    classesInvolved: many(classSubjects), // الفصول التي تدرس فيها المادة
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