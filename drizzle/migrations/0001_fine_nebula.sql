PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE `__new_studentGrades` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `studentId` integer NOT NULL,
    `subjectId` integer NOT NULL,
    `classId` integer NOT NULL,
    `score` integer NOT NULL,
    `dateRecorded` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`studentId`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`subjectId`) REFERENCES `subject` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`classId`) REFERENCES `classRoom` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO
    `__new_studentGrades` (
        "id",
        "studentId",
        "subjectId",
        "classId",
        "score",
        "dateRecorded"
    )
SELECT "id", "studentId", "subjectId", "classId", "score", "dateRecorded"
FROM `studentGrades`;
--> statement-breakpoint
DROP TABLE `studentGrades`;
--> statement-breakpoint
ALTER TABLE `__new_studentGrades` RENAME TO `studentGrades`;
--> statement-breakpoint
CREATE TABLE `__new_user` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `userName` text(256) NOT NULL,
    `email` text(256) NOT NULL,
    `password` text(256) NOT NULL,
    `role` text DEFAULT 'student' NOT NULL,
    `schoolId` integer,
    `classId` integer,
    `createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`schoolId`) REFERENCES `school` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`classId`) REFERENCES `classRoom` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO
    `__new_user` (
        "id",
        "userName",
        "email",
        "password",
        "role",
        "schoolId",
        "classId",
        "createdAt"
    )
SELECT "id", "userName", "email", "password", "role", "schoolId", "classId", "createdAt"
FROM `user`;
--> statement-breakpoint
DROP TABLE `user`;
--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint
PRAGMA foreign_keys = ON;