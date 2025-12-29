export const typeDefs = /* GraphQL */ `
  type User {
    id: Int!
    userName: String!
    email: String!
    role: String!
    schoolId: Int
    classId: Int
    createdAt: String!
    class: ClassRoom
    subjectsTaught: [Subject]
    grades: [StudentGrade]
    averageScore: Float
    successRate: Float
    schedules: [Schedule]
  }

  type StudentGrade {
    id: Int!
    studentId: Int!
    subjectId: Int!
    score: Int!
    type: String!
    subject: Subject
    student: User
  }

  type AuthPayload {
    user: User!
    token: String!
  }

  type School {
    id: Int!
    name: String!
    admin: User
    classRooms: [ClassRoom]
  }

  type Subject {
    id: Int!
    name: String!
    classId: Int
    teacher: User
    class: ClassRoom
    grades: [StudentGrade]
    successRate: Float
  }

  type ClassRoom {
    id: Int!
    name: String!
    schoolId: Int
    subjects: [Subject]
    students: [User]
    schedules: [Schedule]
  }

  type AdminStats {
    totalStudents: Int
    totalTeachers: Int
    totalClassRooms: Int
  }

  type Schedule {
    id: Int!
    classId: Int!
    subjectId: Int!
    subject: Subject
    classRoom: ClassRoom
    day: String!
    startTime: String!
    endTime: String!
  }
  input GradeUpdateInput {
    id: ID!
    score: Int!
  }

  type Exam {
    id: Int!
    title: String!
    type: String!
    description: String
    durationInMinutes: Int!
    subjectId: Int!
    classId: Int!
    teacherId: Int!
    createdAt: String!
    subject: Subject
    class: ClassRoom
    teacher: User
    questions: [Question]
    submissions: [ExamSubmission]
    hasSubmitted: Boolean
  }

  type Question {
    id: Int!
    examId: Int!
    questionText: String!
    options: [String]!
    correctAnswerIndex: Int # Nullable for students
    points: Int!
  }

  type ExamSubmission {
    id: Int!
    studentId: Int!
    examId: Int!
    totalScore: Int!
    answers: String!
    submittedAt: String!
    student: User
    exam: Exam
  }

  input QuestionInput {
    questionText: String!
    options: [String]!
    correctAnswerIndex: Int!
    points: Int!
  }

  input StudentAnswerInput {
    questionId: Int!
    selectedIndex: Int!
  }


  type Query {
    me: User
    mySchool: School
    myTeachers: [User]
    teacher(id: Int!): User
    myStudents(limit: Int, offset: Int, search: String): [User]
    totalStudentsCount: Int
    student(id: Int!): User
    classRooms: [ClassRoom]
    classRoom(id: Int!): ClassRoom
    subjects: [Subject]
    subject(id: Int!): Subject
    schedules: [Schedule]
    adminDashboardStats: AdminStats
    studentGrades(studentId: Int!): [StudentGrade]
    getSchoolFullDetails(schoolId: Int!): School
    topStudents: [User]
    getAvailableExams: [Exam]
    getExam(id: Int!): Exam
    getExamForTaking(id: Int!): Exam
    getTeacherExamReports(examId: Int!): [ExamSubmission]
  }

  type Mutation {
    signup(email: String!, password: String!, userName: String!): User!
    login(email: String!, password: String!): AuthPayload!
    createUser(userName: String!, email: String!, role: String!, password: String!, classId: Int): User
    createSchool(name: String!): School
    createClassRoom(name: String!, schoolId: Int): ClassRoom
    createSubject(name: String!, classId: Int!, teacherId: Int!): Subject
    addGrade(studentId: Int!, subjectId: Int!, score: Int!): StudentGrade
    deleteUser(id: Int!): User
    deleteClassRoom(id: Int!): ClassRoom
    deleteSubject(id: Int!): Subject
    updateBulkGrades(grades: [GradeUpdateInput!]!): [StudentGrade!]!
    createAdmin(email: String!, password: String!, userName: String!): User!
    createSchedule(classId: Int!, subjectId: Int!, day: String!, startTime: String!, endTime: String!): Schedule
    updateSchedule(id: Int!, classId: Int!, subjectId: Int!, day: String!, startTime: String!, endTime: String!): Schedule
    deleteSchedule(id: Int!): Schedule
    createExamWithQuestions(
      title: String!, 
      type: String!,
      description: String, 
      durationInMinutes: Int!, 
      subjectId: Int!, 
      classId: Int!, 
      questions: [QuestionInput!]!
    ): Exam
    submitExamResponse(examId: Int!, answers: [StudentAnswerInput!]!): ExamSubmission
  }
`;
