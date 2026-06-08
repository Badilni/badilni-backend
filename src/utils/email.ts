import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import pug from 'pug';
import { htmlToText } from 'html-to-text';
import { UserDocument } from '../models/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TemplateType =
  | 'verifyEmail.pug'
  | 'resetPassword.pug'
  | 'verifyPendingEmail.pug'
  | 'emailChangedNotification.pug';

const transporter = nodemailer.createTransport({
  host: process.env.BREVO_HOST || 'smtp-relay.brevo.com',
  port: Number(process.env.BREVO_PORT) || 587,
  auth: {
    user: process.env.BREVO_SMTP_LOGIN,
    pass: process.env.BREVO_SMTP_KEY,
  },
});

export class Email {
  to: string;
  from: string;
  firstName: string;
  code?: string;

  constructor(
    user: UserDocument,
    code?: string,
    toEmail?: 'email' | 'pendingEmail' | string,
  ) {
    if (toEmail && toEmail.includes('@')) {
      this.to = toEmail;
    } else {
      this.to = toEmail === 'pendingEmail' ? user.pendingEmail! : user.email;
    }
    this.firstName = user.name.split(' ')[0];
    this.code = code;
    this.from = `"Badilni" <${process.env.EMAIL_FROM}>`;
  }

  async send(template: TemplateType, subject: string) {
    const html = pug.renderFile(
      path.join(__dirname, '..', 'templates', template),
      { firstName: this.firstName, code: this.code },
    );

    const mailOptions = {
      from: this.from,
      to: this.to,
      subject,
      html,
      text: htmlToText(html),
    };

    await transporter.sendMail(mailOptions);
  }

  async sendVerifyEmail() {
    await this.send('verifyEmail.pug', 'Welcome to Badilni!');
  }

  async sendPasswordReset() {
    await this.send(
      'resetPassword.pug',
      'Reset your Badilni password (valid for 10 min)',
    );
  }

  async sendVerifyPendingEmail() {
    await this.send('verifyPendingEmail.pug', 'Verify your new email');
  }

  async sendEmailChangedNotification() {
    await this.send(
      'emailChangedNotification.pug',
      'Your Badilni account email has been updated',
    );
  }
}
