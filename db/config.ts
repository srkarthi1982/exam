import { defineDb } from "astro:db";
import { ExamAnswers, ExamAttempts, ExamPapers, ExamQuestionsSnapshot } from "./tables";

export default defineDb({
  tables: {
    ExamPapers,
    ExamQuestionsSnapshot,
    ExamAttempts,
    ExamAnswers,
  },
});
