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
    adminId: integer("adminId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "cascade" }),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
})
export const classRoom = sqliteTable("classRoom", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }).notNull(),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
})
export const subject = sqliteTable("subject", {
    id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
    name: text("name", { length: 256 }).notNull(),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
})
export const schoolClasses = sqliteTable("schoolClasses", {
    schoolId: integer("schoolId", { mode: "number" }).notNull().references(() => school.id, { onDelete: 'cascade' }),
    classRoomId: integer("classRoomId", { mode: "number" }).notNull().references(() => classRoom.id, { onDelete: 'cascade' }),
}, (t) => ({
    pk: primaryKey({ columns: [t.schoolId, t.classRoomId] }),
}));
export const classSubjects = sqliteTable("classSubjects", {
    classRoomId: integer("classRoomId", { mode: "number" }).notNull().references(() => classRoom.id, { onDelete: "cascade" }),
    subjectId: integer("subjectId", { mode: "number" }).notNull().references(() => subject.id, { onDelete: "cascade" }),
    teacherId: integer("teacherId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "restrict" }),
}, (t) => ({
    pk: primaryKey({ columns: [t.classRoomId, t.subjectId] }),
    unq: uniqueIndex("class_subject_teacher_unq").on(t.classRoomId, t.subjectId, t.teacherId),
}));

export const teacherSubjects = sqliteTable("teacherSubjects", {
    teacherId: integer("teacherId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "cascade" }),
    subjectId: integer("subjectId", { mode: "number" }).notNull().references(() => subject.id, { onDelete: "cascade" }),
}, (t) => ({
    pk: primaryKey({ columns: [t.teacherId, t.subjectId] }),
}));

export const enrollments = sqliteTable("enrollments", {
    studentId: integer("studentId", { mode: "number" }).notNull().references(() => user.id, { onDelete: "cascade" }),
    classRoomId: integer("classRoomId", { mode: "number" }).notNull().references(() => classRoom.id, { onDelete: "cascade" }),
    createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (t) => ({
    pk: primaryKey({ columns: [t.studentId, t.classRoomId] }),
}));

export const userRelations = relations(user, ({ many }) => ({
    taughtSubjects: many(teacherSubjects),
    // الطالب مسجل في فصول
    enrollments: many(enrollments),
    // المسؤول عن المدارس (admin owns schools)
    schools: many(school),
}));
export const schoolRelations = relations(school, ({ many, one }) => ({
    admin: one(user, {
        fields: [school.adminId],
        references: [user.id],
    }),
    classes: many(schoolClasses),
}));
export const classRoomRelations = relations(classRoom, ({ many, one }) => ({
    school: one(schoolClasses, {
        fields: [classRoom.id],
        references: [schoolClasses.classRoomId],
    }),
    subjects: many(classSubjects),
    enrollments: many(enrollments),
}));
export const subjectRelations = relations(subject, ({ many }) => ({
    teachers: many(teacherSubjects),
    classes: many(classSubjects),
}));
export const teacherSubjectsRelations = relations(teacherSubjects, ({ one }) => ({
    teacher: one(user, { fields: [teacherSubjects.teacherId], references: [user.id] }),
    subject: one(subject, { fields: [teacherSubjects.subjectId], references: [subject.id] }),
}));
export const enrollmentsRelations = relations(enrollments, ({ one }) => ({
    student: one(user, { fields: [enrollments.studentId], references: [user.id] }),
    classRoom: one(classRoom, { fields: [enrollments.classRoomId], references: [classRoom.id] }),
}));


// export const users = sqliteTable("users", {
//     id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
//     userName: text("userName", { length: 256 }).notNull(),
//     email: text("email", { length: 256 }).notNull().unique(),
//     password: text("password", { length: 256 }).notNull(),
//     createdAt: text("createdAt").notNull().default(sql`CURRENT_TIMESTAMP`),
// })

// export const userRelation = relations(users, ({ many }) => ({
//     posts: many(posts),
// }))

// export const posts = sqliteTable("posts", {
//     id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
//     userId: integer("userId", { mode: "number" }).notNull().references(() => users.id, { onDelete: "cascade" }),
//     title: text("title", { length: 256 }).notNull(),
//     content: text("content", { length: 256 }).notNull(),
//     timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),
// })

// export const postRelation = relations(posts, ({ one, many }) => ({
//     user: one(users, {
//         fields: [posts.userId],
//         references: [users.id],
//     }),
//     comments: many(comments),
// }))

// export const comments = sqliteTable("comments", {
//     id: integer("id", { mode: "number" }).primaryKey({ autoIncrement: true }),
//     postId: integer("post", { mode: "number" }).notNull()
//         .references(() => posts.id, { onDelete: "cascade" }),
//     content: text("content", { length: 256 }).notNull(),
//     timestamp: text("timestamp").notNull().default(sql`CURRENT_TIMESTAMP`),

// })

// export const commentRelation = relations(comments, ({ one }) => ({
//     post: one(posts, {
//         fields: [comments.postId],
//         references: [posts.id],
//     })
// }))