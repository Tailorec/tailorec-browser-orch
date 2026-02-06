import * as PwAi from "./pw-ai.js";

export type PwAiModule = typeof PwAi;

export async function getPwAiModule(): Promise<PwAiModule> {
  return PwAi;
}
