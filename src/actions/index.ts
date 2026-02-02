import {
  createExamPaper,
  deleteExamPaper,
  getAttempt,
  getAttemptReview,
  getExamPaper,
  listAttempts,
  listExamPapers,
  saveAnswer,
  startAttempt,
  submitAttempt,
} from "./exam";

export const exam = {
  createExamPaper,
  listExamPapers,
  getExamPaper,
  deleteExamPaper,
  startAttempt,
  saveAnswer,
  submitAttempt,
  getAttempt,
  listAttempts,
  getAttemptReview,
};

export const server = {
  exam,
};
