CREATE TABLE `schedule` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `classId` integer NOT NULL,
    `subjectId` integer NOT NULL,
    `day` text NOT NULL,
    `startTime` text NOT NULL,
    `endTime` text NOT NULL,
    FOREIGN KEY (`classId`) REFERENCES `classRoom` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`subjectId`) REFERENCES `subject` (`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys = OFF;
--> statement-breakpoint
CREATE TABLE `__new_user` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `userName` text NOT NULL,
    `email` text NOT NULL,
    `password` text NOT NULL,
    `role` text NOT NULL,
    `schoolId` integer,
    `classId` integer,
    `createdAt` text DEFAULT '2025-12-26T22:48:46.430Z',
    FOREIGN KEY (`schoolId`) REFERENCES `school` (`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`classId`) REFERENCES `classRoom` (`id`) ON UPDATE no action ON DELETE no action
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