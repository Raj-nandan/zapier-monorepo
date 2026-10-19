import nodemailer from "nodemailer";
import { env } from "@repo/config";
import { logger } from "@repo/logger";

export type Mailer = (input: { to: string; subject: string; text: string }) => Promise<void>;

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;

function smtpConfigured(): boolean {
  return Boolean(env.SMTP_HOST && env.SMTP_USER);
}

export function createMailer(): Mailer {
  return async ({ to, subject, text }) => {
    if (!smtpConfigured()) {
      logger.warn({ to }, "smtp not configured, reset email not sent");
      return;
    }
    if (!transport) {
      const port = Number(env.SMTP_PORT || 587);
      transport = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure: port === 465,
        auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      });
    }
    await transport.sendMail({ from: env.SMTP_USER, to, subject, text });
  };
}

export function resetLink(token: string): string {
  return `${env.WEB_URL || "http://localhost:3000"}/reset?token=${encodeURIComponent(token)}`;
}

export function passwordResetMailer(send: Mailer = createMailer()): Mailer {
  return ({ to, text }) =>
    send({
      to,
      subject: "Reset your password",
      text,
    });
}
