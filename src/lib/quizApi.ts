import { ActionError } from "astro:actions";

export type QuizQuestion = {
  questionId?: string | number;
  questionText?: string;
  answerText?: string;
  explanation?: string | null;
  options?: string[];
  choices?: string[];
};

export type QuizQuestionsResponse = {
  items: QuizQuestion[];
};

const getBaseUrl = () => import.meta.env.QUIZ_API_BASE_URL ?? "https://quiz.ansiversa.com";

const toQueryString = (params: Record<string, string | number | boolean | undefined>) => {
  const entries = Object.entries(params).filter(([, value]) => typeof value !== "undefined");
  const search = new URLSearchParams();
  for (const [key, value] of entries) {
    search.set(key, String(value));
  }
  return search.toString();
};

const fetchJson = async <T>(path: string, token: string): Promise<T> => {
  const url = `${getBaseUrl().replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    throw new ActionError({ code: "BAD_REQUEST", message: "Quiz API unavailable." });
  }
  return (await response.json()) as T;
};

const parseSourceRef = (sourceRef: string) => {
  const [prefix, value] = sourceRef.includes(":") ? sourceRef.split(":", 2) : [null, sourceRef];
  if (!prefix) return { quizId: value };
  if (prefix === "quiz") return { quizId: value };
  if (prefix === "topic") return { topicId: value };
  if (prefix === "subject") return { subjectId: value };
  if (prefix === "platform") return { platformId: value };
  if (prefix === "roadmap") return { roadmapId: value };
  return { quizId: sourceRef };
};

export const getQuizQuestions = async (params: {
  token: string;
  sourceRef: string;
  limit: number;
  difficulty?: string | null;
  shuffle?: boolean;
}): Promise<QuizQuestionsResponse> => {
  const source = parseSourceRef(params.sourceRef);
  const query = toQueryString({
    ...source,
    limit: params.limit,
    difficulty: params.difficulty ?? undefined,
    shuffle: params.shuffle ?? true,
  });

  return await fetchJson<QuizQuestionsResponse>(`/api/flashnote/questions?${query}`, params.token);
};
