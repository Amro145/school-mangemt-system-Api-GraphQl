CREATE TABLE `studentGrades` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `studentId` integer NOT NULL,
    `classRoomId` integer NOT NULL,
    `subjectId` integer NOT NULL,
    `score` integer NOT NULL,
    `type` text DEFAULT 'final',
    `dateRecorded` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (`studentId`) REFERENCES `user` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`classRoomId`) REFERENCES `classRoom` (`id`) ON UPDATE no action ON DELETE cascade,
    FOREIGN KEY (`subjectId`) REFERENCES `subject` (`id`) ON UPDATE no action ON DELETE cascade
);