import { ExamAttempts, ExamPapers, and, count, db, eq, gte, max } from "astro:db";

export type ExamDashboardSummaryV1 = {
  version: 1;
  generatedAt: string;
  totals: {
    papers: number;
    attempts: number;
    attemptsThisWeek: number;
  };
  performance: {
    avgPercentThisWeek: number;
    bestPercentThisWeek: number;
  };
  activity: {
    lastAttemptAt: string | null;
    lastActivityAt: string;
  };
};

const toIso = (value?: Date | string | null) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
};

const getStartOfDay = (date = new Date()) => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const buildExamDashboardSummary = async (userId: string): Promise<ExamDashboardSummaryV1> => {
  const generatedAt = new Date().toISOString();
  const weekStart = getStartOfDay(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));

  const [{ total: papersRaw } = { total: 0 }] = await db
    .select({ total: count() })
    .from(ExamPapers)
    .where(eq(ExamPapers.userId, userId));

  const [{ total: attemptsRaw } = { total: 0 }] = await db
    .select({ total: count() })
    .from(ExamAttempts)
    .where(eq(ExamAttempts.userId, userId));

  const [{ total: attemptsWeekRaw } = { total: 0 }] = await db
    .select({ total: count() })
    .from(ExamAttempts)
    .where(and(eq(ExamAttempts.userId, userId), gte(ExamAttempts.startedAt, weekStart)));

  const attemptsWeek = await db
    .select()
    .from(ExamAttempts)
    .where(and(eq(ExamAttempts.userId, userId), gte(ExamAttempts.startedAt, weekStart)));

  const percents = attemptsWeek
    .map((attempt) => Number(attempt.percent ?? 0))
    .filter((value) => Number.isFinite(value));

  const avgPercentThisWeek = percents.length
    ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length)
    : 0;

  const bestPercentThisWeek = percents.length ? Math.max(...percents) : 0;

  const lastAttempt = await db
    .select({ startedAt: max(ExamAttempts.startedAt) })
    .from(ExamAttempts)
    .where(eq(ExamAttempts.userId, userId));

  const lastAttemptAt = toIso(lastAttempt?.[0]?.startedAt ?? null);

  return {
    version: 1,
    generatedAt,
    totals: {
      papers: Number(papersRaw ?? 0),
      attempts: Number(attemptsRaw ?? 0),
      attemptsThisWeek: Number(attemptsWeekRaw ?? 0),
    },
    performance: {
      avgPercentThisWeek,
      bestPercentThisWeek,
    },
    activity: {
      lastAttemptAt,
      lastActivityAt: lastAttemptAt ?? generatedAt,
    },
  };
};
