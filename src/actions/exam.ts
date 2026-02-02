import { ActionError, defineAction } from "astro:actions";
import {
  ExamAnswers,
  ExamAttempts,
  ExamPapers,
  ExamQuestionsSnapshot,
  and,
  count,
  db,
  desc,
  eq,
  gte,
} from "astro:db";
import { z } from "astro:schema";
import { requirePro, requireUser } from "./_guards";
import { FREE_LIMITS } from "../lib/freeLimits";
import { buildExamDashboardSummary } from "../dashboard/summary.schema";
import { pushExamSummary } from "../lib/pushActivity";
import { notifyParent } from "../lib/notifyParent";
import { getQuizQuestions } from "../lib/quizApi";

const getStartOfDay = (date = new Date()) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const pushSummary = async (userId: string, eventType: string) => {
  const summary = await buildExamDashboardSummary(userId);
  await pushExamSummary({ userId, eventType, summary });
};

const enforcePaperLimit = async (context: Parameters<typeof requireUser>[0], userId: string) => {
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(ExamPapers)
    .where(eq(ExamPapers.userId, userId));

  if (Number(total ?? 0) >= FREE_LIMITS.maxPapers) {
    requirePro(context);
  }
};

const enforceDailyAttemptLimit = async (context: Parameters<typeof requireUser>[0], userId: string) => {
  const todayStart = getStartOfDay();
  const [{ total } = { total: 0 }] = await db
    .select({ total: count() })
    .from(ExamAttempts)
    .where(and(eq(ExamAttempts.userId, userId), gte(ExamAttempts.startedAt, todayStart)));

  if (Number(total ?? 0) >= FREE_LIMITS.maxAttemptsPerDay) {
    requirePro(context);
  }
};

const ensureSnapshot = async (userId: string, paperId: number, token: string) => {
  const existing = await db
    .select()
    .from(ExamQuestionsSnapshot)
    .where(and(eq(ExamQuestionsSnapshot.paperId, paperId), eq(ExamQuestionsSnapshot.userId, userId)));

  if (existing.length > 0) return existing;

  const paper = await db
    .select()
    .from(ExamPapers)
    .where(and(eq(ExamPapers.id, paperId), eq(ExamPapers.userId, userId)))
    .get();

  if (!paper) {
    throw new ActionError({ code: "NOT_FOUND", message: "Exam paper not found." });
  }

  const config = JSON.parse(paper.configJson) as {
    sourceRef: string;
    questionCount: number;
    difficulty?: string | null;
    shuffle: boolean;
  };

  const questions = await getQuizQuestions({
    token,
    sourceRef: config.sourceRef,
    limit: config.questionCount,
    difficulty: config.difficulty,
    shuffle: config.shuffle,
  });

  const items = questions.items ?? [];
  const sanitized = items.map((question, index) => ({
    userId,
    paperId,
    questionIndex: index,
    questionJson: JSON.stringify({
      question: question.questionText ?? "",
      options: question.options ?? question.choices ?? [],
      correctAnswer: question.answerText ?? null,
      explanation: question.explanation ?? null,
    }),
    createdAt: new Date(),
  }));

  if (sanitized.length === 0) {
    throw new ActionError({ code: "BAD_REQUEST", message: "Quiz API returned no questions." });
  }

  await db.insert(ExamQuestionsSnapshot).values(sanitized);

  return await db
    .select()
    .from(ExamQuestionsSnapshot)
    .where(and(eq(ExamQuestionsSnapshot.paperId, paperId), eq(ExamQuestionsSnapshot.userId, userId)));
};

