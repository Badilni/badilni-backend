declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';

    readonly DB_USERNAME?: string;
    readonly DB_PASSWORD?: string;
    readonly DB_URI?: string;

    readonly ACCESS_TOKEN_SECRET: string;
    readonly ACCESS_TOKEN_EXPIRES_IN: string;
    readonly ACCESS_TOKEN_COOKIE_EXPIRES_IN: string;

    readonly REFRESH_TOKEN_SECRET: string;
    readonly REFRESH_TOKEN_EXPIRES_IN: string;
    readonly REFRESH_TOKEN_COOKIE_EXPIRES_IN: string;

    readonly BREVO_HOST?: string;
    readonly BREVO_PORT?: string;
    readonly BREVO_SMTP_LOGIN?: string;
    readonly BREVO_SMTP_KEY?: string;

    readonly EMAIL_FROM?: string;
  }
}
