-- إيقاف التحقق من القيود لتسهيل عملية التنظيف
PRAGMA foreign_keys = OFF;

-- تنظيف الجداول الحالية فقط (التي عرفناها في schema.ts)
DELETE FROM studentGrades;
DELETE FROM subject;
DELETE FROM classRoom;
DELETE FROM school;
DELETE FROM user;

-- إعادة تصفير الـ Auto Increment (اختياري لتبدأ الـ IDs من 1)
DELETE FROM sqlite_sequence WHERE name IN ('user', 'school', 'classRoom', 'subject', 'studentGrades');

PRAGMA foreign_keys = ON;

-- 1. إضافة المدير (Admin)
INSERT INTO user (userName, email, password, role) 
VALUES ('Amro Admin', 'admin@school.com', '$2a$10$Ph9p5S5z5p5S5z5p5S5z5u.eGzD.kZzD.kZzD.kZzD.kZzD.kZz', 'admin');

-- 2. إضافة المدرسة (مرتبطة بالمدير رقم 1)
INSERT INTO school (name, adminId) 
VALUES ('Amro Excellence School', 1);

-- 3. تحديث مدرسة المدير ليتبعها
UPDATE user SET schoolId = 1 WHERE id = 1;

-- 4. إضافة معلم (Teacher)
INSERT INTO user (userName, email, password, role, schoolId) 
VALUES ('Mr. Ahmed', 'ahmed@school.com', '$2a$10$Ph9p5S5z5p5S5z5p5S5z5u.eGzD.kZzD.kZzD.kZzD.kZzD.kZz', 'teacher', 1);

-- 5. إضافة فصل (ClassRoom)
INSERT INTO classRoom (name, schoolId) 
VALUES ('Class 10A', 1);

-- 6. إضافة طالب (Student) مرتبط بالفصل مباشرة عبر classId
INSERT INTO user (userName, email, password, role, schoolId, classId) 
VALUES ('Sami Student', 'sami@school.com', '$2a$10$Ph9p5S5z5p5S5z5p5S5z5u.eGzD.kZzD.kZzD.kZzD.kZzD.kZz', 'student', 1, 1);

-- 7. إضافة مادة (Subject) مرتبطة بالفصل ومعلم مباشرة
INSERT INTO subject (name, classId, teacherId) 
VALUES ('Mathematics', 1, 2);

-- 8. إضافة درجة للطالب
INSERT INTO studentGrades (studentId, subjectId, classId, score) 
VALUES (3, 1, 1, 95);