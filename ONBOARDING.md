# MilestoFund — Developer Onboarding Guide

> A full-stack crowdfunding platform for Indian creators. Built with React, Node/Express, Supabase (PostgreSQL), Razorpay payments, and Gemini AI.

---

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [Folder & File Structure](#2-folder--file-structure)
3. [How Frontend, Backend & Database Connect](#3-how-frontend-backend--database-connect)
4. [How Razorpay Payment Integration Works](#4-how-razorpay-payment-integration-works)
5. [How the Gemini AI Feature Works](#5-how-the-gemini-ai-feature-works)
6. [New Developer Reading Order](#6-new-developer-reading-order)

---

## 1. Tech Stack Overview

### Frontend
| Layer | Technology |
|---|---|
| Framework | React 18 (Vite) |
| Routing | React Router DOM v6 |
| Styling | Tailwind CSS v3 + tailwindcss-animate |
| UI Components | Radix UI primitives (Dialog, Tabs, Progress, etc.) |
| Icons | lucide-react |
| Charts | Recharts (admin dashboard) |
| HTTP client | Axios (with interceptors for auth + auto-logout) |
| State | React Context API (`AuthContext`, `ThemeContext`) |

### Backend
| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Framework | Express 4 |
| Auth | JWT (`jsonwebtoken`) + bcryptjs for password hashing |
| Database client | `@supabase/supabase-js` v2 |
| Payments | `razorpay` npm SDK + HMAC-SHA256 signature verification |
| AI | Google Gemini 2.5 Flash (direct REST `fetch`, no SDK) |
| Email | Nodemailer |
| Validation | express-validator |
| Logging | morgan |
| Dev server | nodemon |

### Database
- **Supabase** (hosted PostgreSQL) — accessed via two client instances:
  - `supabase` — anon/public key (RLS-aware)
  - `supabaseAdmin` — service-role key (bypasses RLS; server-side only)

### Required Environment Variables (backend `.env`)
```
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
JWT_EXPIRES_IN=7d
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
GEMINI_API_KEY=
CLIENT_URL=http://localhost:5173
PORT=5000
```

---

## 2. Folder & File Structure

```
MilestoFund-CrowFund-main/
├── backend/
│   ├── server.js                  ← Express app entry point; wires middleware + routes
│   ├── package.json
│   ├── config/
│   │   ├── db.js                  ← Creates supabase + supabaseAdmin clients
│   │   ├── schema.sql             ← Full DB schema — run once in Supabase SQL Editor
│   │   └── notifications.sql     ← Notifications table schema (run separately)
│   ├── routes/
│   │   ├── authRoutes.js          ← /api/auth/*
│   │   ├── projectRoutes.js       ← /api/projects/*
│   │   ├── paymentRoutes.js       ← /api/payments/*
│   │   ├── userRoutes.js          ← /api/users/*
│   │   ├── aiRoutes.js            ← /api/ai/*
│   │   ├── adminRoutes.js         ← /api/admin/*
│   │   └── notificationRoutes.js  ← /api/notifications/*
│   ├── controllers/
│   │   ├── authController.js      ← Register, login, profile, password change
│   │   ├── projectController.js   ← CRUD, comments, updates, save, impact report
│   │   ├── paymentController.js   ← Razorpay order creation + verification
│   │   ├── aiController.js        ← Gemini AI proxy (5 tools)
│   │   ├── userController.js      ← Dashboard, profile, saved projects
│   │   ├── adminController.js     ← Stats, user/project/transaction management
│   │   └── notificationController.js ← In-app notification CRUD
│   ├── models/
│   │   ├── User.js                ← User DB operations (bcrypt, supabaseAdmin)
│   │   ├── Project.js             ← Project CRUD + milestone checking
│   │   └── Contribution.js        ← Payment record + amount_raised update
│   ├── middleware/
│   │   ├── auth.js                ← protect / optionalAuth / adminOnly guards
│   │   ├── error.js               ← Global 404 + error handler
│   │   └── validate.js            ← express-validator result checker
│   └── utils/
│       ├── jwt.js                 ← signToken / verifyToken helpers
│       ├── response.js            ← sendSuccess / sendError helpers
│       ├── emailService.js        ← Nodemailer + email templates
│       └── notificationService.js ← Insert in-app notifications via supabaseAdmin
│
└── frontend/
    ├── index.html
    ├── vite.config.js             ← Dev proxy: /api → http://localhost:5000
    ├── tailwind.config.js
    └── src/
        ├── main.jsx               ← React entry; renders <App />
        ├── App.jsx                ← BrowserRouter, ThemeProvider, AuthProvider, all routes
        ├── index.css              ← Tailwind base + CSS custom properties (theme tokens)
        ├── services/
        │   └── api.js             ← Axios instance + all service functions (one file)
        ├── context/
        │   ├── AuthContext.jsx    ← Global auth state (user, login, logout, isLoggedIn)
        │   └── ThemeContext.jsx   ← Dark/light mode toggle
        ├── hooks/
        │   └── useToast.js        ← Toast notification hook
        ├── pages/
        │   ├── HomePage.jsx       ← Landing page (featured + recommended projects)
        │   ├── DiscoverPage.jsx   ← Browse/filter all projects
        │   ├── ProjectDetailPage.jsx ← Full project view + Razorpay payment trigger
        │   ├── CreateProjectPage.jsx ← Multi-step project creation form
        │   ├── EditProjectPage.jsx
        │   ├── DashboardPage.jsx  ← Creator dashboard (stats, projects, contributions)
        │   ├── AIAssistantPage.jsx ← Gemini AI tool UI (5 tools)
        │   ├── AuthPages.jsx      ← Login + Register forms
        │   ├── SettingsPage.jsx
        │   ├── NotificationsPage.jsx
        │   └── OtherPages.jsx     ← PaymentSuccess, Profile, Saved, NotFound
        ├── components/
        │   ├── Navbar.jsx
        │   ├── Footer.jsx
        │   ├── ProjectCard.jsx    ← Reusable card shown in Discover + Home
        │   ├── NotificationBell.jsx
        │   ├── ProjectWidgets.jsx
        │   ├── Loader.jsx
        │   ├── PWAInstallPrompt.jsx
        │   └── ui/                ← Primitive UI: button, card, toast, index barrel
        ├── admin/
        │   ├── AdminRoute.jsx     ← Role guard: redirects non-admins
        │   ├── AdminLayout.jsx    ← Admin sidebar layout (uses React Router Outlet)
        │   └── pages/
        │       ├── AdminDashboard.jsx
        │       ├── AdminUsers.jsx
        │       ├── AdminProjects.jsx
        │       ├── AdminTransactions.jsx
        │       └── AdminActivity.jsx
        └── utils/
            ├── cn.js              ← clsx + tailwind-merge helper
            └── format.js          ← Currency, date, number formatters
```

---

## 3. How Frontend, Backend & Database Connect

### Request Flow (happy path)

```
Browser (React)
  → api.js (Axios, baseURL = /api)
    → Vite dev proxy (/api → http://localhost:5000)
      → Express (server.js)
        → Route file (e.g. projectRoutes.js)
          → Middleware: protect (JWT verify → supabaseAdmin lookup)
            → Controller (e.g. projectController.js)
              → Model (e.g. Project.js)
                → supabaseAdmin.from("projects")...
                  → Supabase (PostgreSQL hosted)
```

### Auth Token Lifecycle

1. User submits login form → `POST /api/auth/login`
2. `authController.login` verifies bcrypt hash, calls `signToken(user.id)` → returns JWT
3. Frontend `AuthContext.login()` stores token in `localStorage.setItem("token", ...)`
4. `api.js` request interceptor reads `localStorage.getItem("token")` and adds `Authorization: Bearer <token>` header on every request
5. `protect` middleware on any protected route calls `verifyToken()` (JWT decode), then re-fetches the user row from `supabaseAdmin` to ensure the account still exists and attach it as `req.user`
6. If a 401 is returned, the `api.js` response interceptor automatically clears the token and redirects to `/login`

### Two Supabase Clients

| Client | Key used | Purpose |
|---|---|---|
| `supabase` | `SUPABASE_ANON_KEY` | RLS-aware; safe to use for read-only public data |
| `supabaseAdmin` | `SUPABASE_SERVICE_ROLE_KEY` | Bypasses RLS; used for all writes and protected reads. **Never expose this key to the frontend.** |

### Database Tables at a Glance

| Table | Purpose |
|---|---|
| `users` | Accounts; `role` = `'user'` or `'admin'` |
| `projects` | Campaign records with `status`, `goal_amount`, `amount_raised` |
| `rewards` | Backer reward tiers linked to a project |
| `milestones` | Funding targets (percentage-based); auto-checked after each payment |
| `contributions` | One row per successful payment; stores Razorpay IDs |
| `comments` | Project discussion thread |
| `project_updates` | Creator progress posts |
| `saved_projects` | User bookmark junction table |
| `notifications` | In-app notification feed (defined in `notifications.sql`) |

---

## 4. How Razorpay Payment Integration Works

The flow has two distinct steps: **order creation** and **payment verification**.

### Step 1 — Create Order (`POST /api/payments/create-order`)

```
Frontend (ProjectDetailPage)
  → paymentService.createOrder({ projectId, amount })
    → paymentController.createOrder
      1. Validate projectId + amount ≥ ₹1
      2. Fetch project from Supabase (checks deadline hasn't passed)
      3. Call getRazorpay() — lazy-initialises Razorpay SDK with env keys
         If keys are missing/placeholder → return mock order (keyId: null)
      4. rz.orders.create({ amount: paise, currency: "INR", ... })
      5. Return { orderId, amount, currency, keyId, projectTitle, ... }
```

### Step 2 — Frontend opens Razorpay Checkout popup

```javascript
// Triggered in ProjectDetailPage after a successful createOrder response
const rzp = new window.Razorpay({
  key:    orderId.keyId,
  amount: orderId.amount,
  order_id: orderId.orderId,
  handler: (response) => {
    // response contains razorpay_order_id, razorpay_payment_id, razorpay_signature
    paymentService.verify({ ...response, projectId, amountINR })
  }
});
rzp.open();
```

> The Razorpay JS checkout script (`https://checkout.razorpay.com/v1/checkout.js`) is loaded via a `<script>` tag in `index.html`.

### Step 3 — Verify Signature (`POST /api/payments/verify`)

```
paymentController.verifyPayment
  1. If NOT mock: verify HMAC-SHA256 signature
     expected = HMAC(keySecret, orderId + "|" + paymentId)
     Reject if signature doesn't match (prevents spoofing)
  2. Contribution.processPayment(...)
     → INSERT into contributions
     → UPDATE projects SET amount_raised = amount_raised + X
     → UPDATE users SET total_backed = total_backed + X (backer)
     → UPDATE users SET total_raised = total_raised + X (creator)
  3. Project.checkMilestones(projectId) — mark milestones as reached
  4. Fire-and-forget:
     → Send receipt email to backer (Nodemailer)
     → Send new-backer email to creator
     → Insert in-app notifications for both backer and creator
```

### Mock Mode (no Razorpay keys)

When `RAZORPAY_KEY_ID` is not set or contains a placeholder, `createOrder` returns `mock: true` and `keyId: null`. The frontend skips the popup and calls `verify` directly with a `mock_order_id`. This lets the full contribution flow run locally without a real Razorpay account.

---

## 5. How the Gemini AI Feature Works

The AI assistant is a **server-side proxy** — the `GEMINI_API_KEY` never reaches the browser.

### Architecture

```
Frontend: AIAssistantPage
  → aiService.generate(tool, inputs)          (POST /api/ai/generate)
    → aiRoutes.js: protect + express-validator
      → aiController.generate
        1. Identify tool (description | title | rewards | pitch | risks)
        2. buildPrompt(tool, inputs) → constructs a detailed text prompt
        3. fetch(GEMINI_URL + "?key=" + GEMINI_API_KEY, { method:"POST", body: ... })
           Model: gemini-2.5-flash
           Config: maxOutputTokens:8192, temperature:0.7, topP:0.95
        4. Collect all content parts (Gemini can return multiple parts)
        5. Return { success: true, result: "..." }
```

### The 5 AI Tools

| Tool ID | What it generates | Key inputs |
|---|---|---|
| `description` | 3–4 paragraph campaign description | title, category, summary, audience, features |
| `title` | 5 catchy campaign title options | concept, category, audience |
| `rewards` | 4 backer reward tier suggestions (₹ amounts) | title, category, goal, description |
| `pitch` | Improved version of a draft pitch | pitch (raw text) |
| `risks` | Top 4–5 risks + mitigation strategies | title, category, description |

### System Prompt Context

Every request is prefaced with a system instruction that frames the AI as an **Indian crowdfunding consultant**, tells it to use ₹ for currency, and instructs it to always produce complete responses.

### Apply to Campaign Flow

After AI generates a result, the user can click **"Apply to Campaign →"**:
1. `sessionStorage.setItem("ai_apply_field", fieldMap[tool])` — maps tool to form field name
2. `sessionStorage.setItem("ai_apply_value", result)` — stores the text
3. Navigates to `/create`; `CreateProjectPage` reads these keys on mount and pre-fills the relevant field

---

## 6. New Developer Reading Order

Read files in this sequence to build understanding from the ground up:

| # | File | Why |
|---|---|---|
| 1 | `backend/config/schema.sql` | Understand all database tables and relationships first |
| 2 | `backend/config/db.js` | See how Supabase clients are created and what env vars are needed |
| 3 | `backend/server.js` | The app entry point — see all routes mounted and middleware applied |
| 4 | `backend/middleware/auth.js` | Understand `protect` / `optionalAuth` / `adminOnly` before reading controllers |
| 5 | `backend/utils/jwt.js` + `utils/response.js` | Tiny but used everywhere |
| 6 | `backend/models/User.js` | See the pattern: model = object of async functions calling `supabaseAdmin` |
| 7 | `backend/controllers/authController.js` | First complete request/response cycle to understand |
| 8 | `backend/models/Project.js` | Most complex model; shows relational queries + virtuals |
| 9 | `backend/controllers/paymentController.js` | Razorpay order + signature verification logic |
| 10 | `backend/controllers/aiController.js` | Gemini proxy + all 5 prompt templates |
| 11 | `frontend/src/services/api.js` | All frontend API calls in one file; see the Axios setup and interceptors |
| 12 | `frontend/src/context/AuthContext.jsx` | Global auth state; understand before reading any page |
| 13 | `frontend/src/App.jsx` | All routes, PrivateRoute guard, admin subtree, layout structure |
| 14 | `frontend/src/pages/ProjectDetailPage.jsx` | Most complex page: fetches project, runs Razorpay, shows comments |
| 15 | `frontend/src/pages/AIAssistantPage.jsx` | AI tool UI + "Apply to Campaign" sessionStorage handoff |
| 16 | `frontend/src/admin/` (folder) | Admin section has its own layout and role guard (`AdminRoute.jsx`) |

---

## Quick Start

```bash
# 1. Database — run in Supabase SQL Editor
backend/config/schema.sql
backend/config/notifications.sql

# 2. Backend
cd backend
cp .env.example .env   # fill in all env vars
npm install
npm run dev            # nodemon server.js → http://localhost:5000

# 3. Frontend
cd frontend
npm install
npm run dev            # Vite → http://localhost:5173
# /api/* proxied to :5000 via vite.config.js

# 4. Health check
GET http://localhost:5000/api/health
```

> **Admin access:** Set `role = 'admin'` directly in the Supabase `users` table for your account. The `/admin` route checks `req.user.role === 'admin'` server-side via `adminOnly` middleware.
