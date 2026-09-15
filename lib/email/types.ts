export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string | null }>;
}

/** Thrown when the provider refuses or cannot be reached. Nothing is persisted. */
export class EmailError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "EmailError";
  }
}
