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