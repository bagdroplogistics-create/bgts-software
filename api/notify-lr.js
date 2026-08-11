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

  /* Fetch the single source-of-truth logo (public/bgts-logo.png, deployed
     alongside this function) from this same deployment's own origin, and
     embed it as an inline CID attachment rather than a remote <img src>
     URL — CID-embedded images render immediately in most mail clients
     without the "click to show images" prompt that external image URLs
     trigger. Built from the request's own host so this works on preview
     deployments and custom domains alike, not just one hardcoded URL. If
     the fetch fails for any reason, the email still sends — just without
     the logo — rather than failing the whole notification over a decorative
     image. */
  let logoAttachment = null;
  try {
    const origin = (req.headers['x-forwarded-proto'] || 'https') + '://' + req.headers.host;
    const logoResp = await fetch(origin + '/bgts-logo.png');
    if (logoResp.ok) {
      const buf = Buffer.from(await logoResp.arrayBuffer());
      logoAttachment = { filename: 'bgts-logo.png', content: buf, cid: 'bgtslogo' };
    }
  } catch (e) { /* logo is decorative — proceed without it */ }

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = ''
    + '<div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;border:1px solid #d4d4d8;border-radius:10px;overflow:hidden">'
    + '<div style="background:#2b2b2f;border-top:3px solid #e27438;padding:16px 20px">'
    + (logoAttachment ? '<img src="cid:bgtslogo" alt="BGTS" style="height:32px;width:auto;display:block" />' : '<div style="color:#fff;font-weight:800;font-size:16px;letter-spacing:.5px">BGTS-OS</div>')
    + '</div>'
    + '<div style="padding:20px;color:#302f33;font-size:13.5px;line-height:1.6;white-space:pre-line">' + esc(text) + '</div>'
    + '<div style="padding:12px 20px;border-top:1px solid #ececed;background:#f7f7f7;color:#71717a;font-size:10.5px">Sent automatically by BGTS-OS — Baroda Goods Transport Service Pvt. Ltd.</div>'
    + '</div>';

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD }
    });
    await transporter.sendMail({
      from: 'BGTS-OS <' + GMAIL_USER + '>',
      to: NOTIFY_TO,
      subject: String(subject),
      text: String(text),
      html,
      attachments: logoAttachment ? [logoAttachment] : []
    });
    res.status(200).json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  }
};
