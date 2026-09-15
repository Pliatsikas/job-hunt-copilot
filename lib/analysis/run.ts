import { getProvider } from "../llm";
import { groundAnalysis } from "../llm/grounding";
import * as analyzePrompt from "../llm/prompts/analyze.v2";
import { completeWithRepair } from "../llm/repair";
import { assertWithinBudget, recordProviderCall } from "../llm/usage";
import { analysisResultSchema, type AnalysisResult } from "../schemas/analysis";

export const ANALYSIS_TEMPERATURE = 0.2;
export const ANALYSIS_MAX_TOKENS = 4096;

export type RunAnalysisInput = {
  userId: string;
  cvText: string;
  skills: string[];
  jobDescription: string;
};

export type RunAnalysisOutput = {
  result: AnalysisResult;
  droppedClaims: number;
  lowConfidence: boolean;
  provider: string;
  model: string;
  promptVersion: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
};

/**
 * The analysis pipeline with no opinion about where the result goes: budget
 * check, provider call with the single repair, grounding. The analyze action
 * stores it on an Application in a transaction that also writes the
 * denormalized score; M12's ingestion stores it on a Lead. Both call this,
 * so "auto-score on arrival" is the same analysis a user would get by hand,
 * not a cheaper cousin of it — and rule 8 stays intact, because this
 * function writes nothing.
 */
export async function runAnalysis(input: RunAnalysisInput): Promise<RunAnalysisOutput> {
  await assertWithinBudget(input.userId);

  const provider = getProvider();
  const completion = await completeWithRepair(
    provider,
    {
      system: analyzePrompt.system,
      user: analyzePrompt.buildUserPrompt({
        cvText: input.cvText,
        skills: input.skills,
        jobDescription: input.jobDescription,
      }),
      temperature: ANALYSIS_TEMPERATURE,
      maxTokens: ANALYSIS_MAX_TOKENS,
    },
    analysisResultSchema,
    (usage) => recordProviderCall(input.userId, usage),
  );

  const grounded = groundAnalysis(completion.data, input.cvText);

  return {
    result: grounded.result,
    droppedClaims: grounded.droppedClaims,
    lowConfidence: grounded.lowConfidence,
    provider: provider.name,
    model: provider.model,
    promptVersion: analyzePrompt.version,
    inputTokens: completion.usage.inputTokens,
    outputTokens: completion.usage.outputTokens,
    latencyMs: completion.latencyMs,
  };
}
