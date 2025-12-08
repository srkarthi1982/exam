import { defineAction, ActionError, type ActionAPIContext } from "astro:actions";
import { z } from "astro:schema";
import {
  ExamAttempts,
  ExamQuestions,
  ExamResponses,
  ExamSections,
  Exams,
  and,
  db,
  eq,
} from "astro:db";

function requireUser(context: ActionAPIContext) {
  const locals = context.locals as App.Locals | undefined;
  const user = locals?.user;

  if (!user) {
    throw new ActionError({
      code: "UNAUTHORIZED",
      message: "You must be signed in to perform this action.",
    });
  }

  return user;
}

async function getOwnedExam(examId: number, userId: string) {
  const [exam] = await db.select().from(Exams).where(eq(Exams.id, examId));

  if (!exam) {
    throw new ActionError({
      code: "NOT_FOUND",
      message: "Exam not found.",
    });
  }

  if (exam.ownerId !== userId) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "You do not have access to this exam.",
    });
  }

  return exam;
}

function ensureExamAccess(exam: (typeof Exams)["$inferSelect"], userId: string) {
  if (exam.visibility === "private" && exam.ownerId !== userId) {
    throw new ActionError({
      code: "FORBIDDEN",
      message: "This exam is private.",
    });
  }

  if (exam.status === "archived") {
    throw new ActionError({
      code: "BAD_REQUEST",
      message: "This exam is archived.",
    });
  }
}

const questionInputSchema = z.object({
  id: z.number().int().optional(),
  examId: z.number().int(),
  sectionId: z.number().int().optional(),
  question: z.string().min(1),
  type: z
    .enum(["single_choice", "multiple_choice", "true_false", "numeric", "text"])
    .default("single_choice"),
  options: z.array(z.any()).optional(),
  correctAnswer: z.any().optional(),
  explanation: z.string().optional(),
  marks: z.number().optional(),
  negativeMarks: z.number().optional(),
  order: z.number().int().optional(),
});

