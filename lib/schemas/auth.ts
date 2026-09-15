import { z } from "zod";
import { firstUnmetRuleLabel } from "../password-rules";

export const registerSchema = z.object({
  email: z.email("Enter a valid email address"),
  // The same rule list the sign-up checklist renders (lib/password-rules.ts);
  // the error is the first unmet rule, so the message matches the checkbox
  // the user can see is empty.
  password: z.string().superRefine((password, ctx) => {
    const message = firstUnmetRuleLabel(password);
    if (message) ctx.addIssue({ code: "custom", message });
  }),
});

export const loginSchema = z.object({
  email: z.email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});
