# Repository Guidelines

## Project Structure & Module Organization

This is a Node.js, Express, TypeScript, and MongoDB backend. Source code lives in `src/`; `src/server.ts` starts the server and `src/app.ts` configures Express. Feature code is grouped under `src/modules/<feature>/` with files like `auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`, `auth.schema.ts`, and `auth.types.ts`. Shared Mongoose models live in `src/models/`, helpers in `src/utils/`, middleware in `src/middleware/`, config in `src/config/`, and Pug email templates in `src/templates/`. Do not edit generated `dist/` files.

## Build, Test, and Development Commands

- `npm install`: install dependencies from `package-lock.json`.
- `npm run dev`: run `src/server.ts` locally with `tsx`.
- `npm run dev:watch`: run the development server in watch mode.
- `npm run build`: remove `dist/`, compile TypeScript, and copy Pug templates into `dist/`.
- `npm start`: run the production build from `dist/server.js`.
- `npm run lint`: run ESLint across the repository.
- `npm run lint:fix`: apply ESLint fixes.
- `npm run typecheck`: run TypeScript checking in watch mode.

`npm test` is currently a placeholder that exits with an error; add a real test runner before relying on it.

## Coding Style & Naming Conventions

Use ESM imports and TypeScript. Keep feature files named `<feature>.<role>.ts`, for example `user.service.ts` or `category.schema.ts`. Prefer `const`, avoid `var`, use strict equality, and keep braces on control flow. Prefix unused parameters with `_`. Avoid `any` unless the boundary is genuinely dynamic. Keep route handlers thin and put business logic in services.

## Testing Guidelines

No testing framework is configured yet. When adding tests, colocate them near the code or create a clear `tests/` structure, and name files by feature and behavior, such as `auth.service.test.ts`. Cover service logic, validation schemas, and route behavior for new endpoints. Until tests exist, run `npm run lint` and `npm run build` before opening a PR.

## Commit & Pull Request Guidelines

Recent commits use concise Conventional Commit-style subjects, especially `feat: ...` (example: `feat: add category model`). Use `feat:`, `fix:`, `refactor:`, `perf:`, `test:`, `docs`, or `chore:` and keep the subject specific. Pull requests should include a short description, linked issue when available, config changes, and validation results from `npm run lint` and `npm run build`. For API changes, include affected routes and sample request or response details.

## Security & Configuration Tips

Keep secrets in `.env` and never commit credentials. Required local configuration includes MongoDB, JWT, email, and Cloudinary variables; use `README.md` as the reference. Validate new request payloads with Zod before they reach services or models.

## Project Domain Context

Badilni is a skill barter marketplace. Users exchange skills using Time Credits instead of money — no real currency is involved anywhere in the system.

### Core concepts

- **Provider**: the user delivering a skill in a session, earns credits
- **Receiver**: the user receiving help, spends credits
- **SkillListing**: a skill a provider offers, has an hourly credit rate
- **ServiceRequest**: help a receiver needs, has a fixed credits offered amount
- **Booking**: a session between a provider and receiver, originates from either a SkillListing or ServiceRequest (exactly one, never both)
- **Time Credits**: the only currency. Stored as `walletBalance` and `creditsInEscrow` on the User document

### Credit flow

1. Receiver posts or accepts a booking → `creditsTotal` locked: `walletBalance -= creditsTotal`, `creditsInEscrow += creditsTotal`
2. Both parties confirm session complete → credits transfer: one `session_payment` Transaction document created, `creditsInEscrow -= creditsTotal` on receiver, `walletBalance += creditsTotal` on provider
3. Cancellation after escrow → one `refund` Transaction, credits returned to receiver's `walletBalance`
4. Transaction documents are immutable — never updated after creation

### Booking state machine

```
pending → accepted → completed
pending → declined
accepted → cancelled
accepted → disputed
```

### Key constraints

- A Transaction must always accompany a credit balance change — never update walletBalance without creating a Transaction document in the same MongoDB session
- `creditsTotal` on a Booking is frozen at creation time — never recalculated
- `receiverConfirmed` and `providerConfirmed` both being true triggers credit release
- Categories are a standalone collection, not an enum — always reference by `categoryId`
- Tags are always in English regardless of listing language

### Module structure

Each feature maps to a module: `auth`, `user`, `category`, `skillListing`, `serviceRequest`, `booking`, `transaction`, `review`, `notification`, `match`, `message`, `admin`
