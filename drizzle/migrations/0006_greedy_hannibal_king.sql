CREATE TABLE `examSubmissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`studentId` integer NOT NULL,
	`examId` integer NOT NULL,
	`totalScore` integer NOT NULL,
	`answers` text NOT NULL,
	`submittedAt` text DEFAULT '2025-12-28T01:12:17.943Z',
	FOREIGN KEY (`studentId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `exams` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`durationInMinutes` integer NOT NULL,
	`subjectId` integer NOT NULL,
	`classId` integer NOT NULL,
	`teacherId` integer NOT NULL,
	`createdAt` text DEFAULT '2025-12-28T01:12:17.942Z',
	FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classId`) REFERENCES `classRoom`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacherId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `questions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`examId` integer NOT NULL,
	`questionText` text NOT NULL,
	`options` text NOT NULL,
	`correctAnswerIndex` integer NOT NULL,
	`points` integer NOT NULL,
	FOREIGN KEY (`examId`) REFERENCES `exams`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userName` text NOT NULL,
	`email` text NOT NULL,
	`password` text NOT NULL,
	`role` text NOT NULL,
	`schoolId` integer,
	`classId` integer,
	`createdAt` text DEFAULT '2025-12-28T01:12:17.935Z',
	FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`classId`) REFERENCES `classRoom`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "userName", "email", "password", "role", "schoolId", "classId", "createdAt") SELECT "id", "userName", "email", "password", "role", "schoolId", "classId", "createdAt" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);