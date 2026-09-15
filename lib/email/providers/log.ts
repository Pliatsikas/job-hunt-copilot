import type { EmailMessage, EmailProvider } from "../types";

/**
 * Prints the message to the server log instead of sending it. Used whenever
 * BREVO_API_KEY is unset — local development, CI, the end-to-end suite — so a
 * test run never mails anyone and a developer without a key can still read
 * the verification link off the console and click it.
 */
export function createLogProvider(): EmailProvider {
  return {
    name: "log",
    async send(message: EmailMessage) {
      console.info(
        `[email:log] to=${message.to} subject=${JSON.stringify(message.subject)}\n${message.text}`,
      );
      return { id: null };
    },
  };
}
