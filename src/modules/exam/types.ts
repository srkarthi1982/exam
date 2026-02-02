export type ExamPaperDTO = {
  id: number;
  userId: string;
  title: string;
  sourceType: "quiz";
  sourceRef: string;
  questionCount: number;
  timeLimitMinutes: number;
  shuffleQuestions: boolean;
  createdAt?: string | Date | null;
  updatedAt?: string | Date | null;
};

export type ExamAttemptDTO = {
  id: number;
  userId: string;
  paperId: number;
  startedAt: string | Date;
  submittedAt?: string | Date | null;
  status: "in_progress" | "submitted" | "expired";
  timeLimitMinutes: number;
  score?: number | null;
  totalQuestions: number;
  correctCount?: number | null;
  wrongCount?: number | null;
  unattemptedCount?: number | null;
  percent?: number | null;
  createdAt?: string | Date | null;
};

export type ExamQuestionSnapshot = {
  questionIndex: number;
  question: any;
  selectedOption?: string | null;
  isCorrect?: boolean | null;
};

export type ExamPaperForm = {
  title: string;
  sourceRef: string;
  questionCount: string;
  timeLimitMinutes: string;
  difficulty: string;
  shuffleQuestions: boolean;
};
