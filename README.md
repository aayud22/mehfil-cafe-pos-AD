# ☕ Mehfil Cafe Management System

> **A modern, full-stack cafe POS & operations management system built with Next.js (App Router), TypeScript, Tailwind CSS, and Supabase.**

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20%2B%20Realtime-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v3-38B2AC?style=flat-square&logo=tailwind-css)](https://tailwindcss.com)

---

## 📌 Disclaimer
> **Note:** All data, menus, prices, staff, and records in this system are purely fictional and created exclusively for portfolio and technical demonstration purposes.

---

## 🚀 Live Demo & Demo Accounts

🔗 **Live Deployment:** [mehfil-cafe-pos.vercel.app](https://mehfil-cafe-pos.vercel.app) *(or your deployed Vercel URL)*

To test the system from different role perspectives, use any of the pre-configured demo credentials below:

| Role | Email | Password | Primary Capabilities |
| :--- | :--- | :--- | :--- |
| 👑 **Owner** | `owner@mehfilcafe.demo` | `demo1234` | Today's Sales, Expenses, Profit card, breakdown, full access |
| 🧑‍💼 **Manager** | `manager@mehfilcafe.demo` | `demo1234` | Menu management, Table layout, Log daily expenses |
| 🍳 **Kitchen** | `kitchen@mehfilcafe.demo` | `demo1234` | Real-time KDS (Kitchen Display System), status progression |
| 🧾 **Cashier** | `cashier@mehfilcafe.demo` | `demo1234` | One-click billing, payment recording (Cash, UPI, Card) |
| 📱 **Waiter** | `waiter@mehfilcafe.demo` | `demo1234` | Mobile-first table ordering, live menu item dispatch |

---

## ⚡ The Hard Technical Problems Solved

1. **Role-Based Access Control (RBAC) via Supabase RLS:**
   - Middleware handles early routing guards (e.g. cashiers navigating to `/owner` are bounced back).
   - Strict database-level Row Level Security guarantees that financial numbers and sensitive records cannot be queried or tampered with even via direct API calls.
2. **Instant Kitchen Order Dispatch (Supabase Realtime):**
   - Waiter places an order on a phone PWA.
   - Using PostgreSQL CDC (Change Data Capture) through Supabase Realtime publications, order tickets dynamically pop onto the kitchen display without manual polling or refresh.
3. **Immutable Historic Billing:**
   - When an order item is created, `unit_price` is duplicated from `menu_items.price` into `order_items.unit_price`. Any subsequent cafe price change never corrupts existing or historic orders.
4. **Offline-Ready Waiter Experience (PWA):**
   - Configured with Web App Manifest and service-worker friendly structures for installability on mobile devices with unreliable floor WiFi.

---

## 🛠️ Tech Stack

- **Framework:** Next.js (App Router, Server & Client Components)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Lucide Icons
- **Database & Auth:** Supabase (PostgreSQL with RLS, Auth, Database Functions, and Realtime WebSocket engine)
- **State & Data Fetching:** TanStack Query + Supabase SSR client
- **Forms & Validation:** React Hook Form + Zod
- **Data Visualization:** Recharts

---

## 🗺️ Version Roadmap

### ✅ Version 1: Core POS & Real-Time Kitchen Operations
- [x] Multi-role authentication & dynamic routing (`owner`, `manager`, `cashier`, `kitchen`, `waiter`)
- [x] Digital menu catalog & interactive table management (T1–T8)
- [x] Mobile-first waiter order entry
- [x] Real-time Kitchen Display System (KDS) with status progression (`new` ➔ `preparing` ➔ `ready` ➔ `served`)
- [x] One-click cashier billing with payment mode capture (`cash`, `upi`, `card`)
- [x] Owner executive dashboard (Today's Sales, Expenses, Profit, and tender breakdown)
- [x] PWA manifest for mobile installation

### ⏳ Version 2: Backend Depth (Stock & Advanced Expenses)
- [ ] Recipe linkage engine (e.g., 1 Cappuccino = 200 ml milk + 18 g coffee)
- [ ] Automatic inventory deduction on order completion
- [ ] Low-stock threshold alerts
- [ ] Vendor bill tracking and expense categorization

### ⏳ Version 3: Enterprise Features & Deep Analytics
- [ ] Staff attendance, shifts, and payroll management
- [ ] Monthly profit & loss report with best-selling item analytics
- [ ] Kitchen preparation time benchmarks

---

## 🏁 Getting Started Locally

### 1. Clone the repository
```bash
git clone https://github.com/ayushidiyora/mehfil-cafe-pos-AD.git
cd mehfil-cafe-pos-AD
```

### 2. Install dependencies
```bash
npm install
```

### 3. Setup Supabase
1. Create a new Supabase project at [database.new](https://database.new).
2. Go to the SQL Editor in Supabase and run the migration script:
   ```bash
   cat supabase/migrations/00001_initial_schema.sql
   ```
3. Run the seed data script:
   ```bash
   cat supabase/seed.sql
   ```
4. Copy `.env.example` to `.env.local` and fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

### 4. Run the development server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📂 Project Structure

```
mehfil-cafe/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                    # Root router: redirects to role-specific dashboard
│   ├── login/                      # Authentication portal
│   └── (app)/                      # Protected application routes
│       ├── layout.tsx              # Unified navigation shell & role badge
│       ├── owner/                  # Executive revenue, expense & profit metrics
│       ├── manager/                # Menu, table layout, and expense logging
│       ├── waiter/                 # Mobile table selection & order cart
│       ├── kitchen/                # Real-time reactive Kitchen Display System
│       └── cashier/                # Open tab settlement & payment checkout
├── components/                     # Modular UI, order cards, and chart components
├── hooks/                          # Realtime subscriptions & dashboard metric hooks
├── lib/                            # Supabase client/server singletons & role definitions
├── schemas/                        # Zod runtime schemas
├── supabase/
│   ├── migrations/                 # PostgreSQL schema, RLS, functions & triggers
│   └── seed.sql                    # Initial menu, tables, and expense seed data
└── types/                          # TypeScript definitions for database entities
```

---

## 👤 Author

**Ayushi Diyora**  
- Portfolio: [ayushidiyora.dev](https://ayushidiyora.dev)
- GitHub: [@ayushidiyora](https://github.com/ayushidiyora)
