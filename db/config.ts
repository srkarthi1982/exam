import { defineDb } from "astro:db";
import {
  Exams,
  ExamSections,
  ExamQuestions,
  ExamAttempts,
  ExamResponses,
} from "./tables";

export default defineDb({
  tables: {
    Exams,
    ExamSections,
    ExamQuestions,
    ExamAttempts,
    ExamResponses,
  },
});
