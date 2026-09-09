import type { AnalysisResult } from "../schemas/analysis";

/** Shared by the conformance suite and the repair/grounding tests. */
export const FIXTURE_CV = `Alexandros is a fullstack developer.
I designed and built a RAG-based AI copilot for Jira that queries internal knowledge bases.
I implemented a REST API with JWT authentication and refresh tokens.
I built drag-and-drop boards and real-time collaboration over WebSockets with Socket.io.
I deployed the application with Docker and CI/CD to a managed Postgres database.`;

export const FIXTURE_JOB_DESCRIPTION = `Backend engineer. You will build REST APIs in Node.js,
model data in PostgreSQL, and ship with Docker. Kubernetes experience required. 5+ years.`;

export const FIXTURE_SKILLS = ["typescript", "postgresql", "docker"];

export const VALID_RESULT: AnalysisResult = {
  matchScore: 62,
  verdict: "worth_applying",
  summary: "Strong on APIs and Postgres, no Kubernetes.",
  matchedSkills: [
    {
      skill: "rest apis",
      evidenceFromCv: "I implemented a REST API with JWT authentication and refresh tokens.",
    },
    {
      skill: "docker",
      evidenceFromCv: "I deployed the application with Docker and CI/CD",
    },
  ],
  gaps: [
    { skill: "kubernetes", severity: "blocker", howToBridge: "Deploy a toy service to k3s." },
  ],
  keywordsToMirror: ["REST", "PostgreSQL", "Docker"],
  redFlags: ["5+ years demanded for a role described at mid level"],
  likelyQuestions: ["How would you containerise this service?"],
};
