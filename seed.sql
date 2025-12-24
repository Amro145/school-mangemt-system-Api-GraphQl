PRAGMA foreign_keys = OFF;

-- 1. Reset Database and System Sequences
DELETE FROM "studentGrades";

DELETE FROM "subject";

DELETE FROM "classRoom";

DELETE FROM "school";

DELETE FROM "user";

DELETE FROM sqlite_sequence;

-- 2. Infrastructure (Admins & Schools)
-- Password: amroamro -> $2b$10$03YBu6wvZzm5f/BBF75MteaP1n6gvqGTTIXN/TXAurbuZKjzMyC9O
INSERT INTO
    "user" (
        id,
        userName,
        email,
        password,
        role,
        createdAt
    )
VALUES (
        1,
        'Admin One',
        'admin1@school.edu',
        '$2b$10$03YBu6wvZzm5f/BBF75MteaP1n6gvqGTTIXN/TXAurbuZKjzMyC9O',
        'admin',
        strftime ('%Y-%m-%dT%H:%M:%SZ', 'now')
    ),
    (
        2,
        'Admin Two',
        'admin2@school.edu',
        '$2b$10$03YBu6wvZzm5f/BBF75MteaP1n6gvqGTTIXN/TXAurbuZKjzMyC9O',
        'admin',
        strftime ('%Y-%m-%dT%H:%M:%SZ', 'now')
    );

INSERT INTO
    "school" (id, name, adminId)
VALUES (
        1,
        'Cloudflare High School',
        1
    ),
    (2, 'Edge Academy', 2);

-- Link Admins to their schools
UPDATE "user" SET schoolId = 1 WHERE id = 1;

UPDATE "user" SET schoolId = 2 WHERE id = 2;

-- 3. Academic Faculty (Teachers)
INSERT INTO
    "user" (
        id,
        userName,
        email,
        password,
        role,
        schoolId,
        createdAt
    )
VALUES (
        3,
        'Teacher A1',
        'teacher1@school.edu',
        '$2b$10$03YBu6wvZzm5f/BBF75MteaP1n6gvqGTTIXN/TXAurbuZKjzMyC9O',
        'teacher',
        1,
        strftime ('%Y-%m-%dT%H:%M:%SZ', 'now')
    ),
    (
        4,
        'Teacher A2',
        'teacher2@school.edu',
        '$2b$10$03YBu6wvZzm5f/BBF75MteaP1n6gvqGTTIXN/TXAurbuZKjzMyC9O',
        'teacher',
        1,
        strftime ('%Y-%m-%dT%H:%M:%SZ', 'now')
    ),
    (
        5,
        'Teacher B1',
        'teacher3@school.edu',
        '$2b$10$03YBu6wvZzm5f/BBF75MteaP1n6gvqGTTIXN/TXAurbuZKjzMyC9O',
        'teacher',
        2,
        strftime ('%Y-%m-%dT%H:%M:%SZ', 'now')
    ),
    (
        6,
        'Teacher B2',
        'teacher4@school.edu',
        '$2b$10$03YBu6wvZzm5f/BBF75MteaP1n6gvqGTTIXN/TXAurbuZKjzMyC9O',
        'teacher',
        2,
        strftime ('%Y-%m-%dT%H:%M:%SZ', 'now')
    );

-- 4. Classrooms (8 per school)
INSERT INTO
    "classRoom" (id, name, schoolId)
VALUES
    -- School 1
    (1, 'Grade 1-A', 1),
    (2, 'Grade 1-B', 1),
    (3, 'Grade 2-A', 1),
    (4, 'Grade 2-B', 1),
    (5, 'Grade 3-A', 1),
    (6, 'Grade 3-B', 1),
    (7, 'Grade 4-A', 1),
    (8, 'Grade 4-B', 1),
    -- School 2
    (9, 'Grade 1-C', 2),
    (10, 'Grade 1-D', 2),
    (11, 'Grade 2-C', 2),
    (12, 'Grade 2-D', 2),
    (13, 'Grade 3-C', 2),
    (14, 'Grade 3-D', 2),
    (15, 'Grade 4-C', 2),
    (16, 'Grade 4-D', 2);

-- 5. Subjects (6 per classroom, alternating teachers)
-- Split into smaller batches to avoid 'too many terms' error
INSERT INTO
    "subject" (name, classId, teacherId)
SELECT
    sub.name,
    c.id,
    CASE
        WHEN (sub.row_num % 2) = 0 THEN 4
        ELSE 3
    END
FROM "classRoom" c
    CROSS JOIN (
        SELECT 'Mathematics' as name, 1 as row_num
        UNION ALL
        SELECT 'Physics', 2
        UNION ALL
        SELECT 'Chemistry', 3
    ) sub
WHERE
    c.schoolId = 1;

INSERT INTO
    "subject" (name, classId, teacherId)
SELECT
    sub.name,
    c.id,
    CASE
        WHEN (sub.row_num % 2) = 0 THEN 4
        ELSE 3
    END
FROM "classRoom" c
    CROSS JOIN (
        SELECT 'History' as name, 4 as row_num
        UNION ALL
        SELECT 'English', 5
        UNION ALL
        SELECT 'Computer Science', 6
    ) sub
WHERE
    c.schoolId = 1;

INSERT INTO
    "subject" (name, classId, teacherId)
SELECT
    sub.name,
    c.id,
    CASE
        WHEN (sub.row_num % 2) = 0 THEN 6
        ELSE 5
    END
FROM "classRoom" c
    CROSS JOIN (
        SELECT 'Mathematics' as name, 1 as row_num
        UNION ALL
        SELECT 'Physics', 2
        UNION ALL
        SELECT 'Chemistry', 3
    ) sub
WHERE
    c.schoolId = 2;

INSERT INTO
    "subject" (name, classId, teacherId)
SELECT
    sub.name,
    c.id,
    CASE
        WHEN (sub.row_num % 2) = 0 THEN 6
        ELSE 5
    END
FROM "classRoom" c
    CROSS JOIN (
        SELECT 'History' as name, 4 as row_num
        UNION ALL
        SELECT 'English', 5
        UNION ALL
        SELECT 'Computer Science', 6
    ) sub
WHERE
    c.schoolId = 2;

-- 6. Student Body (20 per classroom = 320 total)
WITH RECURSIVE
    nums (n) AS (
        SELECT 1
        UNION ALL
        SELECT n + 1
        FROM nums
        WHERE
            n < 20
    )
INSERT INTO
    "user" (
        userName,
        email,
        password,
        role,
        schoolId,
        classId,
        createdAt
    )
SELECT
    'Student ' || c.name || '-' || n,
    'student.' || c.id || '.' || n || '@school.edu',
    '$2b$10$03YBu6wvZzm5f/BBF75MteaP1n6gvqGTTIXN/TXAurbuZKjzMyC9O',
    'student',
    c.schoolId,
    c.id,
    strftime ('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM "classRoom" c
    CROSS JOIN nums;

-- 7. Grade Generation (Auto-Grading)
INSERT INTO
    "studentGrades" (
        studentId,
        subjectId,
        classId,
        score
    )
SELECT u.id, s.id, u.classId, ABS(RANDOM () % 51) + 50
FROM "user" u
    JOIN "subject" s ON u.classId = s.classId
WHERE
    u.role = 'student';

PRAGMA foreign_keys = ON;