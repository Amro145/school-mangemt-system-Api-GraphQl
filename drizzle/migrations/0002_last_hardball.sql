PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_classRoom` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`schoolId` integer NOT NULL,
	FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_classRoom`("id", "name", "schoolId") SELECT "id", "name", "schoolId" FROM `classRoom`;--> statement-breakpoint
DROP TABLE `classRoom`;--> statement-breakpoint
ALTER TABLE `__new_classRoom` RENAME TO `classRoom`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_school` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`adminId` integer,
	FOREIGN KEY (`adminId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_school`("id", "name", "adminId") SELECT "id", "name", "adminId" FROM `school`;--> statement-breakpoint
DROP TABLE `school`;--> statement-breakpoint
ALTER TABLE `__new_school` RENAME TO `school`;--> statement-breakpoint
CREATE TABLE `__new_studentGrades` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`studentId` integer NOT NULL,
	`subjectId` integer NOT NULL,
	`classId` integer NOT NULL,
	`score` integer NOT NULL,
	FOREIGN KEY (`studentId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`classId`) REFERENCES `classRoom`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_studentGrades`("id", "studentId", "subjectId", "classId", "score") SELECT "id", "studentId", "subjectId", "classId", "score" FROM `studentGrades`;--> statement-breakpoint
DROP TABLE `studentGrades`;--> statement-breakpoint
ALTER TABLE `__new_studentGrades` RENAME TO `studentGrades`;--> statement-breakpoint
CREATE TABLE `__new_subject` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`classId` integer NOT NULL,
	`teacherId` integer NOT NULL,
	FOREIGN KEY (`classId`) REFERENCES `classRoom`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`teacherId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_subject`("id", "name", "classId", "teacherId") SELECT "id", "name", "classId", "teacherId" FROM `subject`;--> statement-breakpoint
DROP TABLE `subject`;--> statement-breakpoint
ALTER TABLE `__new_subject` RENAME TO `subject`;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userName` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL,
	`schoolId` integer,
	`classId` integer,
	`createdAt` text DEFAULT '2025-12-24T02:14:15.564Z',
	FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`classId`) REFERENCES `classRoom`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "userName", "email", "password", "role", "schoolId", "classId", "createdAt") SELECT "id", "userName", "email", "password", "role", "schoolId", "classId", "createdAt" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);