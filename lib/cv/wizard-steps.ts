/**
 * The guide's steps, in the order a CV is written. A plain module: the
 * server page reads it to validate `?step=`, the client wizard to render —
 * an export from the client file would reach the server as a reference,
 * not an array.
 */
export const WIZARD_STEPS = ["identity", "contacts", "experience", "education", "skills", "projects", "extras"] as const;
export type WizardStep = (typeof WIZARD_STEPS)[number];
