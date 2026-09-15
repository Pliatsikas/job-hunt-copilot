import { EmailError, type EmailMessage, type EmailProvider } from "../types";

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";
const TIMEOUT_MS = 10_000;

/**
 * Brevo transactional email over its REST API. One POST, no SDK: the request
 * is four fields and the SDK would be a dependency for the sake of a type.
 * The sender must be a verified address on the Brevo account; that is what
 * lets this work without a domain, and also why the mail may land in spam —
 * the UI says so.
 */
export function createBrevoProvider(
  apiKey: string,
  from: { email: string; name: string },
): EmailProvider {
  return {
    name: "brevo",
    async send(message: EmailMessage) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(ENDPOINT, {
          method: "POST",
          signal: controller.signal,
          headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
          body: JSON.stringify({
            sender: from,
            to: [{ email: message.to }],
            subject: message.subject,
            textContent: message.text,
            htmlContent: message.html,
          }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          // 401 names the variable, like the LLM providers do: "unauthorized"
          // on its own does not say which key in which environment to check.
          if (res.status === 401) {
            throw new EmailError("brevo", "BREVO_API_KEY was rejected by Brevo.", body);
          }
          throw new EmailError("brevo", `Brevo answered ${res.status}.`, body);
        }
        const data = (await res.json()) as { messageId?: string };
        return { id: data.messageId ?? null };
      } catch (error) {
        if (error instanceof EmailError) throw error;
        if (error instanceof Error && error.name === "AbortError") {
          throw new EmailError("brevo", "Brevo did not answer within 10 seconds.", error);
        }
        throw new EmailError("brevo", "Could not reach Brevo.", error);
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
