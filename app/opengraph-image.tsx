import { ImageResponse } from "next/og";

/**
 * Generated rather than committed as a binary, so the wording stays reviewable
 * in a diff and cannot drift out of sync with the product.
 */
export const alt =
  "Job Hunt Copilot — an evidence-backed match score against your own CV, the gaps worth preparing for, and letters that don't invent experience";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
// next/og ships its font data for the edge runtime; on Node it prerenders
// without one and fails.
export const runtime = "edge";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafaf9",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: "#78716c", letterSpacing: -0.5 }}>
            Job Hunt Copilot
          </div>
          {/*
            Every element is an explicit flex container with single-string
            children: satori rejects a div holding more than one child node
            unless its display is set, and a <br/> counts as a child. Lines are
            separate divs rather than line breaks for that reason.
          */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 28,
              fontSize: 68,
              color: "#1c1917",
              lineHeight: 1.15,
              letterSpacing: -2,
            }}
          >
            <div style={{ display: "flex" }}>Does this job actually</div>
            <div style={{ display: "flex" }}>match your CV?</div>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 28,
              fontSize: 30,
              color: "#57534e",
              lineHeight: 1.4,
            }}
          >
            <div style={{ display: "flex" }}>
              A match score where every claim is quoted from your CV,
            </div>
            <div style={{ display: "flex" }}>
              the gaps worth preparing for, and letters that don&apos;t invent experience.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {["Next.js 15", "Postgres", "Groq · Gemini", "Evals"].map((chip) => (
            <div
              key={chip}
              style={{
                display: "flex",
                fontSize: 24,
                color: "#57534e",
                border: "1px solid #d6d3d1",
                borderRadius: 999,
                padding: "10px 22px",
              }}
            >
              {chip}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
