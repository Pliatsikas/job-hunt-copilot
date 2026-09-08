"use client";

import { useState, type KeyboardEvent } from "react";
import { normalizeSkills } from "@/lib/schemas/profile";
import { Input } from "@/components/ui/input";

/**
 * Chips are a convenience — the server normalizes again on submit, so a
 * pasted list or a stray capital can't get through unnormalized.
 */
export function SkillsEditor({ initial }: { initial: string[] }) {
  const [skills, setSkills] = useState<string[]>(() => normalizeSkills(initial));
  const [draft, setDraft] = useState("");

  function commitDraft() {
    if (!draft.trim()) return;
    setSkills((current) => normalizeSkills([...current, draft]));
    setDraft("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      // Enter would otherwise submit the whole profile form.
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Backspace" && !draft && skills.length) {
      setSkills((current) => current.slice(0, -1));
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* One field per skill: formData.getAll("skills") reads them natively. */}
      {skills.map((skill) => (
        <input key={skill} type="hidden" name="skills" value={skill} />
      ))}

      <div className="flex flex-wrap gap-1.5">
        {skills.length === 0 && (
          <span className="text-sm text-muted-foreground">No skills yet.</span>
        )}
        {skills.map((skill) => (
          <span
            key={skill}
            className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs"
          >
            {skill}
            <button
              type="button"
              onClick={() => setSkills((c) => c.filter((s) => s !== skill))}
              aria-label={`Remove ${skill}`}
              className="text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commitDraft}
        placeholder="Type a skill and press Enter"
        aria-label="Add a skill"
      />
      <p className="text-xs text-muted-foreground">
        Stored lowercase and de-duplicated. Comma-separated pastes are split automatically.
      </p>
    </div>
  );
}
