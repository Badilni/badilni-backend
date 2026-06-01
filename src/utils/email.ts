import path from 'path';
import { fileURLToPath } from 'url';
import nodemailer from 'nodemailer';
import pug from 'pug';
import { htmlToText } from 'html-to-text';
import { UserDocument } from '../models/user.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type TemplateType = 'verifyEmail.pug' | 'resetPassword.pug';

export class Email {
  to: string;
  from: string;
  firstName: string;
  code: string;

  constructor(user: UserDocument, code: string) {
    this.to = user.email;
    this.firstName = user.name.split(' ')[0];
    this.code = code;
    this.from = `"Badilni" <${process.env.EMAIL_FROM}>`;
  }

  private createTransport() {
    // if (process.env.NODE_ENV === 'production') {
    //   // Brevo (Production)
    return nodemailer.createTransport({
      host: process.env.BREVO_HOST || 'smtp-relay.brevo.com',
      port: Number(process.env.BREVO_PORT) || 587,
      auth: {
        user: process.env.BREVO_SMTP_LOGIN,
        pass: process.env.BREVO_SMTP_KEY,
      },
    });
    // }

    // Mailtrap (Development)
    // return nodemailer.createTransport({
    //   host: process.env.EMAIL_HOST,
    //   port: process.env.EMAIL_PORT,
    //   auth: {
    //     user: process.env.EMAIL_USERNAME,
    //     pass: process.env.EMAIL_PASSWORD,
    //   },
    // });
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

    await this.createTransport().sendMail(mailOptions);
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
}