export const server = {
  createExam: defineAction({
    input: z.object({
      title: z.string().min(1),
      description: z.string().optional(),
      subject: z.string().optional(),
      tags: z.string().optional(),
      totalMarks: z.number().optional(),
      timeLimitSeconds: z.number().optional(),
      visibility: z.enum(["private", "unlisted", "public"]).optional(),
      status: z.enum(["draft", "published", "archived"]).optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      const now = new Date();

      const [exam] = await db
        .insert(Exams)
        .values({
          ownerId: user.id,
          title: input.title,
          description: input.description,
          subject: input.subject,
          tags: input.tags,
          totalMarks: input.totalMarks,
          timeLimitSeconds: input.timeLimitSeconds,
          visibility: input.visibility ?? "private",
          status: input.status ?? "draft",
          createdAt: now,
          updatedAt: now,
        })
        .returning();

      return {
        success: true,
        data: { exam },
      };
    },
  }),

  updateExam: defineAction({
    input: z
      .object({
        id: z.number().int(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        subject: z.string().optional(),
        tags: z.string().optional(),
        totalMarks: z.number().optional(),
        timeLimitSeconds: z.number().optional(),
        visibility: z.enum(["private", "unlisted", "public"]).optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.description !== undefined ||
          input.subject !== undefined ||
          input.tags !== undefined ||
          input.totalMarks !== undefined ||
          input.timeLimitSeconds !== undefined ||
          input.visibility !== undefined ||
          input.status !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedExam(input.id, user.id);

      const [exam] = await db
        .update(Exams)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined
            ? { description: input.description }
            : {}),
          ...(input.subject !== undefined ? { subject: input.subject } : {}),
          ...(input.tags !== undefined ? { tags: input.tags } : {}),
          ...(input.totalMarks !== undefined ? { totalMarks: input.totalMarks } : {}),
          ...(input.timeLimitSeconds !== undefined
            ? { timeLimitSeconds: input.timeLimitSeconds }
            : {}),
          ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(Exams.id, input.id))
        .returning();

      return {
        success: true,
        data: { exam },
      };
    },
  }),

  archiveExam: defineAction({
    input: z.object({ id: z.number().int() }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedExam(input.id, user.id);

      await db
        .update(Exams)
        .set({ status: "archived", updatedAt: new Date() })
        .where(eq(Exams.id, input.id));

      return { success: true };
    },
  }),

  createExamSection: defineAction({
    input: z.object({
      examId: z.number().int(),
      title: z.string().min(1),
      instructions: z.string().optional(),
      order: z.number().int().optional(),
      sectionMarks: z.number().optional(),
      sectionTimeSeconds: z.number().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedExam(input.examId, user.id);

      const [section] = await db
        .insert(ExamSections)
        .values({
          examId: input.examId,
          title: input.title,
          instructions: input.instructions,
          order: input.order ?? 1,
          sectionMarks: input.sectionMarks,
          sectionTimeSeconds: input.sectionTimeSeconds,
        })
        .returning();

      return {
        success: true,
        data: { section },
      };
    },
  }),

  updateExamSection: defineAction({
    input: z
      .object({
        id: z.number().int(),
        examId: z.number().int(),
        title: z.string().min(1).optional(),
        instructions: z.string().optional(),
        order: z.number().int().optional(),
        sectionMarks: z.number().optional(),
        sectionTimeSeconds: z.number().optional(),
      })
      .refine(
        (input) =>
          input.title !== undefined ||
          input.instructions !== undefined ||
          input.order !== undefined ||
          input.sectionMarks !== undefined ||
          input.sectionTimeSeconds !== undefined,
        { message: "At least one field must be provided to update." }
      ),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedExam(input.examId, user.id);

      const [existing] = await db
        .select()
        .from(ExamSections)
        .where(and(eq(ExamSections.id, input.id), eq(ExamSections.examId, input.examId)));

      if (!existing) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Section not found.",
        });
      }

      const [section] = await db
        .update(ExamSections)
        .set({
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.instructions !== undefined ? { instructions: input.instructions } : {}),
          ...(input.order !== undefined ? { order: input.order } : {}),
          ...(input.sectionMarks !== undefined ? { sectionMarks: input.sectionMarks } : {}),
          ...(input.sectionTimeSeconds !== undefined
            ? { sectionTimeSeconds: input.sectionTimeSeconds }
            : {}),
        })
        .where(eq(ExamSections.id, input.id))
        .returning();

      return {
        success: true,
        data: { section },
      };
    },
  }),

  deleteExamSection: defineAction({
    input: z.object({
      id: z.number().int(),
      examId: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedExam(input.examId, user.id);

      await db
        .delete(ExamQuestions)
        .where(eq(ExamQuestions.sectionId, input.id));

      const result = await db
        .delete(ExamSections)
        .where(and(eq(ExamSections.id, input.id), eq(ExamSections.examId, input.examId)));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Section not found.",
        });
      }

      return { success: true };
    },
  }),

  upsertExamQuestion: defineAction({
    input: questionInputSchema,
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedExam(input.examId, user.id);

      if (input.sectionId !== undefined) {
        const [section] = await db
          .select()
          .from(ExamSections)
          .where(
            and(
              eq(ExamSections.id, input.sectionId),
              eq(ExamSections.examId, input.examId)
            )
          );

        if (!section) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Section not found for this exam.",
          });
        }
      }

      if (input.id) {
        const [question] = await db
          .select()
          .from(ExamQuestions)
          .where(and(eq(ExamQuestions.id, input.id), eq(ExamQuestions.examId, input.examId)));

        if (!question) {
          throw new ActionError({
            code: "NOT_FOUND",
            message: "Question not found.",
          });
        }

        const [updated] = await db
          .update(ExamQuestions)
          .set({
            examId: input.examId,
            sectionId: input.sectionId ?? question.sectionId,
            question: input.question,
            type: input.type,
            options: input.options,
            correctAnswer: input.correctAnswer,
            explanation: input.explanation,
            marks: input.marks ?? question.marks,
            negativeMarks: input.negativeMarks ?? question.negativeMarks,
            order: input.order ?? question.order,
          })
          .where(eq(ExamQuestions.id, input.id))
          .returning();

        return {
          success: true,
          data: { question: updated },
        };
      }

      const [question] = await db
        .insert(ExamQuestions)
        .values({
          examId: input.examId,
          sectionId: input.sectionId,
          question: input.question,
          type: input.type,
          options: input.options,
          correctAnswer: input.correctAnswer,
          explanation: input.explanation,
          marks: input.marks ?? 1,
          negativeMarks: input.negativeMarks ?? 0,
          order: input.order ?? 1,
        })
        .returning();

      return {
        success: true,
        data: { question },
      };
    },
  }),

  deleteExamQuestion: defineAction({
    input: z.object({
      id: z.number().int(),
      examId: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);
      await getOwnedExam(input.examId, user.id);

      const result = await db
        .delete(ExamQuestions)
        .where(and(eq(ExamQuestions.id, input.id), eq(ExamQuestions.examId, input.examId)));

      if (result.rowsAffected === 0) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Question not found.",
        });
      }

      return { success: true };
    },
  }),

  startExamAttempt: defineAction({
    input: z.object({
      examId: z.number().int(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [exam] = await db.select().from(Exams).where(eq(Exams.id, input.examId));
      if (!exam) {
        throw new ActionError({ code: "NOT_FOUND", message: "Exam not found." });
      }

      ensureExamAccess(exam, user.id);

      const startedAt = new Date();

      const [attempt] = await db
        .insert(ExamAttempts)
        .values({
          examId: input.examId,
          userId: user.id,
          startedAt,
          totalScore: 0,
          maxScore: exam.totalMarks ?? 0,
          summary: null,
        })
        .returning();

      return {
        success: true,
        data: { attempt },
      };
    },
  }),

  submitExamAttempt: defineAction({
    input: z.object({
      attemptId: z.number().int(),
      responses: z
        .array(
          z.object({
            questionId: z.number().int(),
            answer: z.any().optional(),
            isCorrect: z.boolean().optional(),
            marksAwarded: z.number().optional(),
          })
        )
        .optional(),
      summary: z.record(z.any()).optional(),
      submittedAt: z.date().optional(),
      maxScore: z.number().optional(),
    }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [attempt] = await db
        .select()
        .from(ExamAttempts)
        .where(and(eq(ExamAttempts.id, input.attemptId), eq(ExamAttempts.userId, user.id)));

      if (!attempt) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Attempt not found.",
        });
      }

      const [exam] = await db.select().from(Exams).where(eq(Exams.id, attempt.examId));
      if (!exam) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Exam not found.",
        });
      }

      ensureExamAccess(exam, user.id);

      const questionRows = await db
        .select({
          id: ExamQuestions.id,
          marks: ExamQuestions.marks,
        })
        .from(ExamQuestions)
        .where(eq(ExamQuestions.examId, attempt.examId));

      const questionMap = new Map<number, number>();
      for (const question of questionRows) {
        questionMap.set(question.id, question.marks ?? 0);
      }

      await db
        .delete(ExamResponses)
        .where(eq(ExamResponses.attemptId, input.attemptId));

      let totalScore = 0;
      const responses = input.responses ?? [];
      for (const response of responses) {
        if (!questionMap.has(response.questionId)) {
          throw new ActionError({
            code: "BAD_REQUEST",
            message: "Response references a question outside this exam.",
          });
        }

        const marksAwarded =
          response.marksAwarded ?? questionMap.get(response.questionId) ?? 0;
        totalScore += marksAwarded;

        await db.insert(ExamResponses).values({
          attemptId: input.attemptId,
          questionId: response.questionId,
          answer: response.answer,
          isCorrect: response.isCorrect ?? false,
          marksAwarded,
          answeredAt: new Date(),
        });
      }

      const submittedAt = input.submittedAt ?? new Date();
      const maxScore =
        input.maxScore ?? attempt.maxScore ?? exam.totalMarks ?? totalScore;

      const [updatedAttempt] = await db
        .update(ExamAttempts)
        .set({
          submittedAt,
          totalScore,
          maxScore,
          summary: input.summary ?? attempt.summary,
        })
        .where(eq(ExamAttempts.id, input.attemptId))
        .returning();

      return {
        success: true,
        data: { attempt: updatedAttempt },
      };
    },
  }),

  listMyExamAttempts: defineAction({
    input: z
      .object({
        examId: z.number().int().optional(),
      })
      .optional(),
    handler: async (input, context) => {
      const user = requireUser(context);
      const filters = [eq(ExamAttempts.userId, user.id)];

      if (input?.examId !== undefined) {
        filters.push(eq(ExamAttempts.examId, input.examId));
      }

      const attempts = await db
        .select()
        .from(ExamAttempts)
        .where(and(...filters));

      return {
        success: true,
        data: { items: attempts, total: attempts.length },
      };
    },
  }),

  getExamWithSections: defineAction({
    input: z.object({ id: z.number().int() }),
    handler: async (input, context) => {
      const user = requireUser(context);

      const [exam] = await db.select().from(Exams).where(eq(Exams.id, input.id));
      if (!exam) {
        throw new ActionError({
          code: "NOT_FOUND",
          message: "Exam not found.",
        });
      }

      ensureExamAccess(exam, user.id);

      const sections = await db
        .select()
        .from(ExamSections)
        .where(eq(ExamSections.examId, input.id));

      const questions = await db
        .select()
        .from(ExamQuestions)
        .where(eq(ExamQuestions.examId, input.id));

      return {
        success: true,
        data: {
          exam,
          sections,
          questions,
        },
      };
    },
  }),
};
