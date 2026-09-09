import { NextResponse } from "next/server";
import { getProvider } from "@/lib/llm";
import * as coverLetterPrompt from "@/lib/llm/prompts/cover-letter.v1";
import * as followUpPrompt from "@/lib/llm/prompts/follow-up.v1";
import { AnalysisError } from "@/lib/llm/repair";
import { LlmAuthError, LlmQuotaError } from "@/lib/llm/types";
import { assertUnderDailyLimit, recordProviderCall } from "@/lib/llm/usage";
import {
  getLatestAnalysisResult,
  saveGeneratedDocument,
} from "@/lib/applications/documents";
import { requireOwnedApplication } from "@/lib/applications/guards";
import { getProfile } from "@/lib/profile/get";
import { generateRequestSchema } from "@/lib/schemas/generate";

// The one route where a text stream *is* the product (SPEC.md §8 Α4).
// pg and the Prisma adapter aren't edge-compatible.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GENERATION_TEMPERATURE = 0.7;
const GENERATION_MAX_TOKENS = 2000;

export async function POST(request: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body" }, { status: 400 });
  }

  const parsed = generateRequestSchema.safeParse(parsedBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    // Ownership before anything else — this is the only way to reach it.
    const application = await requireOwnedApplication(input.applicationId);

    const profile = await getProfile();
    if (!profile?.cvText.trim()) {
      return NextResponse.json(
        { error: "Add your CV text on the profile page first." },
        { status: 400 },
      );
    }

    await assertUnderDailyLimit(application.userId);

    // The newest analysis grounds the letter; absent one, the prompt says so
    // and tells the model to stay conservative rather than improvise.
    const analysis = await getLatestAnalysisResult(application.id, application.userId);

    const isCoverLetter = input.kind === "COVER_LETTER";

    const system = isCoverLetter ? coverLetterPrompt.system : followUpPrompt.system;
    const user = isCoverLetter
      ? coverLetterPrompt.buildUserPrompt({
          cvText: profile.cvText,
          jobDescription: application.jobDescription,
          roleTitle: application.roleTitle,
          companyName: application.company?.name ?? null,
          analysis,
          language: input.language,
          tone: input.tone,
          length: input.length,
        })
      : followUpPrompt.buildUserPrompt({
          cvText: profile.cvText,
          jobDescription: application.jobDescription,
          roleTitle: application.roleTitle,
          companyName: application.company?.name ?? null,
          context: input.context!,
          language: input.language,
          tone: input.tone,
        });

    const provider = getProvider();
    const encoder = new TextEncoder();
    let full = "";

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of provider.stream({
            system,
            user,
            temperature: GENERATION_TEMPERATURE,
            maxTokens: GENERATION_MAX_TOKENS,
          })) {
            full += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          await recordProviderCall(application.userId);

          // Persisted only once the stream completed — a truncated generation
          // shouldn't leave a half-written document behind.
          if (full.trim()) {
            await saveGeneratedDocument({
              applicationId: application.id,
              userId: application.userId,
              type: input.kind,
              language: input.language,
              content: full.trim(),
            });
          }

          controller.close();
        } catch (error) {
          // The stream has already started, so the status code is spent —
          // append the message as text rather than failing silently.
          const message =
            error instanceof LlmAuthError ||
            error instanceof LlmQuotaError ||
            error instanceof AnalysisError
              ? error.message
              : "Generation failed partway through. Nothing was saved.";
          console.error("Generation stream failed:", error);
          controller.enqueue(encoder.encode(`\n\n[${message}]`));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (
      error instanceof LlmAuthError ||
      error instanceof LlmQuotaError ||
      error instanceof AnalysisError
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Application not found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Generation failed:", error);
    return NextResponse.json({ error: "Generation failed" }, { status: 500 });
  }
}
