import type { Alpine } from "alpinejs";
import { AvBaseStore } from "@ansiversa/components/alpine";
import { actions } from "astro:actions";
import type { ExamAttemptDTO, ExamPaperDTO, ExamPaperForm, ExamQuestionSnapshot } from "./types";

const defaultPaperForm = (): ExamPaperForm => ({
  title: "",
  sourceRef: "",
  questionCount: "20",
  timeLimitMinutes: "30",
  difficulty: "",
  shuffleQuestions: true,
});

const defaultState = () => ({
  papers: [] as ExamPaperDTO[],
  attempts: [] as ExamAttemptDTO[],
  currentPaper: null as ExamPaperDTO | null,
  currentAttempt: null as ExamAttemptDTO | null,
  currentQuestions: [] as ExamQuestionSnapshot[],
  currentIndex: 0,
  timerStatus: "idle" as "idle" | "running" | "paused" | "expired" | "submitted",
  remainingSeconds: 0,
  timerId: null as number | null,
  answers: new Map<number, string | null>(),
  flags: new Set<number>(),
  loading: false,
  error: null as string | null,
  success: null as string | null,
  isPaid: false,
  historyWindowStart: null as string | null,
  paperForm: defaultPaperForm(),
});

export class ExamStore extends AvBaseStore implements ReturnType<typeof defaultState> {
  papers: ExamPaperDTO[] = [];
  attempts: ExamAttemptDTO[] = [];
  currentPaper: ExamPaperDTO | null = null;
  currentAttempt: ExamAttemptDTO | null = null;
  currentQuestions: ExamQuestionSnapshot[] = [];
  currentIndex = 0;
  timerStatus: "idle" | "running" | "paused" | "expired" | "submitted" = "idle";
  remainingSeconds = 0;
  timerId: number | null = null;
  answers = new Map<number, string | null>();
  flags = new Set<number>();
  loading = false;
  error: string | null = null;
  success: string | null = null;
  isPaid = false;
  historyWindowStart: string | null = null;
  paperForm: ExamPaperForm = defaultPaperForm();

  init(initial?: Partial<ReturnType<typeof defaultState>>) {
    if (!initial) return;
    Object.assign(this, defaultState(), initial);
    this.papers = (initial.papers ?? []) as ExamPaperDTO[];
    this.attempts = (initial.attempts ?? []) as ExamAttemptDTO[];
    this.currentPaper = (initial.currentPaper ?? null) as ExamPaperDTO | null;
  }

  private unwrap<T = any>(result: any): T {
    if (result?.error) {
      const message = result.error?.message || result.error;
      throw new Error(message || "Request failed.");
    }
    return (result?.data ?? result) as T;
  }

  setBillingStatus(isPaid: boolean) {
    this.isPaid = Boolean(isPaid);
  }

  async loadPapers() {
    this.loading = true;
    this.error = null;
    try {
      const res = await actions.exam.listExamPapers();
      const data = this.unwrap<{ papers: ExamPaperDTO[] }>(res);
      this.papers = data.papers ?? [];
    } catch (err: any) {
      this.error = err?.message || "Unable to load papers.";
    } finally {
      this.loading = false;
    }
  }

