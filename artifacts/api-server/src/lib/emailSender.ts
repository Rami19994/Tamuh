import nodemailer from "nodemailer";

export interface SmtpStatus {
  configured: boolean;
  missing: string[];
  host: string | null;
  port: number | null;
  user: string | null;
  from: string | null;
}

/** Returns which SMTP variables are configured (values hidden). */
export function getSmtpStatus(): SmtpStatus {
  const host = process.env.SMTP_HOST?.trim() || null;
  const portRaw = process.env.SMTP_PORT?.trim();
  const port = portRaw ? parseInt(portRaw, 10) : null;
  const user = process.env.SMTP_USER?.trim() || null;
  const pass = process.env.SMTP_PASS?.trim() || null;
  const from = process.env.SMTP_FROM?.trim() || null;

  const missing: string[] = [];
  if (!host) missing.push("SMTP_HOST");
  if (!portRaw) missing.push("SMTP_PORT");
  if (!user) missing.push("SMTP_USER");
  if (!pass) missing.push("SMTP_PASS");
  if (!from) missing.push("SMTP_FROM");

  return { configured: missing.length === 0, missing, host, port, user, from };
}

/**
 * Builds a fresh transporter on every call so env var changes after restart
 * are always picked up — no stale singleton.
 */
function buildTransporter() {
  const status = getSmtpStatus();
  if (!status.configured) return null;

  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureEnv === "true" || status.port === 465;

  return nodemailer.createTransport({
    host: status.host!,
    port: status.port!,
    secure,
    auth: {
      user: process.env.SMTP_USER!.trim(),
      pass: process.env.SMTP_PASS!.trim(),
    },
    tls: { rejectUnauthorized: false },
  });
}

export async function sendEmail(
  to: string,
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  const status = getSmtpStatus();

  if (!status.configured) {
    const msg = `SMTP not configured — missing: ${status.missing.join(", ")}`;
    console.error(`[EMAIL FAILED] ${msg}`);
    return { success: false, error: msg };
  }

  const t = buildTransporter()!;
  const from = process.env.SMTP_FROM!.trim();

  try {
    const info = await t.sendMail({ from, to, subject, html: htmlBody });
    console.log(`[EMAIL SENT] To: ${to} | MessageId: ${info.messageId}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[EMAIL ERROR] To: ${to} | ${err.message}`);
    return { success: false, error: err.message };
  }
}

/**
 * Verifies the SMTP connection. Returns a structured result so callers can
 * surface meaningful feedback (used by the admin test endpoint and on startup).
 */
export async function testSmtpConnection(): Promise<{ ok: boolean; error?: string }> {
  const status = getSmtpStatus();
  if (!status.configured) {
    return { ok: false, error: `Missing variables: ${status.missing.join(", ")}` };
  }

  const t = buildTransporter()!;
  try {
    await t.verify();
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/** Called on server startup — logs result but never throws. */
export async function verifySmtpConnection(): Promise<void> {
  const result = await testSmtpConnection();
  if (result.ok) {
    console.log("[SMTP] Connection verified — ready to send email.");
  } else {
    console.warn("[SMTP] Connection verification FAILED:", result.error);
  }
}
