const { Resend } = require("resend");

/**
 * Email Service (Resend Provider)
 *
 * Why this abstraction exists:
 * Decouples the email delivery mechanism from the auth controller.
 * If the email provider changes, only this file needs updating.
 *
 * Development Fallback:
 * If RESEND_API_KEY is not configured, OTPs are logged to the console.
 * This allows full development/testing without a Resend account.
 */

const IS_DEV = process.env.NODE_ENV !== "production";
const FROM_EMAIL = process.env.EMAIL_FROM || "StudySync <noreply@studysync.app>";

let resend = null;
if (process.env.RESEND_API_KEY) {
    resend = new Resend(process.env.RESEND_API_KEY);
}

// ── Email Templates ───────────────────────────────────────────────────────────

/**
 * baseTemplate
 * Shared HTML wrapper for all StudySync emails.
 * Uses inline styles for maximum email client compatibility.
 */
const baseTemplate = (content) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>StudySync</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0284c7,#0ea5e9,#10b981);padding:32px 40px;text-align:center;">
              <div style="display:inline-flex;align-items:center;gap:10px;">
                <div style="width:40px;height:40px;background:rgba(255,255,255,0.2);border-radius:10px;display:inline-flex;align-items:center;justify-content:center;">
                  <span style="color:#fff;font-weight:900;font-size:14px;letter-spacing:-0.5px;">SS</span>
                </div>
                <span style="color:#ffffff;font-size:22px;font-weight:800;letter-spacing:-0.5px;">Study<span style="opacity:0.85">Sync</span></span>
              </div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding:40px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f1f5f9;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;line-height:1.6;">
                If you did not request this, you can safely ignore this email.<br>
                &copy; ${new Date().getFullYear()} StudySync &mdash; Smart Productivity &amp; Task Management
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const otpBlock = (otp) => `
<div style="text-align:center;margin:28px 0;">
  <div style="display:inline-block;background:#f0f9ff;border:2px dashed #0ea5e9;border-radius:12px;padding:20px 40px;">
    <p style="margin:0 0 4px 0;font-size:11px;font-weight:700;color:#0369a1;text-transform:uppercase;letter-spacing:1px;">Your Verification Code</p>
    <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:12px;color:#0284c7;font-variant-numeric:tabular-nums;">${otp}</p>
  </div>
  <p style="margin:12px 0 0 0;font-size:13px;color:#64748b;">This code expires in <strong>5 minutes</strong>.</p>
</div>
`;

// ── Email Senders ─────────────────────────────────────────────────────────────

/**
 * sendEmailVerificationOTP
 *
 * Sends a professional OTP email for account email verification.
 */
const sendEmailVerificationOTP = async (email, name, otp) => {
    const subject = "Verify your StudySync email address";
    const htmlContent = baseTemplate(`
        <h2 style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#0f172a;">Verify your email</h2>
        <p style="margin:0 0 24px 0;font-size:15px;color:#475569;line-height:1.6;">
          Hi <strong>${name}</strong>, welcome to StudySync! Please verify your email address to activate your account.
        </p>
        ${otpBlock(otp)}
        <div style="background:#f8fafc;border-radius:10px;padding:16px;margin-top:8px;">
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
            &bull; Do not share this code with anyone.<br>
            &bull; StudySync will never ask for your verification code.<br>
            &bull; The code is valid for 5 minutes only.
          </p>
        </div>
    `);

    return await sendEmail({ to: email, subject, html: htmlContent });
};

/**
 * sendPasswordResetOTP
 *
 * Sends a professional OTP email for password recovery.
 */
