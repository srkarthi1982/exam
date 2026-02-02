import type { Alpine } from "alpinejs";
import { registerExamStore } from "./modules/exam/store";

export default function initAlpine(Alpine: Alpine) {
  registerExamStore(Alpine);
}
