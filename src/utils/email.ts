import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST,
  port: parseInt(process.env.EMAIL_PORT || '465'),
  secure: true, 
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendPremiumWelcomeEmail = async (to: string, userName: string, planName: string) => {
  const mailOptions = {
    from: `"CineTube Premium" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Welcome to CineTube Premium! 🍿',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #050505; color: white; padding: 40px; border-radius: 10px;">
        <h1 style="color: #e50914;">Hi ${userName}!</h1>
        <p style="font-size: 18px;">Your payment was successful and you are now a <strong>${planName}</strong> member.</p>
        <div style="background: #111; padding: 20px; border-left: 4px solid #e50914; margin: 20px 0;">
          <p>Unlimited 4K Movies: <strong>Enabled</strong></p>
          <p>Ad-free Experience: <strong>Enabled</strong></p>
        </div>
        <p>Start watching your favorite movies right now!</p>
        <a href="${process.env.CLIENT_URL}/profile" style="background-color: #e50914; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 20px;">Go to My Profile</a>
        <p style="margin-top: 30px; color: #666; font-size: 12px;">If you didn't make this purchase, please contact our support immediately.</p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};

export const sendPasswordResetEmail = async (to: string, userName: string, resetUrl: string) => {
  const mailOptions = {
    from: `"CineTube Support" <${process.env.EMAIL_USER}>`,
    to,
    subject: 'Reset your CineTube password',
    html: `
      <div style="font-family: Arial, sans-serif; background-color: #050505; color: white; padding: 40px; border-radius: 10px;">
        <h1 style="color: #e50914;">Reset your password</h1>
        <p style="font-size: 16px;">Hi ${userName},</p>
        <p style="font-size: 16px; line-height: 1.6;">
          We received a request to reset your CineTube password. Click the button below to choose a new password.
        </p>
        <a
          href="${resetUrl}"
          style="background-color: #e50914; color: white; padding: 12px 25px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block; margin-top: 20px;"
        >
          Reset Password
        </a>
        <p style="margin-top: 24px; font-size: 14px; line-height: 1.6; color: #c9c9c9;">
          This link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
        </p>
        <p style="margin-top: 16px; font-size: 12px; color: #777;">
          If the button does not work, copy and paste this URL into your browser:<br />
          <span style="color: #fff;">${resetUrl}</span>
        </p>
      </div>
    `,
  };

  return transporter.sendMail(mailOptions);
};
