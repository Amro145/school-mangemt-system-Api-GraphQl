-- تنظيف البيانات القديمة
PRAGMA foreign_keys = OFF;
DELETE FROM studentGrades;
DELETE FROM enrollments;
DELETE FROM classSubjects;
DELETE FROM subject;
DELETE FROM classRoom;
DELETE FROM school;
DELETE FROM user;
PRAGMA foreign_keys = ON;

-- 1. إضافة المستخدمين (الكلمة هي 123456 لجميع الحسابات)
-- المسؤولين (Admins)
INSERT INTO user (id, userName, email, password, role) VALUES 
(1, 'Amro Admin', 'amro@gmail.com', '$2a$10$pxHhS2O79.uN3h/RjX5EueqD.yP3.jW8G6x6Hj5F2H2X2X2X2X2X2', 'admin'),
(2, 'Sara Admin', 'sara@gmail.com', '$2a$10$pxHhS2O79.uN3h/RjX5EueqD.yP3.jW8G6x6Hj5F2H2X2X2X2X2X2', 'admin');

-- المعلمون (Teachers)
INSERT INTO user (id, userName, email, password, role) VALUES 
(3, 'Mr. Ahmed', 'ahmed@teacher.com', '$2a$10$pxHhS2O79.uN3h/RjX5EueqD.yP3.jW8G6x6Hj5F2H2X2X2X2X2X2', 'teacher'),
(4, 'Ms. Laila', 'laila@teacher.com', '$2a$10$pxHhS2O79.uN3h/RjX5EueqD.yP3.jW8G6x6Hj5F2H2X2X2X2X2X2', 'teacher');

-- الطلاب (Students)
INSERT INTO user (id, userName, email, password, role) VALUES 
(5, 'Omar Khalid', 'omar@student.com', '$2a$10$pxHhS2O79.uN3h/RjX5EueqD.yP3.jW8G6x6Hj5F2H2X2X2X2X2X2', 'student'),
(6, 'Zaid Ali', 'zaid@student.com', '$2a$10$pxHhS2O79.uN3h/RjX5EueqD.yP3.jW8G6x6Hj5F2H2X2X2X2X2X2', 'student');

-- 2. إضافة المدارس
INSERT INTO school (id, name, adminId) VALUES 
(1, 'Amro Academy', 1),
(2, 'Elite School', 2);

-- 3. إضافة الفصول الدراسية
INSERT INTO classRoom (id, name, schoolId) VALUES 
(1, 'Grade 10-A', 1),
(2, 'Grade 11-B', 1),
(3, 'Pre-Med', 2);

-- 4. إضافة المواد
INSERT INTO subject (id, name) VALUES 
(1, 'Mathematics'),
(2, 'Physics'),
(3, 'Chemistry');

-- 5. ربط المواد بالمعلمين في الفصول
INSERT INTO classSubjects (classRoomId, subjectId, teacherId) VALUES 
(1, 1, 3), -- الرياضيات في فصل 10A يدرسها أحمد
(1, 2, 4); -- الفيزياء في فصل 10A تدرسها ليلى

-- 6. تسجيل الطلاب في الفصول
INSERT INTO enrollments (studentId, classRoomId) VALUES 
(5, 1),
(6, 1);

-- 7. إضافة درجات تجريبية
INSERT INTO studentGrades (id, studentId, classRoomId, subjectId, score, type) VALUES 
(1, 5, 1, 1, 95, 'final'),
(2, 6, 1, 1, 88, 'midterm');