const sendPasswordResetOTP = async (email, name, otp) => {
    const subject = "Reset your StudySync password";
    const htmlContent = baseTemplate(`
        <h2 style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#0f172a;">Reset your password</h2>
        <p style="margin:0 0 24px 0;font-size:15px;color:#475569;line-height:1.6;">
          Hi <strong>${name}</strong>, we received a request to reset your StudySync password. Use the code below.
        </p>
        ${otpBlock(otp)}
        <div style="background:#fef2f2;border-radius:10px;padding:16px;margin-top:8px;border-left:3px solid #f87171;">
          <p style="margin:0;font-size:13px;color:#64748b;line-height:1.6;">
            &bull; If you did not request a password reset, your account may be at risk.<br>
            &bull; Contact support immediately if you did not initiate this request.<br>
            &bull; This code expires in 5 minutes.
          </p>
        </div>
    `);

    return await sendEmail({ to: email, subject, html: htmlContent });
};

// ── Internal Send Helper ──────────────────────────────────────────────────────

const sendEmail = async ({ to, subject, html }) => {
    // Development Fallback: Log OTP if Resend is not configured
    if (!resend) {
        console.log("\n────────────────────────────────────────────");
        console.log("📧  DEVELOPMENT EMAIL (Resend not configured)");
        console.log(`    To:      ${to}`);
        console.log(`    Subject: ${subject}`);
        const otpMatch = html.match(/font-size:40px[^>]+>(\d{6})</);
        if (otpMatch) console.log(`    OTP:     ${otpMatch[1]}`);
        console.log("────────────────────────────────────────────\n");
        return { success: true, devMode: true };
    }

    try {
        const { data, error } = await resend.emails.send({
            from: FROM_EMAIL,
            to,
            subject,
            html,
        });

        if (error) {
            console.error("Resend delivery failed:", error.message);
            if (IS_DEV) {
                console.warn("⚠️  Email delivery restricted in dev mode (e.g. testing address required by Resend)");
                const otpMatch = html.match(/font-size:40px[^>]+>(\d{6})</);
                if (otpMatch) {
                    console.log("\n────────────────────────────────────────────");
                    console.log(`📧  DEV OTP for ${to}: ${otpMatch[1]}`);
                    console.log("────────────────────────────────────────────\n");
                }
                return { success: false, error: error.message };
            }
            throw new Error(error.message || "Failed to send email.");
        }

        console.log(`✅ Email sent via Resend to ${to} (Message ID: ${data?.id})`);
        return { success: true, id: data?.id };
    } catch (err) {
        console.error("Email send exception:", err.message);
        if (IS_DEV) {
            console.warn("⚠️  Email delivery error in dev mode — continuing gracefully.");
            return { success: false, error: err.message };
        }
        throw new Error("Failed to send verification email. Please try again.");
    }
};

/**
 * sendSupportEmail
 * Dispatches contact support inquiries to the support mailbox.
 */
const sendSupportEmail = async ({ name, email, subject, message }) => {
    const supportEmail = process.env.SUPPORT_EMAIL || "support@studysync.app";
    const htmlContent = baseTemplate(`
        <h2 style="margin:0 0 8px 0;font-size:22px;font-weight:800;color:#0f172a;">New Support Inquiry</h2>
        <p style="margin:0 0 16px 0;font-size:14px;color:#475569;">
          You have received a new support ticket from <strong>${name}</strong> (&lt;${email}&gt;).
        </p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px;margin:20px 0;">
          <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;">Subject</p>
          <p style="margin:0 0 16px 0;font-size:15px;font-weight:600;color:#0f172a;">${subject}</p>
          <p style="margin:0 0 8px 0;font-size:12px;font-weight:700;color:#0369a1;text-transform:uppercase;">Message</p>
          <p style="margin:0;font-size:14px;color:#334155;line-height:1.6;white-space:pre-wrap;">${message}</p>
        </div>
        <p style="margin:0;font-size:12px;color:#64748b;">Reply directly to this email or reach the user at ${email}.</p>
    `);

    return await sendEmail({ to: supportEmail, subject: `[Support Ticket] ${subject}`, html: htmlContent });
};

module.exports = {
    sendEmailVerificationOTP,
    sendPasswordResetOTP,
    sendSupportEmail,
};

