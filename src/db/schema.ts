import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, primaryKey, text } from "drizzle-orm/sqlite-core";

export const userRoles = ["student", "teacher", "admin"] as const;

// 1. جدول المستخدمين (تم إضافة schoolId و classId للطلاب)
export const user = sqliteTable("user", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    userName: text("userName", { length: 256 }).notNull(),
    email: text("email", { length: 256 }).notNull().unique(),
    password: text("password", { length: 256 }).notNull(),
    role: text("role", { enum: userRoles }).notNull().default("student"),
    schoolId: integer("schoolId").references(() => school.id, { onDelete: "cascade" }),
    classId: integer("classId").references(() => classRoom.id, { onDelete: "set null" }), // خاصة بالطلاب
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// 2. جدول المدرسة (مرتبط بالآدمن)
export const school = sqliteTable("school", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }).notNull(),
    adminId: integer("adminId").notNull().references(() => user.id, { onDelete: "restrict" }),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// 3. جدول الفصول (مرتبط بالمدرسة)
export const classRoom = sqliteTable("classRoom", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }).notNull(),
    schoolId: integer("schoolId").notNull().references(() => school.id, { onDelete: "cascade" }),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// 4. جدول المواد (مرتبط بالفصل مباشرة كما طلبت)
export const subject = sqliteTable("subject", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }).notNull(),
    classId: integer("classId").references(() => classRoom.id, { onDelete: "cascade" }),
    teacherId: integer("teacherId").references(() => user.id), // المعلم المسؤول عن المادة
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// 5. جدول الدرجات (يربط الطالب بالمادة وبالفصل)
export const studentGrades = sqliteTable("studentGrades", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    studentId: integer("studentId").notNull().references(() => user.id, { onDelete: "cascade" }),
    subjectId: integer("subjectId").notNull().references(() => subject.id, { onDelete: "cascade" }),
    classId: integer("classId").notNull().references(() => classRoom.id),
    score: integer("score").notNull(),
    dateRecorded: text("dateRecorded").notNull().default(sql`CURRENT_TIMESTAMP`),
});

// --------------------------------------------------
// Relations (العلاقات البرمجية لـ Drizzle)
// --------------------------------------------------

export const userRelations = relations(user, ({ one, many }) => ({
    school: one(school, { fields: [user.schoolId], references: [school.id] }),
    class: one(classRoom, { fields: [user.classId], references: [classRoom.id] }),
    subjectsTaught: many(subject), // للمعلم: المواد التي يدرسها
    grades: many(studentGrades), // للطالب: درجاته
}));

export const subjectRelations = relations(subject, ({ one, many }) => ({
    class: one(classRoom, { fields: [subject.classId], references: [classRoom.id] }),
    teacher: one(user, { fields: [subject.teacherId], references: [user.id] }),
    grades: many(studentGrades),
}));