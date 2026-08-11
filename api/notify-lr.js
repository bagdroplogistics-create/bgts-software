/* Vercel serverless function — sends the "New LR Created" email automatically
   via Gmail SMTP, server-side. This runs on Vercel's servers, never in the
   browser, so the Gmail credentials below are read from environment
   variables that must be added in Vercel (Project → Settings → Environment
   Variables) WITHOUT the EXPO_PUBLIC_ prefix — that prefix is what makes a
   variable get baked into the public browser bundle, which is the opposite
   of what we want for a password.

   Required env vars:
     GMAIL_USER          the Gmail (or Google Workspace) address to send from
     GMAIL_APP_PASSWORD  a 16-character App Password generated for that
                          account at myaccount.google.com/apppasswords
                          (requires 2-Step Verification to be turned on first)
   Optional:
     LR_NOTIFY_EMAIL     recipient address, defaults to info@bgts.in below

   Called from src/screens/LRFormScreen.js's emailNewLR() with a POST of
   { subject, text }. Falls back to the old mailto: draft on the client side
   if this call fails for any reason (not configured yet, network error,
   etc.) so a new-LR notification is never silently lost. */
const nodemailer = require('nodemailer');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const GMAIL_USER = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  const NOTIFY_TO = process.env.LR_NOTIFY_EMAIL || 'info@bgts.in';

  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) {
    res.status(500).json({ error: 'Email not configured on the server yet (missing GMAIL_USER / GMAIL_APP_PASSWORD environment variables in Vercel).' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { res.status(400).json({ error: 'Invalid JSON body' }); return; }
  }
  const subject = body && body.subject;
  const text = body && body.text;
  if (!subject || !text) {
    res.status(400).json({ error: 'Missing subject or text in request body' });
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    });
    await transporter.sendMail({
      from: 'BGTS-OS <' + GMAIL_USER + '>',
      to: NOTIFY_TO,
      subject: String(subject),
      text: String(text)
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
