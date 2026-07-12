import path from 'path';
import { fileURLToPath } from 'url';
import pug from 'pug';
import { htmlToText } from 'html-to-text';
import { UserDocument } from '../models/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

type TemplateType =
  | 'verifyEmail.pug'
  | 'resetPassword.pug'
  | 'verifyPendingEmail.pug'
  | 'emailChangedNotification.pug';

export class Email {
  to: string;
  fromEmail: string;
  fromName: string;
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
    this.fromEmail = process.env.EMAIL_FROM!;
    this.fromName = 'Badilni';
  }

  async send(template: TemplateType, subject: string) {
    const html = pug.renderFile(
      path.join(__dirname, '..', 'templates', template),
      { firstName: this.firstName, code: this.code },
    );

    const body = {
      sender: { name: this.fromName, email: this.fromEmail },
      to: [{ email: this.to }],
      subject,
      htmlContent: html,
      textContent: htmlToText(html),
    };

    const response = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': process.env.BREVO_API_KEY!,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Brevo API error ${response.status}: ${errorText}`,
      );
    }
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
