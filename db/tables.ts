import { column, defineTable, NOW } from "astro:db";

/**
 * An exam definition.
 * Example: "NEET Mock Test 01", "JEE Physics Full Test", "SAT Practice Exam A".
 */
export const Exams = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    ownerId: column.text(), // parent Users.id

    title: column.text(),
    description: column.text({ optional: true }),

    // Optional subject or category metadata
    subject: column.text({ optional: true }),
    tags: column.text({ optional: true }),

    totalMarks: column.number({ optional: true }),
    timeLimitSeconds: column.number({ optional: true }), // full exam time

    visibility: column.text({
      enum: ["private", "unlisted", "public"],
      default: "private",
    }),

    status: column.text({
      enum: ["draft", "published", "archived"],
      default: "draft",
    }),

    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

/**
 * Exams can be split across sections.
 * Example: Physics – 20 Questions, Chemistry – 25 Questions.
 */
export const ExamSections = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    examId: column.number({
      references: () => Exams.columns.id,
    }),

    title: column.text(), // "Physics", "Math Section A"
    instructions: column.text({ optional: true }),

    order: column.number({ default: 1 }),

    // Optional marks & time per section
    sectionMarks: column.number({ optional: true }),
    sectionTimeSeconds: column.number({ optional: true }),
  },
});

/**
 * Exam questions inside a section.
 */
export const ExamQuestions = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    examId: column.number({ references: () => Exams.columns.id }),
    sectionId: column.number({
      references: () => ExamSections.columns.id,
      optional: true,
    }),

    question: column.text(),

    // MCQ options, numerical answer, etc.
    type: column.text({
      enum: ["single_choice", "multiple_choice", "true_false", "numeric", "text"],
      default: "single_choice",
    }),

    options: column.json({ optional: true }),
    correctAnswer: column.json({ optional: true }),

    explanation: column.text({ optional: true }),

    marks: column.number({ default: 1 }),
    negativeMarks: column.number({ default: 0 }),

    order: column.number({ default: 1 }),
  },
});

/**
 * An attempt by a user.
 */
export const ExamAttempts = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    examId: column.number({ references: () => Exams.columns.id }),
    userId: column.text(),

    startedAt: column.date({ default: NOW }),
    submittedAt: column.date({ optional: true }),

    totalScore: column.number({ default: 0 }),
    maxScore: column.number({ default: 0 }),

    // Additional analytics stored as JSON
    summary: column.json({ optional: true }),
  },
});

/**
 * Each response inside an attempt.
 */
export const ExamResponses = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),

    attemptId: column.number({ references: () => ExamAttempts.columns.id }),
    questionId: column.number({ references: () => ExamQuestions.columns.id }),

    answer: column.json({ optional: true }),

    isCorrect: column.boolean({ default: false }),
    marksAwarded: column.number({ default: 0 }),

    answeredAt: column.date({ default: NOW }),
  },
});

export const examTables = {
  Exams,
  ExamSections,
  ExamQuestions,
  ExamAttempts,
  ExamResponses,
} as const;
