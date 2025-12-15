CREATE TABLE `classRoom` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(256) NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `classSubjects` (
	`classRoomId` integer NOT NULL,
	`subjectId` integer NOT NULL,
	`teacherId` integer NOT NULL,
	PRIMARY KEY(`classRoomId`, `subjectId`),
	FOREIGN KEY (`classRoomId`) REFERENCES `classRoom`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`teacherId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `class_subject_teacher_unq` ON `classSubjects` (`classRoomId`,`subjectId`,`teacherId`);--> statement-breakpoint
CREATE TABLE `enrollments` (
	`studentId` integer NOT NULL,
	`classRoomId` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	PRIMARY KEY(`studentId`, `classRoomId`),
	FOREIGN KEY (`studentId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classRoomId`) REFERENCES `classRoom`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `school` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(256) NOT NULL,
	`adminId` integer NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`adminId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `schoolClasses` (
	`schoolId` integer NOT NULL,
	`classRoomId` integer NOT NULL,
	PRIMARY KEY(`schoolId`, `classRoomId`),
	FOREIGN KEY (`schoolId`) REFERENCES `school`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`classRoomId`) REFERENCES `classRoom`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `subject` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text(256) NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teacherSubjects` (
	`teacherId` integer NOT NULL,
	`subjectId` integer NOT NULL,
	PRIMARY KEY(`teacherId`, `subjectId`),
	FOREIGN KEY (`teacherId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`subjectId`) REFERENCES `subject`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userName` text(256) NOT NULL,
	`email` text(256) NOT NULL,
	`password` text(256) NOT NULL,
	`createdAt` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`role` text DEFAULT 'student' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);