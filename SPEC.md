# Pageant Tabulator Pro - Technical Specification

**Version:** 1.5
**Last Updated:** 2026-04-24
**Status:** v1.5 In Progress — UI/UX Overhaul

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [System Architecture](#2-system-architecture)
3. [Data Model](#3-data-model)
4. [User Roles & Workflows](#4-user-roles--workflows)
5. [Functional Requirements](#5-functional-requirements)
6. [Technical Stack](#6-technical-stack)
7. [API Contracts](#7-api-contracts)
8. [WebSocket Events](#8-websocket-events)
9. [UI Specifications](#9-ui-specifications)
10. [Print Report Template](#10-print-report-template)
11. [Offline & Sync Strategy](#11-offline--sync-strategy)
12. [Security & Session Management](#12-security--session-management)
13. [Performance Considerations](#13-performance-considerations)
14. [Implementation Phases](#14-implementation-phases)
15. [Appendix A: Error Codes & Statuses](#appendix-a-error-codes--statuses)
16. [Appendix B: PWA (Progressive Web App)](#appendix-b-pwa-progressive-web-app)
17. [Appendix C: Deployment Checklist](#appendix-c-deployment-checklist)
18. [Appendix D: Known Limitations](#appendix-d-known-limitations)
19. [Appendix E: Changelog (Iteration 2)](#appendix-e-changelog-iteration-2)
20. [Appendix F: Theme System & Design Guidelines](#appendix-f-theme-system--design-guidelines)

---

## 1. Project Overview

### 1.1 Goal
Replace manual Excel-based tabulation with a local-first web application for real-time scoring and consolidation during live pageantry events.

### 1.2 Environment
- **Network:** Strictly Local Area Network (LAN)
- **Deployment:** Local server on Admin PC
- **Access:** Via local IP (e.g., `192.168.x.x`) on Wi-Fi or Ethernet
- **No Internet Dependency**

### 1.3 User Personas

| Role | Description |
|------|-------------|
| **Admin** | Configures events, monitors judge progress in real-time, controls category access, unlocks scores for corrections, generates print reports |
| **Judge** | Scores contestants across multiple criteria in a spreadsheet-style interface, submits per category |

---

## 2. System Architecture

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Admin PC (Server)                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │  Node.js + Express Server                          │    │
│  │  - REST API (Event config, scores CRUD)            │    │
│  │  - WebSocket Server (Real-time sync)               │    │
│  │  - Better-SQLite3 Database (WAL mode)              │    │
│  └────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                            │
                  ┌─────────┴─────────┐
                  │   LAN (Wi-Fi)     │
                  └─────────┬─────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
   ┌────▼────┐        ┌────▼────┐        ┌────▼────┐
   │ Judge 1 │        │ Judge 2 │        │ Judge N │
   │ Browser │        │ Browser │        │ Browser │
   │         │        │         │        │         │
   │ React   │        │ React   │        │ React   │
   │ SPA     │        │ SPA     │        │ SPA     │
   │         │        │         │        │         │
   │ IndexedDB│       │ IndexedDB│       │ IndexedDB│
   └─────────┘        └─────────┘        └─────────┘
```

### 2.2 Data Flow Hierarchy (Source of Truth)
1. **Server (SQLite)** - Master source of truth
2. **Client Memory (React State)** - Runtime state
3. **Client Persistence (IndexedDB)** - Offline fallback

---

## 3. Data Model

### 3.1 Database Schema (SQLite)

```sql
-- Events
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'archived'))
);

-- Judges
CREATE TABLE judges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  seat_number INTEGER NOT NULL, -- Judge 1, Judge 2, etc.
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL, -- bcrypt hashed 4-digit PIN
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(event_id, seat_number)
);

-- Contestants
CREATE TABLE contestants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  number INTEGER NOT NULL, -- Contestant #1, #2, etc.
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'withdrawn')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  UNIQUE(event_id, number)
);

-- Categories (e.g., "Preliminary Round", "Finals")
CREATE TABLE categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  display_order INTEGER NOT NULL,
  is_locked BOOLEAN DEFAULT 0, -- Admin can lock entire category
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Criteria (e.g., "Poise", "Beauty", "Confidence")
CREATE TABLE criteria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  weight REAL NOT NULL CHECK(weight >= 0 AND weight <= 1), -- 0.0 to 1.0 (percentage)
  min_score REAL NOT NULL DEFAULT 0,
  max_score REAL NOT NULL DEFAULT 10,
  display_order INTEGER NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Scores
CREATE TABLE scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  judge_id INTEGER NOT NULL,
  contestant_id INTEGER NOT NULL,
  criteria_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL, -- Denormalized for faster queries
  score REAL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
  FOREIGN KEY (contestant_id) REFERENCES contestants(id) ON DELETE CASCADE,
  FOREIGN KEY (criteria_id) REFERENCES criteria(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(judge_id, contestant_id, criteria_id)
);

-- Category Submissions (tracks per-judge, per-category submission status)
CREATE TABLE category_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  judge_id INTEGER NOT NULL,
  category_id INTEGER NOT NULL,
  submitted BOOLEAN DEFAULT 0,
  submitted_at DATETIME,
  unlocked_by_admin BOOLEAN DEFAULT 0, -- Admin manual unlock flag
  FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE CASCADE,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
  UNIQUE(judge_id, category_id)
);

-- Audit Log
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  judge_id INTEGER,
  action TEXT NOT NULL, -- 'score_entered', 'score_updated', 'category_submitted', 'category_unlocked', 'contestant_added', etc.
  details TEXT, -- JSON with old/new values
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (judge_id) REFERENCES judges(id) ON DELETE SET NULL
);

-- Indexes for performance
CREATE INDEX idx_scores_judge ON scores(judge_id);
CREATE INDEX idx_scores_contestant ON scores(contestant_id);
CREATE INDEX idx_scores_category ON scores(category_id);
CREATE INDEX idx_audit_log_event ON audit_log(event_id, timestamp);
-- Composite index for judge+category lookups
CREATE INDEX idx_scores_judge_category ON scores(judge_id, category_id);

-- Saved Reports (v1.3)
CREATE TABLE saved_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  report_type TEXT NOT NULL,
  title TEXT,
  categories TEXT, -- JSON array of category IDs
  config TEXT, -- JSON with report settings
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Elimination Rounds (v1.3)
CREATE TABLE elimination_rounds (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  round_name TEXT NOT NULL,
  round_order INTEGER NOT NULL,
  contestant_count INTEGER NOT NULL,
  based_on_report_id INTEGER, -- FK to saved_reports.id (optional)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- Round Qualifiers (v1.3)
CREATE TABLE round_qualifiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  round_id INTEGER NOT NULL,
  contestant_id INTEGER NOT NULL,
  qualified_rank INTEGER NOT NULL,
  FOREIGN KEY (round_id) REFERENCES elimination_rounds(id) ON DELETE CASCADE,
  FOREIGN KEY (contestant_id) REFERENCES contestants(id) ON DELETE CASCADE,
  UNIQUE(round_id, contestant_id)
);

-- Events (extended v1.4) - add tabulators column
ALTER TABLE events ADD COLUMN tabulators TEXT; -- JSON array: [{name: "REYMOND ABELLA"}]

-- Categories (extended v1.4) - add weight column
ALTER TABLE categories ADD COLUMN weight REAL DEFAULT 1; -- for cross-category reports
```

### 3.2 Entity Relationships
```
Event (1) ──┬── (N) Judges
            ├── (N) Contestants
            ├── (N) Categories (1) ─── (N) Criteria
            ├── (N) Saved Reports
            └── (N) Elimination Rounds (1) ─── (N) Round Qualifiers

Scores (N) ── (1) Judge
           ── (1) Contestant
           ── (1) Criteria
           ── (1) Category

CategorySubmissions (N) ── (1) Judge
                       ── (1) Category
```

---

## 4. User Roles & Workflows

### 4.1 Admin Workflow

```
1. Login with admin secret (configured via ADMIN_SECRET env var)
   ↓
2. Create Event
   ↓
3. Configure Categories & Criteria (with weights, min/max scores)
   ↓
4. Add Judges (assign seat numbers & PINs)
   ↓
5. Add Contestants
   ↓
6. Open Categories for Judging
   ↓
7. Monitor Live Progress (real-time dashboard)
   ↓
8. View Individual Judge Draft Scores (live preview)
   ↓
9. Lock/Unlock Categories or Individual Judge Sheets
   ↓
10. Generate & Print Reports
```

#### A. Admin Authentication
- **Login Page** (`/admin/login`): Full-screen dark UI with secret input
- **Session**: Stored in `sessionStorage` with admin secret for Socket.io validation
- **Route Protection**: `ProtectedRoute` redirects unauthenticated requests to `/admin/login`
- **Socket Validation**: Admin socket connections require matching secret token in handshake

#### B. Rate Limiting
- Judge login: 5 failed PIN attempts per 30s per judge → returns 429 with retry-after countdown

### 4.2 Judge Workflow

```
1. Login (select seat number + enter PIN)
   ↓
2. View Available Categories
   ↓
3. Select Category → Spreadsheet View
   ↓
4. Enter Scores (any order, auto-saved)
   ↓
5. Click "Submit Category"
   ↓
6. Sheet becomes read-only
   ↓
7. (If unlocked by Admin) → Edit & Re-submit
```

---

## 5. Functional Requirements

### 5.1 Admin Dashboard

#### A. Event Configuration
- **Create Event:** Input event name, select active status
- **Add/Edit/Delete Judges:** Assign seat number, name, 4-digit PIN
- **Add/Edit/Delete Categories:** Name, display order
- **Add/Edit/Delete Criteria:** Per category - name, weight (%), min score, max score, display order
- **Add/Remove Contestants:** Mid-event additions allowed, mark as "withdrawn" instead of delete
- **Validation:**
  - Total weights per category must sum to 100% (validated server-side)
  - PIN must be exactly 4 digits
  - Contestant numbers must be unique per event
  - Score values must fall within each criterion's min/max range (validated server-side)
  - Score submissions to locked or already-submitted categories are rejected unless unlocked by admin

#### B. Live Monitor
- **Dashboard View:**
  - List all judges with real-time progress per category
  - Example: "Judge 1: Evening Gown (8/10 scored, Not Submitted)"
  - Color-coded status: Draft (Yellow), Submitted (Green), Locked (Gray)
- **Category Controls:**
  - Per-category lock/unlock toggle buttons displayed above judge cards
  - "Lock" button prevents new score entries across all judges for that category
  - "Unlock" re-enables scoring
  - Lock state broadcast to all judges in real-time via WebSocket
- **Progress Initialization:**
  - On mount, fetches existing scores from server to populate progress bars (not just socket events)
  - Progress bars reflect actual judge state even before any real-time events fire
- **Live Score Preview:**
  - Admin can click on a judge to see their current draft scores
  - Updates in real-time as judge types

#### C. Category Control
- **Lock/Unlock Category:** 
  - "Lock" button prevents new score entries across all judges
  - "Unlock" re-enables scoring
- **Manual Judge Unlock:**
  - Select specific judge + category
  - Click "Unlock Sheet" → Judge receives notification
  - Judge can edit and must re-submit

#### D. Reporting
- **Print-Ready View:**
  - Per-category detailed report (see section 10)
  - Export as PDF (browser print to PDF)
  - Include judge signatures section

### 5.2 Judge Portal

#### A. Authentication
- **Login Screen:**
  - Dropdown: Select event (active events only)
  - Dropdown: Select seat — populated dynamically with actual judges assigned to the event (shows "Judge Name (Seat #)")
  - Input: 4-digit PIN
  - Button: "Login"
  - Seat dropdown disabled until event is selected; shows "No judges assigned" if none exist
- **Session Management:**
  - Store `judgeId` + `eventId` in sessionStorage
  - WebSocket connection authenticates on connect

#### B. Category Selection
- **View:**
  - List of categories for current event
  - Status badges: "Not Started", "Draft (X/Y)", "Submitted", "Locked"
  - Submitted categories are **clickable** for review (View Only mode — inputs disabled, read-only banner shown)
  - Click category → Opens spreadsheet view
  - Draft count shows "X/Y scored" for in-progress categories
  - Real-time draft count updates when scores are entered

#### C. Spreadsheet View (TanStack Table)
- **Grid Layout:**
  - Rows: Contestants (ordered by number)
  - Columns: Criteria (ordered by display_order)
  - Header row: Criterion name, weight %, min-max range
  - First column: Contestant number + name
- **Input Cells:**
  - Number input with step=0.1 (support decimals like 9.5)
  - Validation: Enforce min/max range, show error on invalid input
  - Auto-save: Debounced 250ms after last keystroke
  - Visual feedback: Unsaved (yellow border), Saved (green checkmark icon)
  - Conflict resolution: On reconnect, if local scores differ from server, prompts judge to keep local or use server
- **Navigation:**
  - Arrow keys to move between cells
  - Tab/Shift+Tab for horizontal navigation
  - Enter to move down
- **Real-Time Lock Detection:**
  - Listens for `category_locked` socket event
  - If admin locks category while judge is editing, all inputs immediately disable
  - Banner changes to: "This category has been locked by admin. You cannot edit scores."
- **Submit Button:**
  - Positioned at bottom of sheet
  - Disabled until all cells have valid scores
  - On click: Confirmation modal → "Submit Evening Gown scores? You cannot edit after submission."
  - On confirm: POST to server, disable all inputs, show "Submitted" badge
- **Dynamic Contestant Addition:**
  - Listens for `contestant_added` socket event
  - New contestants added to sheet in real-time while editing

#### D. Read-Only State
- **Triggers:**
  - After category submission
  - If category is locked by Admin
- **UI Changes:**
  - All inputs disabled
  - Gray background on cells
  - Banner: "This category has been submitted and locked"
- **Unlock Scenario:**
  - WebSocket event from Admin → Show notification
  - Banner changes: "Admin has unlocked this sheet. You can now edit."
  - Re-enable inputs

#### E. Connection Status
- **Heartbeat Indicator:**
  - Top-right corner of both category selection and spreadsheet views
  - Green dot = Connected, Red dot = Disconnected
  - Tooltip on hover: "Last sync: 2 seconds ago" (updates every 3 seconds)
  - If disconnected: Amber banner shows "Working offline. Scores saved locally."
  - On reconnect: If local scores differ from server, conflict resolution modal prompts user

### 5.3 Offline & Synchronization

#### A. IndexedDB Schema
```javascript
// Store: scores
{
  id: "judge1_contestant5_criteria3", // Composite key
  judgeId: 1,
  contestantId: 5,
  criteriaId: 3,
  categoryId: 2,
  score: 9.5,
  synced: false, // Flag for pending sync
  timestamp: 1678901234567
}

// Store: submissions
{
  id: "judge1_category2",
  judgeId: 1,
  categoryId: 2,
  submitted: true,
  synced: false,
  timestamp: 1678901234567
}
```

#### B. Sync Logic
1. **On Score Entry:**
   - Save to IndexedDB immediately
   - Debounce 250ms → POST to server
   - On success: Mark as `synced: true`
   - On failure: Keep `synced: false`, retry on reconnect

2. **On Reconnect:**
   - Fetch all unsynced records from IndexedDB
   - Batch POST to server
   - Server responds with latest state
   - If conflict detected (server has newer data):
     - Show modal: "Your offline scores differ from server. Overwrite server? / Discard local?"
     - On user choice: Apply and log to audit

3. **Heartbeat Mechanism:**
   - Client sends `heartbeat` ping every 3 seconds
   - Server responds with `heartbeat_ack`
   - If no ack after 10 seconds: Mark as disconnected

---

## 6. Technical Stack

### 6.1 Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** Better-SQLite3 with WAL mode
- **WebSockets:** Socket.io
- **Authentication:** bcrypt for PIN hashing
- **Logging:** Winston (file + console)

### 6.2 Frontend
- **Framework:** React 18 (Vite for build)
- **State Management:** React Context API + useReducer
- **Data Grid:** TanStack Table v8
- **Styling:** Tailwind CSS + CSS Custom Properties
- **Theme System:** Dark/Light mode with Rose Gold + Mauve palette
- **Offline Storage:** Dexie.js (IndexedDB wrapper)
- **WebSocket Client:** Socket.io-client
- **Forms:** React Hook Form
- **Notifications:** React Hot Toast

### 6.4 Environment Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `ADMIN_SECRET` | (required) | Admin login password |
| `REPORT_CACHE_TTL_MS` | 300000 | Report cache TTL (5 min) |
| `VITE_SOCKET_URL` | window.origin | Socket connection URL |
| `VITE_API_URL` | /api | API base URL |

### 6.5 Development Tools
- **Linting:** ESLint + Prettier
- **Testing:** Vitest (unit), Playwright (E2E)
- **Version Control:** Git

---

## 7. API Contracts

### 7.1 REST Endpoints

#### Events
```http
POST /api/events
Body: { name: string }
Response: { id: number, name: string, created_at: string }

GET /api/events/:id
Response: { id, name, status, judges[], contestants[], categories[] }

PATCH /api/events/:id
Body: { name?, status? }
Response: { id, name, status }
```

#### Judges
```http
POST /api/events/:eventId/judges
Body: { seat_number: number, name: string, pin: string }
Response: { id, seat_number, name }

DELETE /api/events/:eventId/judges/:judgeId
Response: 204 No Content

POST /api/auth/judge
Body: { event_id: number, seat_number: number, pin: string }
Response: { token: string, judge: { id, seat_number, name }, event: {...} }
```

#### Contestants
```http
POST /api/events/:eventId/contestants
Body: { number: number, name: string }
Response: { id, number, name, status }

PATCH /api/contestants/:id
Body: { name?, status? }
Response: { id, number, name, status }

DELETE /api/contestants/:id (soft delete → status='withdrawn')
Response: 204 No Content
```

#### Categories & Criteria
```http
POST /api/events/:eventId/categories
Body: { name: string, display_order: number }
Response: { id, name, display_order, is_locked }

POST /api/categories/:categoryId/criteria
Body: { name: string, weight: number, min_score: number, max_score: number, display_order: number }
Response: { id, name, weight, min_score, max_score, display_order }

PATCH /api/categories/:id
Body: { is_locked: boolean }
Response: { id, is_locked }
```

#### Scores
```http
POST /api/scores
Body: {
  judge_id: number,
  contestant_id: number,
  criteria_id: number,
  category_id: number,
  score: number
}
Response: { id, judge_id, contestant_id, criteria_id, category_id, score, updated_at }
Errors: 403 if category locked or already submitted; 400 if score out of range

POST /api/scores/batch
Body: { scores: [{ judge_id, contestant_id, criteria_id, category_id, score }] }
Response: { saved: number, errors: [{ index: number, error: string }] }
```

#### Submissions
```http
POST /api/submissions
Body: { judge_id: number, category_id: number }
Response: { id, submitted: true, submitted_at: string, unlocked_by_admin: 0 }

POST /api/submissions/unlock
Body: { judge_id: number, category_id: number }
Response: { id, submitted: true, submitted_at: string, unlocked_by_admin: 1 }
```

#### Reports
```http
GET /api/reports/:eventId/category/:categoryId
Response: {
  category: { id, name, display_order, is_locked },
  criteria: [{ id, name, weight, min_score, max_score }],
  judges: [{ id, seat_number, name }],
  contestants: [{ id, number, name }],
  scores: [{ contestant_id, judge_id, criteria_id, score }],
  rankings: [{ contestant_id, contestant_number, contestant_name, total_score, rank }],
  _cached: boolean  // Indicates if served from cache
}

POST /api/reports/:eventId/cross-category
Body: { category_ids: number[], aggregation_type?: 'rank_sum', report_title?: string }
Response: {
  title: string,
  categories: [{ id, name, display_order }],
  contestants: [{ id, number, name, category_ranks, total_rank, overall_rank }]
}

POST /api/reports/save
Body: { event_id: number, report_type: string, report_title: string, configuration: object }
Response: { id, event_id, report_type, report_title, configuration, created_at }

GET /api/reports/saved?event_id=:eventId
Response: [{ id, event_id, report_type, report_title, configuration, created_at }]

DELETE /api/reports/saved/:id
Response: 204 No Content

#### Elimination Rounds
```http
POST /api/elimination-rounds
Body: { event_id: number, round_name: string, round_order: number, contestant_count: number, based_on_report_id?: number }
Response: { id, event_id, round_name, round_order, contestant_count, created_at }

GET /api/elimination-rounds?event_id=:eventId
Response: [{ id, event_id, round_name, round_order, contestant_count, created_at }]

GET /api/elimination-rounds/:roundId/qualifiers
Response: [{ id, round_id, contestant_id, qualified_rank, contestant: { id, number, name } }]

DELETE /api/elimination-rounds/:roundId?event_id=:eventId
Response: 204 No Content
```

#### Scoring Context (Judge Portal)
```http
GET /api/scoring/:judgeId/event/:eventId
Response: {
  judge: { id },
  event: { id },
  contestants: [{ id, number, name }],
  categories: [{ id, name, display_order, is_locked, criteria: [{ id, name, weight, min_score, max_score, display_order }] }]
}

GET /api/scores?judge_id=:judgeId&category_id=:categoryId
Response: [{ id, judge_id, contestant_id, criteria_id, category_id, score, updated_at }]
```

---

## 8. WebSocket Events

### 8.1 Client → Server

```javascript
// Authentication
socket.emit('authenticate', { role: 'judge' | 'admin', judgeId: number, eventId: number });

// Reconnect (after disconnect)
socket.emit('reconnect');

// Heartbeat
socket.emit('heartbeat');

// Score update (also saved via REST, this is for real-time broadcast)
socket.emit('score_update', {
  judgeId: 1,
  contestantId: 5,
  criteriaId: 3,
  categoryId: 2,
  score: 9.5
});

// Category submission
socket.emit('category_submit', { judgeId: 1, categoryId: 2 });
```

### 8.2 Server → Client

```javascript
// Authentication response
socket.on('authenticated', { success: true, role: 'judge' | 'admin', judge?: {...} });

// Heartbeat acknowledgment
socket.on('heartbeat_ack', { timestamp: Date.now() });

// Connection lost (heartbeat timeout)
socket.on('connection_lost', { reason: 'heartbeat_timeout' });

// Judge progress update (broadcast to Admin)
socket.on('judge_progress', {
  judgeId: 1,
  judgeName: 'John',
  categoryId: 2,
  scored: 8,
  total: 10,
  submitted: false
});

// Live score update (broadcast to Admin)
socket.on('score_updated', {
  judge_id: 1,
  contestant_id: 5,
  criteria_id: 3,
  category_id: 2,
  score: 9.5
});

// Category submission (broadcast to all)
socket.on('category_submitted', { judgeId: 1, categoryId: 2 });

// Category locked (broadcast to all judges)
socket.on('category_locked', { categoryId: 2, isLocked: true });

// Sheet unlocked (to specific judge)
socket.on('sheet_unlocked', { judgeId: 1, categoryId: 2 });

// Contestant added mid-event (broadcast to all judges)
socket.on('contestant_added', { contestant: { id, number, name } });
```

### 8.3 Audit Events (Server → Audit Log)
```javascript
// These actions are logged to the audit_log table via writeAuditLog():
// - 'score_entered' - Judge entered a new score
// - 'score_updated' - Judge modified an existing score
// - 'category_submitted' - Judge submitted a category
// - 'category_unlocked' - Admin unlocked a judge's category
// - 'report_generated' - Admin generated a report
// - 'report_saved' - Admin saved a report configuration
// - 'report_deleted' - Admin deleted a saved report
```

---

## 9. UI Specifications

### 9.1 Admin Dashboard

#### Layout
```
┌─────────────────────────────────────────────────────┐
│ Header: Pageant Tabulator Pro | Event: [Name]      │
├─────────────────────────────────────────────────────┤
│ Tabs: [Setup] [Monitor] [Reports]                  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  SETUP TAB:                                         │
│  ┌───────────────────────────────────────────────┐ │
│  │ Event Configuration                           │ │
│  │ - Event Name: [___________]                   │ │
│  │ - Status: ○ Active  ○ Archived                │ │
│  │ [Save]                                        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Judges                      [+ Add Judge]     │ │
│  │ ┌────┬────────┬──────┬──────────┐            │ │
│  │ │ #  │ Name   │ PIN  │ Actions  │            │ │
│  │ ├────┼────────┼──────┼──────────┤            │ │
│  │ │ 1  │ John   │ •••• │ [Delete] │            │ │
│  │ └────┴────────┴──────┴──────────┘            │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Categories                [+ Add Category]    │ │
│  │ > Evening Gown                                │ │
│  │   Criteria:                                   │ │
│  │   - Poise (40%, 0-10)      [Edit] [Delete]   │ │
│  │   - Beauty (60%, 0-10)     [Edit] [Delete]   │ │
│  │   [+ Add Criterion]                           │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Contestants              [+ Add Contestant]   │ │
│  │ ┌────┬──────────┬────────┬──────────┐        │ │
│  │ │ #  │ Name     │ Status │ Actions  │        │ │
│  │ ├────┼──────────┼────────┼──────────┤        │ │
│  │ │ 1  │ Alice    │ Active │ [Edit]   │        │ │
│  │ └────┴──────────┴────────┴──────────┘        │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  MONITOR TAB:                                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ Live Progress                                 │ │
│  │                                               │ │
│  │ Judge 1 (John):                               │ │
│  │   Evening Gown: 🟡 Draft (8/10) [View]       │ │
│  │   Swimsuit:     🟢 Submitted     [Unlock]    │ │
│  │                                               │ │
│  │ Judge 2 (Mary):                               │ │
│  │   Evening Gown: 🟢 Submitted     [Unlock]    │ │
│  │   Swimsuit:     ⚪ Not Started               │ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  ┌───────────────────────────────────────────────┐ │
│  │ Category Controls                             │ │
│  │                                               │ │
│  │ Evening Gown: [🔓 Unlocked] [Lock Category]  │ │
│  │ Swimsuit:     [🔒 Locked]   [Unlock Category]│ │
│  └───────────────────────────────────────────────┘ │
│                                                     │
│  REPORTS TAB:                                       │
│  ┌───────────────────────────────────────────────┐ │
│  │ Select Category: [Dropdown]                   │ │
│  │ [Generate Report] [Print]                     │ │
│  │                                               │ │
│  │ (Report Preview Here)                         │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 9.2 Judge Portal

#### Login Screen
```
┌─────────────────────────────────────┐
│  Pageant Tabulator Pro              │
│                                     │
│  ┌───────────────────────────────┐ │
│  │  Judge Login                  │ │
│  │                               │ │
│  │  Select Seat:                 │ │
│  │  [Dropdown: Judge 1 ▼]        │ │
│  │                               │ │
│  │  Enter PIN:                   │ │
│  │  [____] (4 digits)            │ │
│  │                               │ │
│  │  [Login]                      │ │
│  └───────────────────────────────┘ │
└─────────────────────────────────────┘
```

#### Category Selection
```
┌─────────────────────────────────────────────────────┐
│ Header: Judge 1 (John) | Event: Miss Universe 2025 │
│ Connection: 🟢 Connected                            │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Select a Category to Score:                        │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Evening Gown                                │   │
│  │ Status: 🟡 Draft (8/10 scored)              │   │
│  │ [Continue Scoring]                          │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Swimsuit                                    │   │
│  │ Status: 🟢 Submitted                        │   │
│  │ [View Only]                                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │ Interview                                   │   │
│  │ Status: 🔒 Locked by Admin                  │   │
│  │ [Locked]                                    │   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

#### Spreadsheet View
```
┌───────────────────────────────────────────────────────────────┐
│ Judge 1 | Evening Gown                     🟢 Connected       │
├───────────────────────────────────────────────────────────────┤
│ [← Back to Categories]                    [Submit Category]  │
├───────────────────────────────────────────────────────────────┤
│ #  │ Contestant │ Poise (40%) │ Beauty (60%) │ (Auto-save)  │
│    │            │   0-10      │   0-10       │              │
├────┼────────────┼─────────────┼──────────────┼──────────────┤
│ 1  │ Alice      │ [9.5] ✓     │ [8.0] ✓      │              │
│ 2  │ Betty      │ [__]        │ [9.0] ✓      │              │
│ 3  │ Clara      │ [7.5] ✓     │ [__]         │              │
│ 4  │ Diana      │ [8.0] ✓     │ [8.5] ✓      │              │
│ 5  │ Emma       │ [9.0] ✓     │ [9.5] ✓      │              │
└───────────────────────────────────────────────────────────────┘

Notes:
- Green checkmark (✓) = Score saved
- Yellow border = Unsaved changes
- Empty cells highlighted until filled
```

### 9.3 Component Library

#### Reusable Components

| Component | Props | Description |
|-----------|-------|-------------|
| `Button` | variant, size, loading, children | Primary/secondary/danger buttons |
| `Input` | type, placeholder, value, onChange | Form inputs with theme support |
| `Card` | children, className | Card wrapper with border/shadow |
| `AnimatedTabs` | tabs, activeTab, onChange | Animated tab indicator |
| `ThemeToggle` | - | Sun/moon dark/light toggle |
| `Skeleton` | width, height | Loading skeleton |
| `ConfirmDialog` | open, title, message, confirmLabel, cancelLabel, variant, onConfirm, onCancel | Reusable confirmation modal |
| `ConflictModal` | open, localCount, serverCount, onUseServer, onKeepLocal | Conflict resolution modal |
| `SortableTable` | data, columns, onSort, sortKey, sortDir | Sortable data table |

#### Custom Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useAutoSave` | { save, isPending, flushQueue, resolveConflict, refetchKey } | Debounced auto-save |
| `useOfflineScores` | { saveScore, getScores, isUnsaved, isSubmitted, getUnsynced } | IndexedDB scores |
| `useCrudResource` | { items, loading, error, handleCreate, handleUpdate, handleDelete, refresh } | Generic CRUD |
| `useHotkeys` | - | Keyboard shortcuts (J/K tabs, Cmd+S save) |

---

## 10. Print Report Template

### 10.1 Report Structure (Per Category)

```
════════════════════════════════════════════════════════════
              PAGEANT TABULATOR PRO
           OFFICIAL SCORE SHEET - EVENING GOWN
════════════════════════════════════════════════════════════

Event: Miss Universe 2025
Date: April 9, 2026
Category: Evening Gown

────────────────────────────────────────────────────────────
CRITERIA & WEIGHTS:
  • Poise: 40% (Range: 0-10)
  • Beauty: 60% (Range: 0-10)
────────────────────────────────────────────────────────────

┌──────┬─────────────┬─────────┬─────────┬─────────┬─────────┬──────┐
│  #   │ Contestant  │ Judge 1 │ Judge 2 │ Judge 3 │ Average │ Rank │
├──────┼─────────────┼─────────┼─────────┼─────────┼─────────┼──────┤
│  1   │ Alice       │  17.5   │  18.0   │  17.0   │  17.50  │  2   │
│  2   │ Betty       │  18.0   │  19.0   │  18.5   │  18.50  │  1   │
│  3   │ Clara       │  16.0   │  15.5   │  16.5   │  16.00  │  4   │
│  4   │ Diana       │  17.0   │  17.5   │  17.0   │  17.17  │  3   │
│  5   │ Emma        │  15.0   │  14.5   │  15.5   │  15.00  │  5   │
└──────┴─────────────┴─────────┴─────────┴─────────┴─────────┴──────┘

Notes:
  • Judge scores represent the SUM of all criteria scores in this category
  • Average is calculated across all judges
  • Rankings are based on average scores (highest to lowest)

────────────────────────────────────────────────────────────
JUDGES' SIGNATURES:

Judge 1: ___________________  Judge 2: ___________________

Judge 3: ___________________

────────────────────────────────────────────────────────────
Tabulated by: Pageant Tabulator Pro v1.0
Generated on: April 9, 2026 at 3:45 PM
════════════════════════════════════════════════════════════
```

### 10.2 CSS Print Styles

```css
@media print {
  @page {
    size: A4 portrait;
    margin: 1.5cm;
  }

  body {
    font-family: 'Times New Roman', serif;
    font-size: 11pt;
    line-height: 1.4;
  }

  .report-header {
    text-align: center;
    border-top: 3px double #000;
    border-bottom: 3px double #000;
    padding: 10px 0;
    margin-bottom: 20px;
  }

  .report-title {
    font-size: 14pt;
    font-weight: bold;
    margin-bottom: 5px;
  }

  .report-subtitle {
    font-size: 12pt;
    margin-bottom: 3px;
  }

  .criteria-section {
    border-top: 1px solid #000;
    border-bottom: 1px solid #000;
    padding: 10px 0;
    margin: 15px 0;
  }

  table.scores-table {
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
  }

  table.scores-table th,
  table.scores-table td {
    border: 1px solid #000;
    padding: 8px;
    text-align: center;
  }

  table.scores-table th {
    background-color: #f0f0f0;
    font-weight: bold;
  }

  .signature-section {
    margin-top: 40px;
    border-top: 1px solid #000;
    padding-top: 15px;
  }

  .signature-line {
    display: inline-block;
    width: 45%;
    margin: 20px 2.5%;
    border-bottom: 1px solid #000;
    padding-bottom: 2px;
  }

  .footer {
    border-top: 3px double #000;
    padding-top: 10px;
    margin-top: 30px;
    font-size: 9pt;
    text-align: center;
  }

  /* Hide non-printable elements */
  button, .no-print, nav, .connection-status {
    display: none !important;
  }
}
```

---

## 11. Offline & Sync Strategy

### 11.1 Client-Side State Flow

```
User Action (Score Entry)
    ↓
Update React State (Optimistic UI)
    ↓
Save to IndexedDB (Immediate)
    ↓
Debounce 250ms
    ↓
POST to Server (If connected)
    ↓
┌─────────────────────────────────┐
│ Success?                        │
├─────────────────────────────────┤
│ YES → Mark synced in IndexedDB  │
│ NO  → Keep synced:false, retry  │
└─────────────────────────────────┘
```

### 11.2 Reconnection Logic

```javascript
// Pseudo-code
async function handleReconnect() {
  // 1. Fetch unsynced scores from IndexedDB
  const unsyncedScores = await db.scores
    .where('synced')
    .equals(false)
    .toArray();

  if (unsyncedScores.length === 0) {
    return; // Nothing to sync
  }

  // 2. Fetch latest server state for these records
  const serverScores = await fetch('/api/scores/batch-check', {
    method: 'POST',
    body: JSON.stringify({
      keys: unsyncedScores.map(s => ({
        judgeId: s.judgeId,
        contestantId: s.contestantId,
        criteriaId: s.criteriaId
      }))
    })
  }).then(r => r.json());

  // 3. Detect conflicts
  const conflicts = unsyncedScores.filter(local => {
    const server = serverScores.find(s => 
      s.judgeId === local.judgeId &&
      s.contestantId === local.contestantId &&
      s.criteriaId === local.criteriaId
    );
    return server && server.updated_at > local.timestamp;
  });

  // 4. Handle conflicts
  if (conflicts.length > 0) {
    const choice = await showConflictModal(conflicts);
    if (choice === 'use_server') {
      // Discard local, update IndexedDB with server data
      await syncFromServer();
    } else {
      // Force push local to server
      await forceSyncToServer(unsyncedScores);
    }
  } else {
    // No conflicts, normal sync
    await syncToServer(unsyncedScores);
  }

  // 5. Mark all as synced
  await db.scores.bulkUpdate(
    unsyncedScores.map(s => ({ ...s, synced: true }))
  );
}
```

### 11.3 Heartbeat Implementation

```javascript
// Client
const HEARTBEAT_INTERVAL = 3000; // 3 seconds
const HEARTBEAT_TIMEOUT = 10000; // 10 seconds

let lastHeartbeat = Date.now();
let isConnected = true;

setInterval(() => {
  socket.emit('heartbeat');
  
  // Check if last ack is too old
  if (Date.now() - lastHeartbeat > HEARTBEAT_TIMEOUT) {
    isConnected = false;
    updateConnectionStatus('disconnected');
  }
}, HEARTBEAT_INTERVAL);

socket.on('heartbeat_ack', () => {
  lastHeartbeat = Date.now();
  if (!isConnected) {
    isConnected = true;
    updateConnectionStatus('connected');
    handleReconnect(); // Trigger sync
  }
});
```

---

## 12. Security & Session Management

### 12.1 PIN Authentication

```javascript
// Server-side (login endpoint)
const bcrypt = require('bcrypt');

app.post('/api/auth/judge', async (req, res) => {
  const { event_id, seat_number, pin } = req.body;

  // Validate PIN format
  if (!/^\d{4}$/.test(pin)) {
    return res.status(400).json({ error: 'PIN must be 4 digits' });
  }

  // Fetch judge from DB
  const judge = db.prepare(`
    SELECT * FROM judges 
    WHERE event_id = ? AND seat_number = ?
  `).get(event_id, seat_number);

  if (!judge) {
    return res.status(404).json({ error: 'Judge not found' });
  }

  // Verify PIN
  const valid = await bcrypt.compare(pin, judge.pin_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid PIN' });
  }

  // Generate session token (simple JWT or UUID)
  const token = generateToken({ judgeId: judge.id, eventId: event_id });

  res.json({ 
    token, 
    judge: { id: judge.id, seat_number, name: judge.name },
    event: { ... }
  });
});
```

### 12.2 WebSocket Authentication

```javascript
// Server-side (Socket.io middleware)
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  try {
    const decoded = verifyToken(token);
    socket.judgeId = decoded.judgeId;
    socket.eventId = decoded.eventId;
    next();
  } catch (err) {
    next(new Error('Authentication failed'));
  }
});

// Client-side
const socket = io('http://192.168.1.100:3000', {
  auth: {
    token: localStorage.getItem('token')
  }
});
```

### 12.3 Session Isolation

- Each judge's WebSocket connection is tagged with `judgeId`
- Server validates all incoming score updates match the authenticated `judgeId`
- Admin socket connections have elevated permissions (can unlock sheets, etc.)

---

## 13. Performance Considerations

### 13.1 Database Optimizations

```sql
-- Enable Write-Ahead Logging for concurrent reads during writes
PRAGMA journal_mode = WAL;

-- Optimize for performance
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000; -- 64MB cache

-- Indexes (already defined in schema)
-- Additional composite indexes if needed:
CREATE INDEX idx_scores_judge_category ON scores(judge_id, category_id);
```

### 13.2 WebSocket Throttling

```javascript
// Server-side: Debounce broadcast for score updates
const debouncedBroadcast = debounce((eventId, data) => {
  io.to(`event_${eventId}`).emit('score_updated', data);
}, 100); // 100ms batch window

// Client-side: Debounce score input
const debouncedSave = debounce(async (score) => {
  await saveToIndexedDB(score);
  await postToServer(score);
}, 250);
```

### 13.3 TanStack Table Virtualization

```javascript
// Only if >100 contestants (unlikely, but good practice)
import { useVirtualizer } from '@tanstack/react-virtual';

const rowVirtualizer = useVirtualizer({
  count: contestants.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 50, // Row height in pixels
});
```

---

## 14. Implementation Phases

### Phase 1: Foundation (Week 1)
**Backend:**
- [ ] Initialize Node.js project, install dependencies
- [ ] Setup Express server with basic routing
- [ ] Implement SQLite database with schema
- [ ] Create seed data script for testing
- [ ] Implement REST API endpoints (Events, Judges, Contestants)

**Frontend:**
- [ ] Initialize React project (Vite + Tailwind)
- [ ] Setup routing (React Router)
- [ ] Create basic layout components (Header, Sidebar)
- [ ] Implement Admin login page

**Deliverable:** Admin can create events, add judges/contestants via UI

---

### Phase 2: Categories & Criteria (Week 2)
**Backend:**
- [ ] REST endpoints for Categories & Criteria CRUD
- [ ] Validation logic (weights sum to 100%, ranges valid)

**Frontend:**
- [ ] Admin UI for category/criteria management
- [ ] Form validation with React Hook Form
- [ ] Display calculated percentages in real-time

**Deliverable:** Admin can configure complete event structure

---

### Phase 3: Judge Scoring Interface (Week 3)
**Backend:**
- [ ] Scores CRUD endpoints
- [ ] Batch score update endpoint
- [ ] Category submission logic

**Frontend:**
- [ ] Judge login page with PIN authentication
- [ ] Category selection screen
- [ ] TanStack Table spreadsheet view
- [ ] Input validation (min/max enforcement)
- [ ] Auto-save to IndexedDB (Dexie.js setup)

**Deliverable:** Judges can score contestants, data saves locally

---

### Phase 4: Real-Time Sync (Week 4)
**Backend:**
- [ ] Socket.io server setup
- [ ] WebSocket authentication middleware
- [ ] Broadcast logic for score updates, submissions
- [ ] Heartbeat mechanism

**Frontend:**
- [ ] Socket.io client integration
- [ ] Real-time score sync to server
- [ ] Connection status indicator
- [ ] Auto-reconnect and conflict resolution

**Deliverable:** Real-time updates working across devices

---

### Phase 5: Admin Monitoring (Week 5)
**Frontend:**
- [ ] Live monitor dashboard
- [ ] Judge progress cards with real-time updates
- [ ] Category lock/unlock controls
- [ ] Manual judge unlock modal
- [ ] Live score preview (click judge → see their sheet)

**Backend:**
- [ ] Admin-specific WebSocket events
- [ ] Unlock endpoint with audit logging

**Deliverable:** Admin can monitor and control judging in real-time

---

### Phase 6: Reporting & Printing (Week 6)
**Backend:**
- [ ] Report generation endpoint (aggregate scores, calculate rankings)
- [ ] SQL queries for efficient aggregation

**Frontend:**
- [ ] Print report component with CSS print styles
- [ ] Dynamic data binding (judges, contestants, scores)
- [ ] Print preview in browser
- [ ] Export to PDF (browser print dialog)

**Deliverable:** Professional print-ready reports per category

---

### Phase 7: Testing & Refinement (Week 7)
- [ ] Unit tests for critical backend logic (score aggregation, validation)
- [ ] E2E tests with Playwright (judge login → score → submit → report)
- [ ] Load testing with 10+ concurrent judges
- [ ] Bug fixes and UX polish
- [ ] Documentation (README, deployment guide)

**Deliverable:** Production-ready application

---

### Phase 8: Deployment & Training (Week 8)
- [ ] Package application for local deployment
- [ ] Create installer script for Admin PC
- [ ] Network configuration guide (LAN setup)
- [ ] User manual (PDF with screenshots)
- [ ] Training session with Admin/Judges

**Deliverable:** App deployed and users trained

---

## Appendix A: Sample Data for Testing

```sql
-- Sample Event
INSERT INTO events (name) VALUES ('Miss Universe 2025');

-- Sample Judges
INSERT INTO judges (event_id, seat_number, name, pin_hash) VALUES
(1, 1, 'John Smith', '$2b$10$...'), -- PIN: 1234
(1, 2, 'Mary Johnson', '$2b$10$...'), -- PIN: 5678
(1, 3, 'Robert Lee', '$2b$10$...'); -- PIN: 9012

-- Sample Contestants
INSERT INTO contestants (event_id, number, name) VALUES
(1, 1, 'Alice Wong'),
(1, 2, 'Betty Chen'),
(1, 3, 'Clara Martinez'),
(1, 4, 'Diana Patel'),
(1, 5, 'Emma Rodriguez');

-- Sample Category
INSERT INTO categories (event_id, name, display_order) VALUES
(1, 'Evening Gown', 1);

-- Sample Criteria
INSERT INTO criteria (category_id, name, weight, min_score, max_score, display_order) VALUES
(1, 'Poise', 0.4, 0, 10, 1),
(1, 'Beauty', 0.6, 0, 10, 2);
```

---

## Appendix B: Error Handling Standards

### API Error Responses
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Total weights must sum to 100%",
    "details": {
      "field": "criteria.weights",
      "current_sum": 95,
      "expected_sum": 100
    }
  }
}
```

### HTTP Status Codes
- `200 OK` - Successful GET
- `201 Created` - Successful POST
- `204 No Content` - Successful DELETE
- `400 Bad Request` - Validation error
- `401 Unauthorized` - Invalid PIN/token
- `404 Not Found` - Resource not found
- `409 Conflict` - Duplicate entry (e.g., contestant number)
- `500 Internal Server Error` - Server fault

---

## Appendix B: PWA (Progressive Web App)

### B.1 Overview
The application is PWA-capable, allowing judge devices to install it as a native-like app. This improves the live event experience by providing a full-screen, standalone experience without browser chrome.

### B.2 Implementation
- **Build Tool:** `vite-plugin-pwa` with `workbox` for service worker generation
- **Manifest:** `manifest.webmanifest` auto-generated during build
- **Service Worker:** Registered via `autoUpdate` strategy — always serves latest build after refresh
- **Dev Mode:** Service worker is **disabled** during development to prevent caching stale assets during active development

### B.3 Caching Strategy (Phase 2 — Initial Scaffold)
- **Precached:** Static assets only (JS, CSS, HTML, icons, SVG)
- **Not Cached:** API routes (`/api/*`), WebSocket connections (`/socket.io/*`)
- **Rationale:** During early development, API contracts and UI are in flux. Aggressive caching causes confusion and stale data.

### B.4 Caching Strategy (Future — Phases 6-8)
Once the app stabilizes, the following will be added:
- **Offline Fallback:** Cached shell for `/` so the app loads without server connectivity
- **Background Sync:** IndexedDB score entries synced via Workbox's Background Sync when reconnecting
- **Stale-While-Revalidate:** API responses cached and served instantly, updated in background
- **Icon Update:** Replace placeholder SVG (`icon.svg`) with proper `192x192` and `512x512` PNG icons

### B.5 Manifest Fields
| Field | Value | Purpose |
|-------|-------|---------|
| `name` | Pageant Tabulator Pro | Full app name |
| `short_name` | PageantPro | Homescreen label |
| `theme_color` | `#18181b` | Status bar / taskbar color (Zinc 950 for dark mode) |
| `background_color` | `#f8fafc` | Splash screen background |
| `display` | `standalone` | Full-screen, no browser UI |
| `start_url` | `/` | Entry point |

### B.6 Production Requirements
Before deploying to production:
- [ ] Replace `icon.svg` with `pwa-192x192.png` and `pwa-512x512.png`
- [ ] Enable `devOptions.enabled: true` in `vite.config.js` for testing service worker behavior
- [ ] Verify `BackgroundSync` queue is functional for offline score entry
- [ ] Test install prompt on judge devices (Chrome on Android, Safari on iOS)

---

## Appendix C: Deployment Checklist

### Production Mode (Recommended for Live Events)

For single-endpoint, stable operation during live events:

```bash
# One-time build (copies client to server/dist)
npm run build

# Start server (serves both API + client from port 3000)
npm run start
```

**Benefits:**
- Single network endpoint (`http://192.168.x.x:3000`) for judges
- More stable with no hot-reloading glitches
- Better PWA offline reliability

### Database Persistence

The server uses SQLite with WAL (Write-Ahead Logging) mode. To prevent data loss on unexpected shutdown:

1. **Automatic checkpoint on startup** — Implemented in `db/init.js`
   - On every server start, pending WAL writes are committed to the main database
   - Protects against Ctrl+C, crashes, or force-kill scenarios

2. **Graceful shutdown recommended:**
   ```bash
   # Use Ctrl+C in terminal to stop server (sends SIGINT)
   # Server will checkpoint WAL before closing
   ```

### Running the Application

| Command | Endpoints | Use Case |
|---------|----------|----------|
| `npm run dev:lan` | Port 5173 (client) + 3000 (server) | Development |
| `npm run build && npm run start` | Port 3000 only | **Live events** |

**Workflow for live event:**
1. `npm run build` — Build client once
2. `npm run start` — Start on port 3000
3. Judges access: `http://[YOUR-LAN-IP]:3000`

---

- [ ] Node.js installed on Admin PC (v18+)
- [ ] Application files copied to Admin PC
- [ ] SQLite database initialized
- [ ] `.env` file configured (PORT, SECRET_KEY)
- [ ] Server started and accessible on LAN
- [ ] Judge devices connected to same network
- [ ] Test login from at least 2 judge devices
- [ ] Verify real-time updates working
- [ ] Test offline scenario (disconnect Wi-Fi, reconnect)
- [ ] Print test report to confirm formatting

---

## Appendix D: Known Limitations

### D.1 Single Active Event Assumption
The `EventSetup` page currently loads only the first active event it finds (`events.find(e => e.status === 'active')`). If the admin creates multiple active events simultaneously, only one will be displayed and configurable at a time.

**Workaround:** Admin can set one event to "archived" before configuring another.

**Impact:** Low for typical use case — most pageants run one event at a time on a single server.

**Fix (future):** Add event switcher in the admin header to select which active event to configure.

### D.2 No Judge Reuse Across Events
Each event maintains its own isolated set of judges. A judge registered for Event A cannot be used for Event B without re-registering. This is **by design** — judges should be scoped per event for audit trail integrity.

### D.3 Data Loss on Unexpected Shutdown
SQLite uses WAL (Write-Ahead Logging) mode for performance. On unexpected server termination (crash, force-quit, or power loss), pending writes in the WAL file may not be committed to the main database.

**Mitigation:**
1. Server performs automatic WAL checkpoint on every startup
2. Manual checkpoint can be triggered via: `PRAGMA wal_checkpoint(TRUNCATE);`
3. Always use `Ctrl+C` for graceful shutdown when possible

---

## Appendix E: Changelog (Iteration 2)

### E.1 Security & Data Integrity (v1.1)
| Change | Description |
|--------|-------------|
| **Category lock enforcement** | `POST /api/scores` and `POST /api/scores/batch` now reject writes to locked or submitted categories (403). |
| **Score range validation** | Scores are validated against each criterion's `min_score`/`max_score` on the server (400 on out-of-range). |
| **Reconnect sync** | Pending unsynced scores are automatically flushed to the server when the WebSocket reconnects. |
| **Audit logging** | All score entries/updates, category submissions, and unlocks write to the `audit_log` table. |
| **Socket.io admin auth** | Admin clients authenticate via `socket.emit('authenticate', { role: 'admin' })`. |

### E.2 API Updates
| Endpoint | Change |
|----------|--------|
| `POST /api/scores` | Returns 403 for locked/submitted categories; 400 for out-of-range scores |
| `POST /api/scores/batch` | Returns `{ saved, errors: [{ index, error }] }` with per-entry validation |
| `POST /api/submissions` | Writes to `audit_log` with action `category_submitted` |
| `POST /api/submissions/unlock` | Writes to `audit_log` with action `category_unlocked` |
| `GET /api/scoring/:judgeId/event/:eventId` | New endpoint for judge scoring context |
| `GET /api/reports/:eventId/category/:categoryId` | Expanded response with full IDs, rankings include `contestant_number` and `contestant_name` |

### E.2 Frontend & UI Updates (v1.1)
| Change | Description |
|--------|-------------|
| **Submitted categories viewable** | Submitted categories are now clickable (View Only) — judges can review but not edit scores |
| **Draft count on category cards** | Shows "X/Y scored" for in-progress categories with amber badge |
| **Category lock/unlock toggle** | Admin Monitor has per-category lock buttons that broadcast `category_locked` via WebSocket |
| **Dynamic seat dropdown** | Judge login fetches actual judges from server; shows "Name (Seat #)" instead of hardcoded 1–20 |
| **Connection status in Judge Portal** | Green/red dot with last-sync tooltip in both category list and spreadsheet headers; offline banner on disconnect |
| **Conflict resolution modal** | On reconnect, compares local vs server scores and prompts to keep local or use server |
| **ScoreSheet re-fetch on reconnect** | `refetchKey` triggers IndexedDB reload when conflict is resolved |
| **Error Boundary** | React Error Boundary wraps entire app with "Try Again" recovery UI |
| **Dynamic contestant addition** | ScoreSheet listens for `contestant_added` socket event and refetches contestants list |
| **AdminMonitor fetch-on-mount** | Progress bars fetch existing scores from server on load instead of initializing to zeros |

### E.3 Production Hardening (v1.2)
| Change | Description |
|--------|-------------|
| **Admin login & session** | `/admin/login` page with configurable `ADMIN_SECRET` env var. Session stored in `sessionStorage`. Protected routes redirect unauthenticated requests. |
| **Socket.io admin validation** | Admin socket connections require `role: 'admin'` + matching `token` in handshake. Rejected connections throw error. |
| **Judge auth rate limiting** | 5 failed PIN attempts per 30s per judge → 429 with retry-after countdown. Resets on successful login. |
| **Cross-event score validation** | `POST /api/scores` rejects if `judge_id` and `category_id` belong to different events (400). |
| **PATCH weight validation** | `PATCH /api/criteria/:criterionId` validates weight 0–1, returns 400 instead of 500. |
| **Dead endpoint guard** | `POST /api/contestants` without `eventId` returns 400 with helpful message. |
| **DB singleton consolidation** | `initDatabase()` and `getDb()` share same connection. No more dual connections. |
| **Queue clearing on success only** | `useAutoSave.flushQueue` only clears pending scores on successful API response. Failed scores stay queued for retry. |
| **ProtectedRoute session bypass fix** | Corrupted `judge_session` now redirects to `/judge/login` instead of granting admin access. |
| **AdminMonitor fetch optimization** | Concurrent fetches use `axios` + `AbortController` with 5s individual timeouts. `Promise.allSettled` prevents blocking. |
| **useCrudResource api fix** | `api` held in `useRef` to prevent infinite re-fetch when callers don't memoize. Removed from `useCallback` deps. |
| **Live score preview** | Admin Monitor has Eye icon per judge+category. Click opens modal showing judge's draft scores as matrix (criteria × contestants). |
| **`.env.example` created** | Deployment reference with `PORT` and `ADMIN_SECRET` variables. |

### E.4 Enhanced Reports Module (v1.3)
| Change | Description |
|--------|-------------|
| **Report caching** | In-memory cache with configurable TTL (`REPORT_CACHE_TTL_MS` env var, default 5 min). Cache invalidated on score updates. |
| **Cross-category reports** | New `POST /api/reports/:eventId/cross-category` endpoint with rank-sum aggregation. |
| **Elimination rounds** | New `elimination_rounds` and `round_qualifiers` tables for tracking competition phases. |
| **Report save/load** | `POST /api/reports/save` and `GET /api/reports/saved` for saving report configurations. |
| **Report history sidebar** | Collapsible sidebar in PrintReport showing saved reports with regenerate/delete actions. |
| **Landscape print** | Print CSS updated to `@page { size: landscape; margin: 1cm }` for better table formatting. |
| **Audit logging** | Reports generate audit log entries (`report_generated`, `report_saved`, `report_deleted`). |

### E.5 API Updates (v1.3)
| Endpoint | Change |
|----------|-------|
| `GET /api/reports/:eventId/category/:categoryId` | Added `_cached` boolean in response |
| `POST /api/reports/:eventId/cross-category` | New endpoint for rank aggregation |
| `POST /api/reports/save` | Save report configuration |
| `GET /api/reports/saved?event_id=X` | List saved reports for event |
| `DELETE /api/reports/saved/:id` | Delete a saved report |

### E.6 UI/UX Overhaul (v1.5) - In Progress
| Change | Description |
|--------|-------------|
| **Theme system** | Rose Gold + Mauve color palette with CSS variables for dark/light mode |
| **Touch-first design** | 48px minimum touch targets, 56px score inputs for iPad/mobile |
| **ConfirmDialog component** | Reusable confirmation modal with danger variant |
| **ConflictModal component** | Shows local vs server score counts. Buttons: "Use Server Scores" / "Keep My Scores" |
| **SubmitConfirmModal component** | Confirms category submission with warning |
| **Loading states** | Added loading indicators to EventSetup, PrintReport components |
| **Select All/Clear All** | Category selection helpers for multi-category reports |
| **Category weight field** | Cross-category reports support weighted aggregation |
| **Admin login persistence** | Session persists across browser sessions |
| **Theme toggle** | Dark/light mode toggle in AdminLogin |
| **Server-side validation** | Criteria weights must total 100% |
| **Multi-event ownership** | DELETE endpoints verify event_id ownership |
| **Delete fix** | Fixed ConfirmDialog not rendering - added `open` prop |
| **SortableTable component** | Reusable sortable table with column sort, row click handlers |
| **EliminationRoundManager** | Create/manage elimination rounds with QualifierSelector modal |
| **Skeleton loading** | Loading skeleton component |
| **Tabulators field** | Event tabulator names for report signatures |
| **Live score preview** | Admin Monitor eye icon opens modal showing judge's draft scores |
| **Keyboard shortcuts** | J/K to cycle tabs, Cmd+S to save in AdminDashboard |
| **Report cache** | In-memory cache with configurable TTL, invalidation on score updates |

### E.7 API Updates (v1.5)
| Endpoint | Change |
|----------|--------|
| `DELETE /api/events/:eventId/categories/:categoryId` | Added event_id ownership check |
| `DELETE /api/categories/:categoryId/criteria/:criterionId` | Added category_id ownership check |
| `DELETE /api/events/:eventId/contestants/:id` | Added event_id ownership check |
| `DELETE /api/events/:eventId/judges/:judgeId` | Already has event_id check |
| `POST /api/elimination-rounds` | Create elimination round |
| `GET /api/elimination-rounds?event_id=X` | List rounds for event |
| `GET /api/elimination-rounds/:roundId/qualifiers` | Get qualifiers for round |
| `DELETE /api/elimination-rounds/:roundId?event_id=X` | Delete round with event ownership check |
| `GET /api/scores?judge_id=X&category_id=Y` | Get all scores for judge+category |
| `POST /api/reports/:eventId/cross-category` | Rank aggregation with weights |
| `POST /api/reports/save` | Save report configuration |
| `GET /api/reports/saved?event_id=X` | List saved reports |
| `DELETE /api/reports/saved/:id` | Delete saved report |

### E.8 New Database Schema (v1.5)
| Table/Column | Schema |
|--------------|--------|
| `categories.weight` | FLOAT DEFAULT 1 - weight for cross-category reports |
| `events.tabulators` | JSON - array of tabulator names |
| `saved_reports` | event_id, report_type, categories, title, config, created_at |
| `elimination_rounds` | event_id, round_name, round_order, contestant_count, based_on_report_id |
| `round_qualifiers` | round_id, contestant_id, qualified_rank |

### E.9 New Client Hooks (v1.5)
| Hook | Description |
|------|-------------|
| `useAutoSave` | Debounced auto-save with 250ms delay, batch POST, conflict detection |
| `useOfflineScores` | IndexedDB scores management, isSubmitted tracking, merge server/local |
| `useCrudResource` | Generic CRUD hook (getAll/create/update/delete) |
| `useHotkeys` | Global keyboard shortcuts (J/K tabs, Cmd+S save) |

### E.10 New WebSocket Events (v1.5)
| Event | Direction | Description |
|-------|----------|------------|
| `reconnect` | Client→Server | Client reconnected after disconnect |
| `connection_lost` | Server→Client | Heartbeat timeout detected |
| `sheet_unlocked` | Server→Specific Judge | Admin unlocked their sheet |

---

## Appendix F: Theme System & Design Guidelines

### F.1 Color Palette

#### Light Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#e8b4b8` | Rose Gold - primary accent |
| `--color-secondary` | `#c4a5ca` | Mauve - secondary accent |
| `--color-cta` | `#d66d75` | Deeper Rose - CTAs and buttons |
| `--color-bg` | `#ffffff` | Page background |
| `--color-bg-subtle` | `#fafaf9` | Stone 50 - card backgrounds |
| `--color-text` | `#18181b` | Zinc 950 - primary text |
| `--color-text-muted` | `#71717a` | Zinc 500 - secondary text |

#### Dark Mode
| Token | Hex | Usage |
|-------|-----|-------|
| `--color-primary` | `#e8b4b8` | Rose Gold - primary accent |
| `--color-secondary` | `#c4a5ca` | Mauve - secondary accent |
| `--color-cta` | `#f472b6` | Pink 400 - brighter CTAs in dark |
| `--color-bg` | `#18181b` | Zinc 950 - page background |
| `--color-bg-subtle` | `#27272a` | Zinc 900 - card backgrounds |
| `--color-text` | `#fafafa` | Zinc 50 - primary text |
| `--color-text-muted` | `#a1a1aa` | Zinc 400 - secondary text |

### F.2 Responsive Breakpoints
| Breakpoint | Width | Target |
|------------|-------|--------|
| Mobile | <640px | Single column, stacked controls |
| Tablet | 640-1024px | Judge portal primary target |
| Desktop | >1024px | Admin dashboard, data-dense views |

### F.3 Touch Guidelines
| Element | Minimum Size |
|---------|--------------|
| Buttons | 48x48px height |
| Score inputs | 56px height |
| Form inputs | 48px height |
| Category cards | Full-width, 64px min height |
| Table cells (touch) | 48px min height |

### F.4 Animation Standards
| Type | Duration | Easing |
|------|----------|--------|
| Transitions | 150-200ms | ease-out |
| Button hover | 150ms | ease |
| Modal enter | 200ms | cubic-bezier(0.16, 1, 0.3, 1) |
| Tab indicator | 200ms | ease-in-out |
| Toast slide | 300ms | ease-out |

---

**END OF SPECIFICATION**
