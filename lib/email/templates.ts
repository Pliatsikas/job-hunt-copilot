import type { EmailMessage } from "./types";

/**
 * One column, dark text on white, one button, and the raw link printed under
 * it for clients that strip buttons. A plain-text alternative is always
 * included. The point is to look like a system email from a real product and
 * to give a spam filter nothing extra to object to — a bare mailbox sender
 * is already a strike, and this should not add another.
 */
export function verificationEmail(input: {
  to: string;
  link: string;
  productName: string;
}): EmailMessage {
  const { to, link, productName } = input;
  const subject = `Confirm your email for ${productName}`;

  const text = [
    `Confirm your email to finish creating your ${productName} account.`,
    "",
    "Open this link (it works for 24 hours):",
    link,
    "",
    "If you did not sign up, you can ignore this email — nothing will happen.",
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;padding:0;background:#f6f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1f26;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f7f9;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;">
        <tr><td style="padding:28px 32px 8px;font-size:14px;color:#6b7280;">${escapeHtml(productName)}</td></tr>
        <tr><td style="padding:0 32px;font-size:20px;font-weight:600;line-height:1.3;">Confirm your email</td></tr>
        <tr><td style="padding:12px 32px 0;font-size:15px;line-height:1.55;">
          One click finishes creating your account. The link works for 24 hours.
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <a href="${escapeAttr(link)}" style="display:inline-block;background:#2f52d8;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;padding:12px 20px;border-radius:8px;">Confirm email</a>
        </td></tr>
        <tr><td style="padding:0 32px 8px;font-size:13px;line-height:1.5;color:#6b7280;">
          If the button does not work, open this link:<br>
          <a href="${escapeAttr(link)}" style="color:#2f52d8;word-break:break-all;">${escapeHtml(link)}</a>
        </td></tr>
        <tr><td style="padding:16px 32px 28px;font-size:13px;line-height:1.5;color:#6b7280;border-top:1px solid #f0f1f3;">
          If you did not sign up, ignore this email — nothing will happen.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { to, subject, text, html };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}
function escapeAttr(s: string): string {
  return escapeHtml(s);
}