const calculateScore = (params: {
  answers: { questionIndex: number; selectedOption?: string | null }[];
  snapshots: { questionIndex: number; questionJson: string }[];
}) => {
  let correct = 0;
  let wrong = 0;

  const answerMap = new Map<number, string | null>();
  for (const answer of params.answers) {
    answerMap.set(answer.questionIndex, answer.selectedOption ?? null);
  }

  for (const snapshot of params.snapshots) {
    const question = JSON.parse(snapshot.questionJson) as any;
    const correctAnswer = question?.correctAnswer ?? question?.answer ?? null;
    const selected = answerMap.get(snapshot.questionIndex) ?? null;
    if (!selected) continue;
    if (String(selected) === String(correctAnswer)) {
      correct += 1;
    } else {
      wrong += 1;
    }
  }

  const total = params.snapshots.length;
  const unattempted = Math.max(0, total - correct - wrong);
  const percent = total > 0 ? Math.round((correct / total) * 100) : 0;

  return { correct, wrong, unattempted, total, percent };
};

const paperSchema = z.object({
  title: z.string().min(1, "Title is required."),
  sourceRef: z.string().min(1, "Quiz source is required."),
  questionCount: z.number().int().min(5).max(100),
  timeLimitMinutes: z.number().int().min(5).max(180),
  difficulty: z.string().optional(),
  shuffleQuestions: z.boolean().optional(),
});

