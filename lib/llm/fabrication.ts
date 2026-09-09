/**
 * Detects the specific failure mode observed in M5: the analysis suggests a
 * bridge for a gap ("build a small CRUD app in Laravel"), and the cover letter
 * restates that advice as something the candidate is already doing —
 * "αυτή την περίοδο αναπτύσσω μια πλήρη CRUD εφαρμογή με Laravel".
 *
 * This is a lint, not a proof. It catches the blunt form: a first-person
 * present or perfect claim in the same sentence as a skill the CV never
 * mentions. It cannot catch a fluent paraphrase, and it does not judge whether
 * the letter is honest overall — see NOTES.md for what still needs a human.
 */

const CLAIM_PATTERNS: RegExp[] = [
  // English: present continuous / present perfect / simple present ownership
  /\bI(?:'m| am)\s+(?:currently\s+)?(?:building|developing|creating|working on|learning|studying|writing)\b/i,
  /\bI(?:'ve| have)\s+(?:been\s+)?(?:built|developed|created|written|used|worked with)\b/i,
  /\bI\s+(?:build|develop|create|use|write|work with)\b/i,
  // Greek: first-person present of the same verbs, plus "έχω" perfect forms.
  // \b is ASCII-only, so it never fires before a Greek letter — these use
  // Unicode-aware lookarounds instead.
  /(?<!\p{L})(?:αναπτύσσω|δημιουργώ|χτίζω|φτιάχνω|υλοποιώ|κατασκευάζω|μαθαίνω|μελετώ)(?!\p{L})/iu,
  /(?<!\p{L})έχω\s+(?:αναπτύξει|δημιουργήσει|υλοποιήσει|χτίσει|χρησιμοποιήσει)(?!\p{L})/iu,
];

export type FabricationFinding = {
  skill: string;
  sentence: string;
  pattern: string;
};

function splitSentences(text: string): string[] {
  // Greek uses "·" and ";" differently; splitting on hard stops is enough here.
  return text
    .split(/(?<=[.!?;·\n])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function mentions(sentence: string, skill: string): boolean {
  // Word-ish boundary so "go" doesn't match "algorithm".
  const escaped = skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}])${escaped}([^\\p{L}]|$)`, "iu").test(sentence);
}

/**
 * @param text        the generated document
 * @param absentSkills skills the CV does not evidence (typically the gaps)
 */
export function findFabricatedClaims(
  text: string,
  absentSkills: string[],
): FabricationFinding[] {
  const findings: FabricationFinding[] = [];

  for (const sentence of splitSentences(text)) {
    for (const skill of absentSkills) {
      if (!mentions(sentence, skill)) continue;
      for (const pattern of CLAIM_PATTERNS) {
        if (pattern.test(sentence)) {
          findings.push({ skill, sentence, pattern: pattern.source });
          break;
        }
      }
    }
  }

  return findings;
}
