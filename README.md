# Badilni Backend

> **A skill-barter marketplace API where people exchange expertise using Time Credits — no real money, no friction.**  
> Badilni connects providers who offer skills with receivers who need help, powering the exchange through an escrow-backed credit economy, AI-driven matchmaking, real-time messaging, and a full booking lifecycle — all served over a RESTful API with Socket.io.

---

## Table of Contents

1. [Architecture & Tech Stack](#architecture--tech-stack)
2. [Key Features](#key-features)
3. [Project Directory Structure](#project-directory-structure)
4. [API Endpoint Overview](#api-endpoint-overview)
5. [Prerequisites & Environment Setup](#prerequisites--environment-setup)
6. [Installation & Local Development](#installation--local-development)
7. [System Workflows & Integrations](#system-workflows--integrations)
8. [Scripts Reference](#scripts-reference)

---

## Architecture & Tech Stack

### Backend Framework

| Layer                | Technology                                 |
| -------------------- | ------------------------------------------ |
| Runtime              | Node.js (ESM, `"type": "module"`)          |
| Framework            | Express 5                                  |
| Language             | TypeScript 6 (strict, compiled to `dist/`) |
| Process runner (dev) | `tsx` / `tsx watch`                        |

### Database & ODM

| Layer          | Technology                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Database       | MongoDB (Atlas recommended — vector search required)                                                       |
| ODM            | Mongoose 9                                                                                                 |
| Data modelling | Discriminator pattern (`Listing` base → `SkillListing` / `ServiceRequest` subtypes)                        |
| Indexing       | Compound indexes on every hot query path; TTL index for unverified users (24 h) and expired refresh tokens |

### Auth & Security

| Layer                       | Technology                                                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------- |
| Authentication              | JWT — short-lived **access token** (Bearer header) + long-lived **refresh token** (HttpOnly cookie) |
| Password hashing            | bcrypt                                                                                              |
| Per-operation rate limiting | `express-rate-limit` (keyed by IP + userId + email)                                                 |
| HTTP hardening              | Helmet, CORS allow-list, `express-mongo-sanitize`                                                   |
| Input validation            | Zod schemas on every route (body, params, query)                                                    |

### AI & Integrations

| Layer                | Technology                                                                                                                 |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| AI provider          | Google Gemini (`@google/genai`)                                                                                            |
| Embeddings           | `gemini-embedding-001` — 768-dimensional vectors, stored on `Listing.embedding`                                            |
| Vector search        | MongoDB Atlas Vector Search (kNN via `$vectorSearch` aggregation)                                                          |
| LLM reranking        | Gemini Flash models with automatic fallback chain (`gemini-3.1-flash-lite` → `gemini-2.5-flash-lite` → `gemini-2.5-flash`) |
| Auto-tagging         | Gemini Flash — bilingual (Arabic/English) tag generation on listing create/update                                          |
| Review summarization | Gemini Flash — generates a 2–3 sentence reputation summary per user                                                        |
| File storage         | Cloudinary v2 (avatar, sample work, booking attachments, reference images)                                                 |
| Transactional email  | Brevo (Sendinblue) REST API — Pug templates for verify/reset/email-change flows                                            |
| Real-time            | Socket.io 4 — user rooms, typing indicators, live notifications & messages                                                 |

### Utilities & Tooling

| Tool                       | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| Zod                        | Schema-first request validation                                       |
| `node-cron`                | Three scheduled background jobs                                       |
| `slugify`                  | Category slug generation                                              |
| `morgan`                   | HTTP request logging (`dev` in development, `combined` in production) |
| ESLint + typescript-eslint | Linting                                                               |
| `rimraf` + `copyfiles`     | Build pipeline (clean → compile → copy Pug templates)                 |

### Architectural Patterns

- **Modular MVC**: each feature lives in `src/modules/<feature>/` with dedicated controller, service, routes, schema, and types files. Controllers are thin; all business logic is in services.
- **DB Factory utilities** (`src/utils/dbFactory.ts`): reusable `findDocumentOrThrow`, `updateDocumentOrThrow`, `deleteDocumentOrThrow`, and `buildOwnerScopedFilter` helpers eliminate repetitive Mongoose boilerplate and enforce ownership rules consistently.
- **Custom `AppError`** + global error handler: operational vs. programming errors separated; Mongoose validation errors, JWT errors, and cast errors are all normalized into consistent JSON responses.
- **`asyncHandler` wrapper**: eliminates try/catch boilerplate from every controller, forwarding rejections to Express's error pipeline.
- **Immutable Transaction documents**: a Mongoose `pre('save')` hook throws if any code attempts to update an existing Transaction, ensuring ledger integrity.
- **Atomic escrow operations**: all credit balance changes run inside MongoDB sessions to guarantee consistency between `walletBalance`, `creditsInEscrow`, and the `Transaction` audit record.

---

## Key Features

### Skill Marketplace & Bartering

- **Skill Listings**: providers publish what they offer, with an hourly Time Credit rate (1–20 credits/hr), availability notes, and up to 5 Cloudinary-hosted sample work images.
- **Service Requests**: receivers post what they need, with a fixed `creditsOffered` amount and up to 5 reference images.
- Both listing types share a base `Listing` discriminator model, enabling unified search, tagging, and embedding pipelines.
- Full CRUD for both types with ownership enforcement; admins bypass ownership checks.

### AI-Powered Discovery

- **Smart Search**: natural language queries against skill listings via `$vectorSearch` (MongoDB Atlas), followed by a Gemini reranker that scores and re-orders candidates by semantic relevance.
- **Atlas Full-text Search** (`atlasSearch`): keyword-based fallback for standard queries.
- **Auto-tagging**: on every create or update, Gemini generates 4–8 bilingual tags (Arabic + English) asynchronously and patches the listing — tags never block the HTTP response.
- **AI-generated Review Summaries**: `GET /api/v1/users/:userId/review-summary` calls Gemini to produce a short reputation paragraph from all reviews, language-matched to the review corpus.

### AI Matchmaker

- A `node-cron` job runs on a schedule and also triggers on-demand when a service request is created or updated.
- Flow: embed the request text → `$vectorSearch` up to 100 candidate SkillListings → filter out own listings and already-matched pairs → Gemini reranks and provides a human-readable `aiReasoning` → save `Match` documents and fire real-time notifications to both parties.
- Duplicate matches are idempotently skipped via a unique compound index on `(listing, request)`.

### Time Credit Economy & Escrow

- Users hold a `walletBalance` and a `creditsInEscrow` (frozen funds) on their `User` document.
- On booking acceptance: `creditsTotal` is locked into escrow atomically.
- On dual confirmation: escrow releases to provider, a `session_payment` Transaction is created.
- On cancellation after escrow: funds are refunded to receiver's wallet, a `refund` Transaction is created.
- Transaction documents are **immutable** — they can never be updated after creation, acting as an append-only audit ledger.
- Admin credit adjustment endpoint for manual balance corrections.

### Booking Lifecycle

- **State machine**: `pending → accepted → completed`, `pending → declined`, `accepted → cancelled`, `accepted → disputed`.
- Validated with both a friendly pre-check and an atomic `findOneAndUpdate` filter for race-condition safety.
- Each booking has its own **per-booking chat thread** (messages, attachments, read receipts).
- Providers can attach a meeting link; receivers and providers each confirm session completion independently — dual confirmation triggers credit release.
- Admins can resolve disputed bookings and choose payout direction.

### Real-time Messaging

- **Conversation inbox**: general user-to-user conversations, separate from booking-specific threads.
- **Socket.io rooms**: each authenticated user joins their own room (`socket.join(userId)`) — messages and notifications are pushed via `emitToUser`.
- Typing indicators (`typing:start` / `typing:stop`) broadcast to the recipient.
- Unread counts tracked per conversation and per booking thread.

### Reviews & Reputation

- Reviews are polymorphically attachable to users, skill listings, service requests, or bookings (via `mergeParams` router nesting).
- `averageRating` and `totalBookings` are maintained on `SkillListing`; `averageRating` and `totalSessionsCompleted` on `User`.
- AI-generated reputation summaries on demand.

### Notifications

- In-app notification documents with `isRead` flag, push via Socket.io on creation.
- Event-driven notifications for: booking requests, acceptance, decline, cancellation, session completion, meeting link added, credit release/refund, AI match found.
- Admin broadcast endpoint to send a notification to any user.

### Background Jobs

| Job                   | Purpose                                                       |
| --------------------- | ------------------------------------------------------------- |
| `booking.cron`        | Auto-cancel accepted bookings whose session window has passed |
| `serviceRequest.cron` | Auto-expire open service requests past their deadline         |
| `matchmaker.cron`     | Run AI matching for all open service requests                 |

### Admin Panel Support

- Full user management (create, update, deactivate, delete with avatar).
- Admin-only booking views: stats, by-status breakdown, disputes, credit flow, full booking list.
- Admin action audit log (`AdminAction` model + `/api/v1/admin-actions`).
- Category management (CRUD, admin-only write operations).
- Admin transaction view and manual credit adjustments.

---

## Project Directory Structure

```
badilni-backend/
├── src/
│   ├── app.ts                  # Express app setup — middleware stack, route mounting
│   ├── server.ts               # Entry point — DB connect, HTTP server, Socket.io init, cron start
│   │
│   ├── config/
│   │   └── config.ts           # dotenv bootstrap
│   │
│   ├── modules/                # Feature modules (controller · service · routes · schema · types)
│   │   ├── auth/               # Signup, login, logout, refresh, password reset, email change
│   │   ├── user/               # User CRUD, avatar, self-management, admin operations
│   │   ├── category/           # Skill categories (admin-managed)
│   │   ├── skillListing/       # Provider skill offers — smart search, AI tagging, embeddings
│   │   ├── serviceRequest/     # Receiver help requests — triggers matchmaker on create/update
│   │   ├── booking/            # Session lifecycle, escrow, confirmation, dispute, admin panel
│   │   ├── transaction/        # Immutable credit ledger, wallet history, admin adjustment
│   │   ├── review/             # Polymorphic reviews on users, listings, requests, bookings
│   │   ├── notification/       # In-app notifications with Socket.io push
│   │   ├── match/              # AI-generated listing↔request matches
│   │   ├── message/            # Conversation inbox + per-booking chat threads
│   │   └── adminAction/        # Admin audit log
│   │
│   ├── models/                 # Shared Mongoose models (referenced across modules)
│   │   ├── listing.model.ts    # Base discriminator model (Listing)
│   │   ├── skillListing.model.ts   # SkillListing discriminator
│   │   ├── serviceRequest.model.ts # ServiceRequest discriminator
│   │   ├── user.model.ts       # User — wallet, escrow, codes, bcrypt hooks
│   │   ├── booking.model.ts    # Booking — state, escrow fields, indexes
│   │   ├── transaction.model.ts# Immutable credit ledger entries
│   │   ├── match.model.ts      # AI matchmaker results with score and reasoning
│   │   ├── conversation.model.ts
│   │   ├── message.model.ts
│   │   ├── notification.model.ts
│   │   ├── review.model.ts
│   │   ├── refreshToken.model.ts  # Hashed refresh tokens with TTL
│   │   ├── category.model.ts
│   │   └── adminAction.model.ts
│   │
│   ├── services/
│   │   ├── email.service.ts    # Brevo REST API — Pug template rendering and dispatch
│   │   ├── cloudinary.service.ts # Image upload / delete helpers
│   │   └── ai/
│   │       ├── embedding.service.ts          # Gemini embedding-001, 768-dim, with retry on 503
│   │       ├── tagger.service.ts             # Bilingual tag generation (Gemini Flash)
│   │       ├── reranker.service.ts           # Smart search reranker (Gemini Flash)
│   │       ├── matchmakerReranker.service.ts # AI match scoring with reasoning
│   │       ├── smartSearchReranker.service.ts
│   │       ├── reviewSummary.service.ts      # Reputation summary generation
│   │       └── geminiFallback.service.ts     # Model fallback chain runner
│   │
│   ├── middleware/
│   │   ├── auth.ts             # protect (JWT verify) + restrictTo (role guard)
│   │   ├── errorHandler.ts     # Global error handler — normalizes all error types
│   │   ├── rateLimit.ts        # Per-operation rate limiters (keyed by IP+userId+email)
│   │   ├── upload.ts           # Multer configuration (memory storage)
│   │   ├── validate.ts         # Zod body/params/query validation middleware
│   │   └── normalizeFilter.ts  # Inject user/listing/booking filter from route params
│   │
│   ├── utils/
│   │   ├── appError.ts         # Custom AppError class (message + statusCode)
│   │   ├── asyncHandler.ts     # try/catch wrapper for async route handlers
│   │   ├── dbFactory.ts        # Reusable CRUD helpers with ownership enforcement
│   │   ├── apiFeatures.ts      # Filter, sort, field-select, paginate builder
│   │   ├── listingSearchFeatures.ts # Aggregation pipeline builder (vector + atlas search)
│   │   ├── paginateInMemory.ts # In-memory paginator (used after AI rerank)
│   │   ├── common.schema.ts    # Shared Zod schemas (pagination, field selection, ObjectId)
│   │   └── validationError.ts  # Zod -> AppError formatter
│   │
│   ├── socket/
│   │   └── socket.ts           # Socket.io init, JWT auth middleware, room management
│   │
│   ├── jobs/
│   │   ├── booking.cron.ts     # Auto-cancel stale accepted bookings
│   │   ├── serviceRequest.cron.ts # Auto-expire open requests
│   │   └── matchmaker.cron.ts  # Periodic AI matchmaking for all open requests
│   │
│   ├── templates/              # Pug email templates
│   │   ├── verifyEmail.pug
│   │   ├── resetPassword.pug
│   │   ├── verifyPendingEmail.pug
│   │   └── emailChangedNotification.pug
│   │
│   ├── seeders/
│   │   └── category.seeder.ts  # Seed initial categories
│   │
│   └── types/                  # Global TypeScript augmentations (e.g., Express Request)
│
├── dist/                       # Compiled output (git-ignored)
├── .env                        # Local secrets (never commit)
├── package.json
└── tsconfig.json
```

---

## API Endpoint Overview

All routes are prefixed with `/api/v1`. The table below is a high-level domain map. For complete request/response schemas, query parameters, and example payloads, refer to the live API documentation.

> [!NOTE]
> **📖 Full API Documentation** — detailed request/response schemas, query parameters, and example payloads are maintained in Apidog. See the live docs at: [https://o3kxqoynyc.apidog.io](https://o3kxqoynyc.apidog.io)

| Domain               | Base Route                 | Primary Purpose                                                                                          | Access                 |
| -------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------- | ---------------------- |
| **Authentication**   | `/api/v1/auth`             | Signup, login, logout, email verification, password reset, token refresh, email change                   | Public / 🔒            |
| **Users**            | `/api/v1/users`            | Profile management (self + admin), avatar upload, AI review summary                                      | Public / 🔒 / 🛡️ Admin |
| **Categories**       | `/api/v1/categories`       | Skill category taxonomy — read by all, write by admins only                                              | Public / 🛡️ Admin      |
| **Skill Listings**   | `/api/v1/skill-listings`   | Provider skill offers — smart search (vector + AI rerank), full-text search, CRUD, nested reviews        | Public / 🔒            |
| **Service Requests** | `/api/v1/service-requests` | Receiver help requests — triggers AI matchmaker on create/update, CRUD                                   | Public / 🔒            |
| **Bookings**         | `/api/v1/bookings`         | Full session lifecycle: create, accept/decline, confirm, dispute, cancel, meeting link, per-booking chat | 🔒                     |
| **Admin Bookings**   | `/api/v1/admin/bookings`   | Admin views: stats, by-status, disputes, credit flow, overview, dispute resolution                       | 🛡️ Admin               |
| **Transactions**     | `/api/v1/transactions`     | Immutable credit ledger — wallet history, balance, admin view, manual adjustment                         | 🔒 / 🛡️ Admin          |
| **Reviews**          | `/api/v1/reviews`          | Polymorphic reviews — nestable under users, listings, requests, or bookings                              | Public / 🔒 / 🛡️ Admin |
| **Conversations**    | `/api/v1/conversations`    | User-to-user inbox, message send/fetch, unread counts, read receipts                                     | 🔒                     |
| **AI Matches**       | `/api/v1/matches`          | AI-generated listing↔request match results with scores and Gemini reasoning                              | 🔒                     |
| **Notifications**    | `/api/v1/notifications`    | In-app notifications — list, read, delete, admin broadcast                                               | 🔒 / 🛡️ Admin          |
| **Admin Actions**    | `/api/v1/admin-actions`    | Append-only admin audit log                                                                              | 🛡️ Admin               |

---

## Prerequisites & Environment Setup

### Runtime Requirements

| Requirement     | Version                                                                                     |
| --------------- | ------------------------------------------------------------------------------------------- |
| Node.js         | `>= 24` (matches `@tsconfig/node24`)                                                        |
| MongoDB         | Atlas cluster with **Vector Search** index enabled on `listings.embedding` (768 dimensions) |
| Package manager | npm                                                                                         |

### Environment Variables

Create a `.env` file in the project root:

```env
# --- Application ---
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:4200

# --- Database ---
DB_URI=mongodb+srv://<db_username>:<db_password>@cluster0.xxxxx.mongodb.net/badilni?retryWrites=true&w=majority
DB_USERNAME=your_db_username
DB_PASSWORD=your_db_password

# --- JWT Authentication ---
ACCESS_TOKEN_SECRET=a_long_random_secret_for_access_tokens
ACCESS_TOKEN_EXPIRES_IN=15m

REFRESH_TOKEN_SECRET=a_different_long_random_secret_for_refresh_tokens
REFRESH_TOKEN_EXPIRES_IN=30

# --- Brevo (Transactional Email) ---
BREVO_API_KEY=your_brevo_api_key
EMAIL_FROM=noreply@yourdomain.com

# --- Cloudinary (Image Storage) ---
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# --- Google Gemini AI ---
GEMINI_API_KEY=your_gemini_api_key
```

> [!WARNING]
> **MongoDB Atlas Vector Search Index — Required for AI Features**
>
> The smart search, AI matchmaker, and embedding pipeline all depend on a MongoDB Atlas Vector Search index. Without it, any request using `smartSearch` will return empty results and the matchmaker cron job will produce no matches.
>
> **Create the index before starting the server:**
>
> - **Collection**: `listings`
> - **Index name**: `listing_vector_index`
> - **Field**: `embedding`
> - **Dimensions**: `768`
> - **Similarity**: `cosine`
>
> Configure this via the MongoDB Atlas UI under **Search → Create Search Index → JSON Editor**, or via the Atlas CLI.

---

## Installation & Local Development

### 1. Clone & Install

```bash
git clone https://github.com/Badilni/badilni-backend.git
cd badilni-backend
npm install
```

### 2. Configure Environment

Copy the `.env` template above into a new `.env` file and fill in all values.

### 3. (Optional) Seed Categories

```bash
npx tsx src/seeders/category.seeder.ts
```

### 4. Run in Development Mode

```bash
# Single run
npm run dev

# Watch mode (restarts on file changes)
npm run dev:watch
```

The server will start on `http://localhost:3000` (or the `PORT` value in your `.env`).

### 5. Build for Production

```bash
npm run build
```

This command removes `dist/`, compiles TypeScript, then copies Pug templates into `dist/templates/`.

### 6. Start Production Server

```bash
npm start
```

---

## System Workflows & Integrations

### JWT Authentication & Refresh Flow

1. **Sign up** → user document created (unverified), verification code emailed via Brevo.
2. **Verify email** → `isVerified: true`; access token (short-lived, Bearer) and refresh token (long-lived, HttpOnly cookie) are issued.
3. **Login** → same token pair issued.
4. **Refresh** → client sends `POST /api/v1/auth/refresh` with the cookie; server validates the hashed token, deletes it, and issues a fresh pair (token rotation).
5. **Logout** → refresh token deleted from DB; both cookies cleared.
6. **Password change** → all tokens implicitly invalidated because `passwordChangedAt` is updated and `protect` middleware checks `changedPasswordAfter(iat)`.

### Transactional Credit Flow

```
Booking created (pending)
  └─ Receiver's walletBalance unchanged (no escrow yet)

Provider accepts booking
  └─ lockEscrow()
      ├─ receiver.walletBalance   -= creditsTotal
      ├─ receiver.creditsInEscrow += creditsTotal
      └─ Transaction { type: 'escrow_lock' } created

Both parties confirm session
  └─ releaseEscrow()
      ├─ receiver.creditsInEscrow -= creditsTotal
      ├─ provider.walletBalance   += creditsTotal
      └─ Transaction { type: 'session_payment' } created

Cancellation after escrow
  └─ refundEscrow()
      ├─ receiver.creditsInEscrow -= creditsTotal
      ├─ receiver.walletBalance   += creditsTotal
      └─ Transaction { type: 'refund' } created
```

All balance mutations run inside a MongoDB session. Transaction documents have a `pre('save')` immutability guard.

### AI Matchmaking Pipeline

```
ServiceRequest created / updated
  │
  ├─ Build query text from title + description + category name
  ├─ embedQuery()  →  768-dim vector (gemini-embedding-001)
  ├─ $vectorSearch  →  up to 100 SkillListing candidates
  ├─ Filter: exclude receiver's own listings + already-matched pairs
  ├─ rerankMatchCandidates()  →  Gemini Flash scores each candidate (0-1)
  │    └─ Returns { rerankScore, rerankReason } per candidate
  ├─ saveMatches()  →  Match documents created (unique index prevents duplicates)
  └─ notifyAiMatch()  →  Socket.io push to both provider and receiver
```

### Listing Smart Search Pipeline

```
GET /api/v1/skill-listings?smartSearch=<query>
  │
  ├─ embedQuery()  →  768-dim vector
  ├─ $vectorSearch  →  top candidates (Atlas kNN)
  ├─ Filter by type, category, isActive, etc.
  ├─ Lookup user + category (populated)
  ├─ rerankSmartSearchCandidates()  →  Gemini Flash re-scores by relevance
  └─ paginateInMemory()  →  paginated JSON response
```

Standard searches use `$search` (Atlas full-text) with the same filter/sort/paginate pipeline.

### AI Auto-Tagging

On every listing create or update, tag and embedding generation run **fire-and-forget** (non-blocking):

1. `generateTagsFromAI()` calls Gemini Flash with a bilingual system prompt. Tags are validated, sanitized, and stored (4–8 tags, URL-safe, max 30 chars).
2. `embedDocument()` calls `gemini-embedding-001` and stores the 768-dim vector on `listing.embedding` for future vector searches.

---

## Scripts Reference

| Script      | Command                               | Description                               |
| ----------- | ------------------------------------- | ----------------------------------------- |
| `dev`       | `tsx src/server.ts`                   | Start the development server (single run) |
| `dev:watch` | `tsx watch src/server.ts`             | Start with file watching / hot reload     |
| `build`     | `rimraf dist && tsc && copyfiles ...` | Full production build                     |
| `start`     | `node dist/server.js`                 | Run the compiled production build         |
| `clean`     | `rimraf dist`                         | Remove the `dist/` directory              |
| `typecheck` | `tsc --noEmit --watch`                | TypeScript type checking in watch mode    |
| `lint`      | `eslint .`                            | Run ESLint across all source files        |
| `lint:fix`  | `eslint . --fix`                      | Auto-fix ESLint violations                |
| `test`      | _(placeholder)_                       | No test runner configured yet             |

> Before opening a pull request, always run `npm run lint` and `npm run build` to verify the codebase compiles cleanly.