export const createExamPaper = defineAction({
  input: paperSchema,
  handler: async (input, context) => {
    const user = requireUser(context);
    await enforcePaperLimit(context, user.id);

    const config = {
      sourceRef: input.sourceRef,
      questionCount: input.questionCount,
      timeLimitMinutes: input.timeLimitMinutes,
      difficulty: input.difficulty ?? null,
      shuffle: input.shuffleQuestions ?? true,
    };

    const [paper] = await db
      .insert(ExamPapers)
      .values({
        userId: user.id,
        title: input.title,
        sourceType: "quiz",
        sourceRef: input.sourceRef,
        questionCount: input.questionCount,
        timeLimitMinutes: input.timeLimitMinutes,
        shuffleQuestions: input.shuffleQuestions ?? true,
        configJson: JSON.stringify(config),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (paper) {
      await pushSummary(user.id, "paper.created");
    }

    return { paper };
  },
});

export const listExamPapers = defineAction({
  handler: async (_, context) => {
    const user = requireUser(context);
    const papers = await db
      .select()
      .from(ExamPapers)
      .where(eq(ExamPapers.userId, user.id))
      .orderBy(desc(ExamPapers.updatedAt), desc(ExamPapers.createdAt), desc(ExamPapers.id));
    return { papers };
  },
});

export const getExamPaper = defineAction({
  input: z.object({ id: z.number().int() }),
  handler: async (input, context) => {
    const user = requireUser(context);
    const paper = await db
      .select()
      .from(ExamPapers)
      .where(and(eq(ExamPapers.id, input.id), eq(ExamPapers.userId, user.id)))
      .get();

    if (!paper) {
      throw new ActionError({ code: "NOT_FOUND", message: "Exam paper not found." });
    }

    return { paper };
  },
});

export const deleteExamPaper = defineAction({
  input: z.object({ id: z.number().int() }),
  handler: async (input, context) => {
    const user = requireUser(context);
    const [paper] = await db
      .delete(ExamPapers)
      .where(and(eq(ExamPapers.id, input.id), eq(ExamPapers.userId, user.id)))
      .returning();

    if (!paper) {
      throw new ActionError({ code: "NOT_FOUND", message: "Exam paper not found." });
    }

    await pushSummary(user.id, "paper.deleted");

    return { paper };
  },
});

export const startAttempt = defineAction({
  input: z.object({ paperId: z.number().int() }),
  handler: async (input, context) => {
    const user = requireUser(context);
    await enforceDailyAttemptLimit(context, user.id);

    const locals = context.locals as App.Locals | undefined;
    const token = locals?.sessionToken ?? null;
    if (!token) {
      throw new ActionError({ code: "UNAUTHORIZED", message: "Quiz fetch requires a session token." });
    }

    const paper = await db
      .select()
      .from(ExamPapers)
      .where(and(eq(ExamPapers.id, input.paperId), eq(ExamPapers.userId, user.id)))
      .get();

    if (!paper) {
      throw new ActionError({ code: "NOT_FOUND", message: "Exam paper not found." });
    }

    await ensureSnapshot(user.id, paper.id, token);

    const [attempt] = await db
      .insert(ExamAttempts)
      .values({
        userId: user.id,
        paperId: paper.id,
        startedAt: new Date(),
        status: "in_progress",
        timeLimitMinutes: paper.timeLimitMinutes,
        totalQuestions: paper.questionCount,
        createdAt: new Date(),
      })
      .returning();

    return { attempt };
  },
});

export const saveAnswer = defineAction({
  input: z.object({
    attemptId: z.number().int(),
    questionIndex: z.number().int(),
    selectedOption: z.string().optional(),
    isFlagged: z.boolean().optional(),
  }),
  handler: async (input, context) => {
    const user = requireUser(context);

    const attempt = await db
      .select()
      .from(ExamAttempts)
      .where(and(eq(ExamAttempts.id, input.attemptId), eq(ExamAttempts.userId, user.id)))
      .get();

    if (!attempt) {
      throw new ActionError({ code: "NOT_FOUND", message: "Attempt not found." });
    }

    const existing = await db
      .select()
      .from(ExamAnswers)
      .where(
        and(
          eq(ExamAnswers.attemptId, input.attemptId),
          eq(ExamAnswers.userId, user.id),
          eq(ExamAnswers.questionIndex, input.questionIndex),
        ),
      )
      .get();

    if (existing) {
      const [answer] = await db
        .update(ExamAnswers)
        .set({
          selectedOption: input.selectedOption ?? existing.selectedOption,
          isFlagged: input.isFlagged ?? existing.isFlagged,
          updatedAt: new Date(),
        })
        .where(eq(ExamAnswers.id, existing.id))
        .returning();

      return { answer };
    }

    const [answer] = await db
      .insert(ExamAnswers)
      .values({
        attemptId: input.attemptId,
        userId: user.id,
        questionIndex: input.questionIndex,
        selectedOption: input.selectedOption ?? null,
        isFlagged: input.isFlagged ?? false,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    return { answer };
  },
});

export const submitAttempt = defineAction({
  input: z.object({ attemptId: z.number().int(), expired: z.boolean().optional() }),
  handler: async (input, context) => {
    const user = requireUser(context);

    const attempt = await db
      .select()
      .from(ExamAttempts)
      .where(and(eq(ExamAttempts.id, input.attemptId), eq(ExamAttempts.userId, user.id)))
      .get();

    if (!attempt) {
      throw new ActionError({ code: "NOT_FOUND", message: "Attempt not found." });
    }

    const snapshots = await db
      .select()
      .from(ExamQuestionsSnapshot)
      .where(and(eq(ExamQuestionsSnapshot.paperId, attempt.paperId), eq(ExamQuestionsSnapshot.userId, user.id)));

    const answers = await db
      .select()
      .from(ExamAnswers)
      .where(and(eq(ExamAnswers.attemptId, attempt.id), eq(ExamAnswers.userId, user.id)));

    const score = calculateScore({
      answers: answers.map((answer) => ({
        questionIndex: answer.questionIndex,
        selectedOption: answer.selectedOption,
      })),
      snapshots: snapshots.map((snapshot) => ({
        questionIndex: snapshot.questionIndex,
        questionJson: snapshot.questionJson,
      })),
    });

    const status = input.expired ? "expired" : "submitted";

    const [updated] = await db
      .update(ExamAttempts)
      .set({
        submittedAt: new Date(),
        status,
        score: score.correct,
        correctCount: score.correct,
        wrongCount: score.wrong,
        unattemptedCount: score.unattempted,
        percent: score.percent,
      })
      .where(eq(ExamAttempts.id, attempt.id))
      .returning();

    const answerUpdates = answers.map((answer) => {
      const snapshot = snapshots.find((item) => item.questionIndex === answer.questionIndex);
      const question = snapshot ? (JSON.parse(snapshot.questionJson) as any) : null;
      const correctAnswer = question?.correctAnswer ?? null;
      const isCorrect =
        correctAnswer && answer.selectedOption
          ? String(answer.selectedOption) === String(correctAnswer)
          : null;
      return { id: answer.id, isCorrect };
    });

    for (const update of answerUpdates) {
      await db.update(ExamAnswers).set({ isCorrect: update.isCorrect }).where(eq(ExamAnswers.id, update.id));
    }

    if (updated) {
      await notifyParent({
        userId: user.id,
        eventType: "exam_submitted",
        title: status === "expired" ? "Exam time is up" : "Exam submitted",
        url: `/results/${updated.id}`,
      });
      await pushSummary(user.id, status === "expired" ? "exam.expired" : "exam.submitted");
    }

    return { attempt: updated };
  },
});

export const getAttempt = defineAction({
  input: z.object({ attemptId: z.number().int() }),
  handler: async (input, context) => {
    const user = requireUser(context);
    const attempt = await db
      .select()
      .from(ExamAttempts)
      .where(and(eq(ExamAttempts.id, input.attemptId), eq(ExamAttempts.userId, user.id)))
      .get();

    if (!attempt) {
      throw new ActionError({ code: "NOT_FOUND", message: "Attempt not found." });
    }

    const paper = await db
      .select()
      .from(ExamPapers)
      .where(and(eq(ExamPapers.id, attempt.paperId), eq(ExamPapers.userId, user.id)))
      .get();

    return { attempt, paper };
  },
});

export const listAttempts = defineAction({
  input: z
    .object({
      limit: z.number().int().min(1).max(200).optional(),
      start: z.coerce.date().optional(),
    })
    .optional(),
  handler: async (input, context) => {
    const user = requireUser(context);
    const limit = input?.limit ?? 20;

    const freeWindowStart = getStartOfDay(new Date(Date.now() - (FREE_LIMITS.historyDays - 1) * 86400000));

    const start = user.isPaid ? input?.start ?? null : freeWindowStart;

    const attempts = start
      ? await db
          .select()
          .from(ExamAttempts)
          .where(and(eq(ExamAttempts.userId, user.id), gte(ExamAttempts.startedAt, start)))
      : await db.select().from(ExamAttempts).where(eq(ExamAttempts.userId, user.id));

    const sorted = attempts.sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime(),
    );

    return {
      attempts: sorted.slice(0, limit),
      windowStart: start ? start.toISOString() : null,
    };
  },
});

export const getAttemptReview = defineAction({
  input: z.object({ attemptId: z.number().int(), includeExplanations: z.boolean().optional() }),
  handler: async (input, context) => {
    const user = requireUser(context);
    if (input.includeExplanations && !user.isPaid) {
      requirePro(context);
    }

    const attempt = await db
      .select()
      .from(ExamAttempts)
      .where(and(eq(ExamAttempts.id, input.attemptId), eq(ExamAttempts.userId, user.id)))
      .get();

    if (!attempt) {
      throw new ActionError({ code: "NOT_FOUND", message: "Attempt not found." });
    }

    const snapshots = await db
      .select()
      .from(ExamQuestionsSnapshot)
      .where(and(eq(ExamQuestionsSnapshot.paperId, attempt.paperId), eq(ExamQuestionsSnapshot.userId, user.id)))
      .orderBy(ExamQuestionsSnapshot.questionIndex);

    const answers = await db
      .select()
      .from(ExamAnswers)
      .where(and(eq(ExamAnswers.attemptId, attempt.id), eq(ExamAnswers.userId, user.id)));

    const answerMap = new Map<number, (typeof answers)[number]>();
    for (const answer of answers) {
      answerMap.set(answer.questionIndex, answer);
    }

    const items = snapshots.map((snapshot) => {
      const question = JSON.parse(snapshot.questionJson) as any;
      const answer = answerMap.get(snapshot.questionIndex);
      return {
        questionIndex: snapshot.questionIndex,
        question,
        selectedOption: answer?.selectedOption ?? null,
        isCorrect: answer?.isCorrect ?? null,
      };
    });

    return { attempt, review: items };
  },
});
