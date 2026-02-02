import { column, defineTable, NOW } from "astro:db";

export const ExamPapers = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    userId: column.text(),
    title: column.text(),
    sourceType: column.text({ enum: ["quiz"], default: "quiz" }),
    sourceRef: column.text(),
    questionCount: column.number(),
    timeLimitMinutes: column.number(),
    shuffleQuestions: column.boolean({ default: true }),
    configJson: column.text(),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const ExamQuestionsSnapshot = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    paperId: column.number({ references: () => ExamPapers.columns.id }),
    userId: column.text(),
    questionIndex: column.number(),
    questionJson: column.text(),
    createdAt: column.date({ default: NOW }),
  },
});

export const ExamAttempts = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    userId: column.text(),
    paperId: column.number({ references: () => ExamPapers.columns.id }),
    startedAt: column.date({ default: NOW }),
    submittedAt: column.date({ optional: true }),
    status: column.text({ enum: ["in_progress", "submitted", "expired"], default: "in_progress" }),
    timeLimitMinutes: column.number(),
    score: column.number({ optional: true }),
    totalQuestions: column.number({ default: 0 }),
    correctCount: column.number({ optional: true }),
    wrongCount: column.number({ optional: true }),
    unattemptedCount: column.number({ optional: true }),
    percent: column.number({ optional: true }),
    createdAt: column.date({ default: NOW }),
  },
});

export const ExamAnswers = defineTable({
  columns: {
    id: column.number({ primaryKey: true, autoIncrement: true }),
    attemptId: column.number({ references: () => ExamAttempts.columns.id }),
    userId: column.text(),
    questionIndex: column.number(),
    selectedOption: column.text({ optional: true }),
    isFlagged: column.boolean({ default: false }),
    isCorrect: column.boolean({ optional: true }),
    createdAt: column.date({ default: NOW }),
    updatedAt: column.date({ default: NOW }),
  },
});

export const examTables = {
  ExamPapers,
  ExamQuestionsSnapshot,
  ExamAttempts,
  ExamAnswers,
} as const;
