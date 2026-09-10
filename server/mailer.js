const nodemailer = require('nodemailer');
require('dotenv').config();

// Dev fallback: kalau SMTP belum diisi atau MAIL_LOGGING=true, OTP ditulis ke console
// supaya alur tetap bisa diuji end-to-end tanpa kredensial email asli.
let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const { EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS } = process.env;
  if (EMAIL_HOST && EMAIL_USER && EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: EMAIL_HOST,
      port: Number(EMAIL_PORT) || 465,
      secure: String(EMAIL_SECURE) !== 'false',
      auth: { user: EMAIL_USER, pass: EMAIL_PASS },
      tls: { rejectUnauthorized: false },
    });
  }
  return transporter;
}

async function sendOtpEmail(email, otp, fullName = '') {
  const logMode = process.env.MAIL_LOGGING === 'true';
  const t = getTransporter();

  if (!t || logMode) {
    // Dev/testing fallback — jangan dianggap "email terkirim"o0
    console.log('\n====================================================');
    console.log('  [MAIL LOG — dev fallback, email TIDAK terkirim]');
    console.log(`  Kepada : ${email} ${fullName ? '(' + fullName + ')' : ''}`);
    console.log(`  Kode OTP: ${otp}`);
    console.log('====================================================\n');
    if (!t) return { delivered: false, reason: 'smtp_not_configured' };
  }

  const from = process.env.EMAIL_FROM || 'Absensi LT MTsN 1 Kebumen';
  await t.sendMail({
    from: `"${from}" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Kode OTP Reset Password — Absensi LT',
    text: `Halo${fullName ? ' ' + fullName : ''},\n\nKode OTP Anda: ${otp}\n\nKode berlaku 10 menit. Jangan bagikan ke siapa pun.\n\n— Absensi LT MTsN 1 Kebumen`,
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
      <h2 style="color:#16a34a;margin:0 0 16px">Reset Password — Absensi LT</h2>
      <p>Halo${fullName ? ' ' + fullName : ''},</p>
      <p>Kode OTP untuk <b>atur ulang password</b> kamu:</p>
      <p style="font-size:34px;font-weight:800;letter-spacing:8px;background:#f0fdf4;border:1px dashed #3a7a55;border-radius:10px;text-align:center;padding:14px;color:#15803d">${otp}</p>
      <p style="color:#6b7280;font-size:13px">Kode berlaku <b>10 menit</b>. Jangan bagikan ke siapa pun.</p>
      <hr style="margin:20px 0;border:none;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px">— Absensi LT MTsN 1 Kebumen</p>
    </div>`,
  });
  return { delivered: true };
}

module.exports = { sendOtpEmail };

