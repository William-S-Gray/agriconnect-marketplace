import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { logError, logEvent } from './log';

/**
 * Outgoing email over SMTP. Any provider works — Resend, Postmark, SES,
 * Mailgun, or a self-hosted server — by setting SMTP_URL, e.g.
 *   smtps://user:password@smtp.example.com:465
 *
 * Unset, nothing is sent and features that depend on email degrade (see
 * mailConfigured). `memory://` keeps messages in `outbox` for tests.
 *
 * Message bodies are plain text: they contain one link and render the same
 * in every client. Logs never include recipients, links or bodies — a reset
 * link in a log is a credential.
 */

export interface MailMessage { to: string; subject: string; text: string }

export const outbox: MailMessage[] = [];
let transport: Transporter | null | undefined;

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  const url = process.env.SMTP_URL?.trim();
  if (!url) return (transport = null);
  transport = url === 'memory://' ? nodemailer.createTransport({ jsonTransport: true }) : nodemailer.createTransport(url);
  return transport;
}

export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_URL?.trim());
}

/** Sends a message. Returns false, never throws, so callers keep their generic responses. */
export async function sendMail(message: MailMessage): Promise<boolean> {
  const t = getTransport();
  if (!t) {
    logEvent('warn', 'mail_not_configured', { subject: message.subject });
    return false;
  }
  try {
    await t.sendMail({
      from: process.env.MAIL_FROM?.trim() || 'AgriConnect <no-reply@agriconnect.co.zw>',
      ...message,
    });
    if (process.env.SMTP_URL?.trim() === 'memory://') outbox.push(message);
    return true;
  } catch (error) {
    logError('mail_send_failed', error, { subject: message.subject });
    return false;
  }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

const SIGNATURE = '\n\n— AgriConnect\nZimbabwe’s farm-to-market marketplace';

export function passwordResetMessage(to: string, url: string): MailMessage {
  return {
    to,
    subject: 'Reset your AgriConnect password',
    text: `Someone asked to reset the password for this AgriConnect account.\n\nReset it here (the link works once, for 30 minutes):\n${url}\n\nIf it wasn’t you, ignore this email — your password stays the same.${SIGNATURE}`,
  };
}

export function verifyEmailMessage(to: string, url: string): MailMessage {
  return {
    to,
    subject: 'Confirm your email for AgriConnect',
    text: `Welcome to AgriConnect.\n\nConfirm your email to finish creating your account (the link works for 24 hours):\n${url}\n\nIf you didn’t sign up, ignore this email and no account will be activated.${SIGNATURE}`,
  };
}

/**
 * Sent when someone registers with an address that already has an account.
 * The registering browser sees the same "check your email" response either
 * way, so registration no longer reveals which addresses are registered.
 */
export function alreadyRegisteredMessage(to: string, appUrl: string): MailMessage {
  return {
    to,
    subject: 'You already have an AgriConnect account',
    text: `Someone tried to create an AgriConnect account with this email, but you already have one.\n\nSign in: ${appUrl}/login\nForgot your password? ${appUrl}/forgot-password\n\nIf it wasn’t you, you can ignore this email.${SIGNATURE}`,
  };
}
