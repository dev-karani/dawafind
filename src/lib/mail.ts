import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null | undefined;

function getTransport() {
  if (transporter !== undefined) return transporter;
  transporter = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  return transporter;
}

/**
 * Sends an email. Without SMTP_URL (local development) the message is written to the server log.
 * Failures never break the calling workflow.
 */
export async function sendMail(to: string, subject: string, text: string) {
  const from = process.env.EMAIL_FROM || "DawaFind <no-reply@dawafind.example>";
  const t = getTransport();
  if (!t) {
    console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}\n`);
    return;
  }
  try {
    await t.sendMail({ from, to, subject, text });
  } catch (err) {
    console.error("[mail] failed to send", err);
  }
}
