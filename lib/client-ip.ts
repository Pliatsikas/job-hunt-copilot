/**
 * The caller's IP as seen by the platform.
 *
 * Vercel sets `x-real-ip` itself and puts the client first in
 * `x-forwarded-for`; both are trusted only because the platform terminates
 * the connection and rewrites them. Nothing here would be safe on a server
 * reachable directly.
 *
 * Two honest limits on anything keyed by this. A determined attacker rotates
 * addresses, so this raises the cost of minting accounts rather than
 * preventing it. And a shared exit — an office, a university, CGNAT on a
 * mobile network — puts many real people behind one key, which is the reason
 * the login window is generous and the limiter fails open.
 */
export function clientIpFrom(headers: Headers): string {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;

  // Local dev has neither header. One shared bucket is correct there: it is
  // one machine.
  return "unknown";
}