  async createPaper() {
    if (!this.paperForm.title.trim()) {
      this.error = "Title is required.";
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    try {
      const res = await actions.exam.createExamPaper({
        title: this.paperForm.title,
        sourceRef: this.paperForm.sourceRef,
        questionCount: Number.parseInt(this.paperForm.questionCount, 10) || 20,
        timeLimitMinutes: Number.parseInt(this.paperForm.timeLimitMinutes, 10) || 30,
        difficulty: this.paperForm.difficulty || undefined,
        shuffleQuestions: this.paperForm.shuffleQuestions,
      });
      const data = this.unwrap<{ paper: ExamPaperDTO }>(res);
      if (data?.paper) {
        this.papers = [data.paper, ...this.papers];
        this.paperForm = defaultPaperForm();
        this.success = "Exam paper created.";
      }
    } catch (err: any) {
      this.error = err?.message || "Unable to create paper.";
    } finally {
      this.loading = false;
    }
  }

  async deletePaper(paper: ExamPaperDTO) {
    this.loading = true;
    this.error = null;
    try {
      await actions.exam.deleteExamPaper({ id: paper.id });
      this.papers = this.papers.filter((item) => item.id !== paper.id);
      this.success = "Exam paper deleted.";
    } catch (err: any) {
      this.error = err?.message || "Unable to delete paper.";
    } finally {
      this.loading = false;
    }
  }

  async loadPaper(id: number) {
    this.loading = true;
    this.error = null;
    try {
      const res = await actions.exam.getExamPaper({ id });
      const data = this.unwrap<{ paper: ExamPaperDTO }>(res);
      this.currentPaper = data.paper ?? null;
    } catch (err: any) {
      this.error = err?.message || "Unable to load paper.";
    } finally {
      this.loading = false;
    }
  }

  async loadAttempts() {
    this.loading = true;
    this.error = null;
    try {
      const res = await actions.exam.listAttempts({});
      const data = this.unwrap<{ attempts: ExamAttemptDTO[]; windowStart: string | null }>(res);
      this.attempts = data.attempts ?? [];
      this.historyWindowStart = data.windowStart;
    } catch (err: any) {
      this.error = err?.message || "Unable to load attempts.";
    } finally {
      this.loading = false;
    }
  }

  async startAttempt(paperId: number) {
    this.loading = true;
    this.error = null;
    try {
      const res = await actions.exam.startAttempt({ paperId });
      const data = this.unwrap<{ attempt: ExamAttemptDTO }>(res);
      this.currentAttempt = data.attempt ?? null;
      if (this.currentAttempt) {
        this.timerStatus = "idle";
        this.remainingSeconds = this.currentAttempt.timeLimitMinutes * 60;
      }
    } catch (err: any) {
      this.error = err?.message || "Unable to start attempt.";
    } finally {
      this.loading = false;
    }
  }

  setQuestions(snapshots: ExamQuestionSnapshot[]) {
    this.currentQuestions = snapshots;
    this.currentIndex = 0;
  }

  selectAnswer(questionIndex: number, option: string) {
    this.answers.set(questionIndex, option);
    void this.saveAnswer(questionIndex, option, this.flags.has(questionIndex));
  }

  toggleFlag(questionIndex: number) {
    if (this.flags.has(questionIndex)) {
      this.flags.delete(questionIndex);
    } else {
      this.flags.add(questionIndex);
    }
    void this.saveAnswer(
      questionIndex,
      this.answers.get(questionIndex) ?? null,
      this.flags.has(questionIndex),
    );
  }

  private async saveAnswer(questionIndex: number, selectedOption: string | null, isFlagged: boolean) {
    if (!this.currentAttempt) return;
    try {
      await actions.exam.saveAnswer({
        attemptId: this.currentAttempt.id,
        questionIndex,
        selectedOption: selectedOption ?? undefined,
        isFlagged,
      });
    } catch (err: any) {
      this.error = err?.message || "Unable to save answer.";
    }
  }

  startTimer() {
    if (this.timerStatus === "running") return;
    if (this.remainingSeconds <= 0) {
      this.timerStatus = "expired";
      return;
    }
    this.timerStatus = "running";
    this.clearTimer();
    if (typeof window !== "undefined") {
      this.timerId = window.setInterval(() => this.tick(), 1000);
    }
  }

  pauseTimer() {
    if (this.timerStatus !== "running") return;
    this.timerStatus = "paused";
    this.clearTimer();
  }

  resumeTimer() {
    if (this.timerStatus !== "paused") return;
    this.timerStatus = "running";
    this.startTimer();
  }

  private clearTimer() {
    if (this.timerId && typeof window !== "undefined") {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private async tick() {
    if (this.timerStatus !== "running") return;
    this.remainingSeconds -= 1;
    if (this.remainingSeconds > 0) return;
    this.timerStatus = "expired";
    this.clearTimer();
    await this.submitAttempt(true);
  }

  async submitAttempt(expired = false) {
    if (!this.currentAttempt) return;
    this.loading = true;
    this.error = null;

    try {
      const res = await actions.exam.submitAttempt({
        attemptId: this.currentAttempt.id,
        expired,
      });
      const data = this.unwrap<{ attempt: ExamAttemptDTO }>(res);
      this.currentAttempt = data.attempt ?? null;
      this.timerStatus = expired ? "expired" : "submitted";
      this.success = expired ? "Time is up — exam submitted." : "Exam submitted.";
    } catch (err: any) {
      this.error = err?.message || "Unable to submit exam.";
    } finally {
      this.loading = false;
    }
  }
}

export const registerExamStore = (Alpine: Alpine) => {
  Alpine.store("exam", new ExamStore());
};
