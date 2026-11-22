# Mehfil Cafe Management System: Project Plan & Discussion History

## 1. Project Concept & Vision
**Mehfil Cafe Management System** is a full-stack, role-based cafe operations platform and Point-of-Sale (POS) designed as a personal portfolio project for **Ayushi Diyora**.

### Why This Idea Stands Out
- **Solves Real Business Operational Problems:** Showcases end-to-end understanding of business workflows (floor ordering, kitchen order queuing, register settlement, daily P&L).
- **Direct Skill Demonstration:**
  - Role-based dynamic dashboards
  - Real-time Kitchen Display System (KDS) via WebSockets
  - Mobile-first Waiter PWA interface
  - Cash, UPI, and Card billing workflows
- **Strong Interview Talking Points:** Solves real technical hurdles: database-level Row Level Security (RLS), Change Data Capture (CDC), and historic price immutability.

---

## 2. Technical Stack
- **Framework:** Next.js 15 (App Router, Server & Client Components)
- **Language:** TypeScript 5
- **Styling:** Tailwind CSS + Lucide Icons
- **Database & Realtime:** Supabase (PostgreSQL with RLS, Auth, Triggers, and Realtime WebSocket engine)
- **State & Data Fetching:** TanStack Query + Supabase SSR
- **Validation:** React Hook Form + Zod
- **Analytics:** Recharts

---

## 3. Version Roadmap

### Version 1 (Core POS & Live Kitchen Operations)
- Multi-role authentication & dynamic routing (`owner`, `manager`, `cashier`, `kitchen`, `waiter`)
- Digital menu catalog & interactive table management (T1–T8)
- Mobile-first waiter order entry
- Real-time Kitchen Display System (KDS) with status progression (`new` ➔ `preparing` ➔ `ready` ➔ `served`)
- One-click cashier billing with payment mode capture (`cash`, `upi`, `card`)
- Owner executive dashboard (Today's Sales, Expenses, Profit, and tender breakdown)
- PWA manifest for mobile installation

### Version 2 (Backend Depth: Inventory & Vendor Tracking)
- Recipe linkage engine (e.g. 1 Cappuccino = 200 ml milk + 18 g coffee)
- Automatic stock reduction on order dispatch
- Low-stock alerts
- Vendor bill tracking and expense categorization

### Version 3 (Enterprise Operations & Analytics)
- Staff attendance, shifts, and salary records
- Monthly P&L reporting and best-selling item analytics

---

## 4. Database Architecture (8 Tables)
1. **`profiles`**: User role mapping (`owner`, `manager`, `cashier`, `kitchen`, `waiter`) extending Supabase Auth.
2. **`menu_categories`**: Item categorization (Hot Coffee, Cold Coffee, Chai, Snacks, Bakery).
3. **`menu_items`**: Menu catalog with pricing and kitchen availability toggle.
4. **`cafe_tables`**: Physical floor tables with occupancy status.
5. **`orders`**: Active and completed dining sessions.
6. **`order_items`**: Line items inside orders preserving unit price at time of order.
7. **`payments`**: Payment records with tender modes (`cash`, `upi`, `card`).
8. **`expenses`**: Daily cafe operational expenditures.

---

## 5. Domain & Repo Identity Notes
- **Repository Name:** `mehfil-cafe-pos-AD` (incorporating Ayushi Diyora's initials for personal branding)
- **Vercel Subdomain:** `mehfil-cafe-pos.vercel.app` (chosen to avoid name collisions with existing cafes)
- **Demo Accounts Configured:**
  - Owner: `owner@mehfilcafe.demo` (Password: `demo1234`)
  - Kitchen: `kitchen@mehfilcafe.demo` (Password: `demo1234`)
  - Cashier: `cashier@mehfilcafe.demo` (Password: `demo1234`)
  - Waiter: `waiter@mehfilcafe.demo` (Password: `demo1234`)
