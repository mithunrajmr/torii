// backend/src/services/notificationService.js
// Notification gateway — OTP delivery + ticket status emails.
//
// Delivery priority (checked per-call):
//   1. SMTP_HOST set (Brevo / SendGrid / any SMTP)  → nodemailer SMTP
//   2. RESEND_API_KEY set                           → Resend REST API
//   3. NOTIFICATION_GATEWAY_URL set                 → custom HTTP POST gateway
//   4. None of the above (dev mode)                 → console log only, never throws
//
// Brevo SMTP settings (add to .env):
//   SMTP_HOST=smtp-relay.brevo.com
//   SMTP_PORT=587
//   SMTP_USER=<your Brevo login email>
//   SMTP_PASS=<your Brevo SMTP key>          ← Brevo dashboard > SMTP & API > SMTP tab
//   SMTP_FROM=TORII Bank <noreply@yourdomain.com>
//
// Both OTP and ticket-status functions are fire-and-forget safe —
// they never propagate errors to the caller.

import nodemailer from 'nodemailer';

// ─── SMTP transport (lazy-initialised once, reused across calls) ──────────────
let _smtpTransport = null;

function getSmtpTransport() {
  if (_smtpTransport) return _smtpTransport;

  const host = process.env.SMTP_HOST;
  if (!host) return null;

  _smtpTransport = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_PORT === '465', // true only for port 465
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return _smtpTransport;
}

// ─── Delivery backends ────────────────────────────────────────────────────────

/**
 * Send via nodemailer SMTP (Brevo / any SMTP provider).
 */
async function sendViaSMTP(to, subject, text) {
  const transport = getSmtpTransport();
  if (!transport) throw new Error('SMTP not configured');

  const senderEmail = process.env.SMTP_FROM || (process.env.SMTP_USER ? `TORII Bank <${process.env.SMTP_USER}>` : 'TORII Bank <noreply@torii.bank>');
  const from = senderEmail;

  const info = await transport.sendMail({ from, to, subject, text });
  console.info(`[notificationService] SMTP sent — messageId=${info.messageId} accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)}`);
}

/**
 * Send via Resend REST API.
 */
async function sendViaResend(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL || 'TORII Bank <noreply@torii.bank>';

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ from, to, subject, text }),
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Resend API error ${res.status}: ${body}`);
  }
}

/**
 * Send via a custom HTTP gateway that accepts { to, subject, body }.
 */
async function sendViaGateway(to, subject, body) {
  const gatewayUrl = process.env.NOTIFICATION_GATEWAY_URL;
  const res = await fetch(gatewayUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, body }),
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    throw new Error(`Gateway error ${res.status}`);
  }
}

/**
 * Route email through the best available channel.
 * Priority: SMTP → Resend → Gateway → console.
 * Swallows all errors — email failures must never block OTP responses.
 */
async function sendEmail(to, subject, text) {
  if (process.env.SMTP_HOST) {
    console.info(`[notificationService] Attempting SMTP send to ${to} via ${process.env.SMTP_HOST}`);
    await sendViaSMTP(to, subject, text);
  } else if (process.env.RESEND_API_KEY) {
    await sendViaResend(to, subject, text);
  } else if (process.env.NOTIFICATION_GATEWAY_URL) {
    await sendViaGateway(to, subject, text);
  } else {
    // Dev mode — OTP is visible in the server terminal
    console.info(`[notificationService][DEV] Email to ${to} — ${subject}`);
    console.info(`[notificationService][DEV] Body:\n${text}`);
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Send an OTP to the customer's registered email address.
 *
 * @param {string} email — Customer's registered email
 * @param {string} otp   — 6-digit numeric OTP string
 */
export async function sendOTPEmail(email, otp) {
  const subject = 'TORII Kiosk — Your One-Time Verification Code';
  const text = [
    `Your TORII kiosk verification code is: ${otp}`,
    '',
    'This code expires in 5 minutes.',
    'Do not share this code with anyone, including bank staff.',
    '',
    '— TORII Autonomous Branch Operations',
  ].join('\n');

  try {
    await sendEmail(email, subject, text);
  } catch (err) {
    // Never let email failures affect the OTP request response
    console.warn('[notificationService] OTP email send error:', err.message);
    console.warn('[notificationService] Full error:', err);
  }
}

/**
 * Send a ticket status notification to the customer.
 * Called fire-and-forget by tellerController after APPROVE/REJECT actions.
 *
 * @param {string} email   — Customer's registered email
 * @param {string} status  — 'APPROVED' | 'REJECTED' | 'ESCALATED'
 * @param {object} details — { rejectionReason?: string }
 */
export async function sendTicketStatusEmail(email, status, details = {}) {
  if (!process.env.SMTP_HOST && !process.env.RESEND_API_KEY && !process.env.NOTIFICATION_GATEWAY_URL) {
    console.info(`[notificationService][DEV] Ticket ${status} notification → ${email}`, details);
    return;
  }

  const subjects = {
    APPROVED:  'TORII — PAN Verification Approved ✓',
    REJECTED:  'TORII — PAN Verification Requires Attention',
    ESCALATED: 'TORII — Your Request Has Been Escalated',
  };

  const bodies = {
    APPROVED: [
      'Great news! Your PAN card verification has been approved by our teller.',
      '',
      'Your compliance hold has been lifted. You can now complete your pending transaction at the kiosk or branch.',
      '',
      '— TORII Autonomous Branch Operations',
    ].join('\n'),

    REJECTED: [
      'Your PAN card submission could not be verified at this time.',
      '',
      `Reason: ${details.rejectionReason || 'Document could not be verified'}`,
      '',
      'Please visit your nearest branch with your original PAN card for in-person verification.',
      '',
      '— TORII Autonomous Branch Operations',
    ].join('\n'),

    ESCALATED: [
      'Your verification request has been escalated to our compliance team for review.',
      '',
      'You will be contacted within 2 business days. If you have questions, call our helpline: 1800-XXX-XXXX.',
      '',
      '— TORII Autonomous Branch Operations',
    ].join('\n'),
  };

  try {
    await sendEmail(
      email,
      subjects[status] || 'TORII — Account Update',
      bodies[status]   || `Your ticket status: ${status}`
    );
  } catch (err) {
    console.warn('[notificationService] Status email send error:', err.message);
  }
}

export default { sendOTPEmail, sendTicketStatusEmail };
