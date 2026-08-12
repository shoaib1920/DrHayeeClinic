# Dr. Abdul Hayee Medical Centre — Clinic Management System

Clinic management app for a busy walk-in general physician clinic in Nankana
Sahib. Built with Next.js (App Router) + TypeScript + Tailwind + shadcn/ui,
backed by Firebase (Firestore + Auth). Runs entirely on Firebase's free Spark
plan — no paid services required. Deploys to Vercel.

The app is split into **four panels, one per station**, mirroring how the
clinic already works. Each person logs in and sees only their own screen.

| Station | Role key | Screen | What they do |
| --- | --- | --- | --- |
| Token desk | `reception` | `/queue` | Register the patient, issue the token, **take the consultation fee** |
| Cabin door | `attendant` | `/attendant` | Hold the tokens, send patients in one by one |
| Doctor | `doctor` | `/consultation` | Consult, **print the slip and write medicines by hand**, order lab tests |
| Laboratory | `lab` | `/lab` | **Take the separate lab fee**, collect samples, enter results |

The doctor also has `/dashboard`, `/closing` and `/settings`. `/patients` (search
and full history) is available to reception, the doctor and the lab.

## Two cash drawers, kept separate

Money is collected at **two separate counters by two different people**:

- **Consultation fee** — taken by reception at the token desk, before the doctor.
- **Lab fee** — taken by the lab technician at the lab counter, only if tests were ordered.

They are never merged into one bill. Each station sees its own drawer total;
`/closing` (the end-of-day sheet) shows both side by side plus a per-staff
breakdown of who collected what.

## Prescriptions are handwritten

The doctor does not type medicines. **Print Prescription Slip** prints the
clinic form with the patient's name, age, token, date and vitals already
filled in, leaving a ruled ℞ area to write on by hand.

## QR codes — scan any printed document to open the patient's history

Every printable document (token slip, prescription slip, lab report, receipt,
patient card) carries a QR code. Scanning it opens `/patients/{id}` — the
full record: history, complaint, diagnosis, vitals, past lab results and
payments — directly on whoever scanned it.

- **Works with a phone camera** — any QR scanner app opens the link in the browser.
- **Works with a handheld USB/Bluetooth scanner** — those "type" the scanned
  URL into whatever's focused. The `/patients` search box specifically
  detects a pasted/typed patient URL and jumps straight to that record
  instead of searching for the literal text.
- **Generated entirely client-side** (the `qrcode` package) — no network call,
  so it still works when the clinic's internet is down.
- **If the scanning device isn't logged in**, it's sent to `/login` first and
  then straight to the patient afterward — it doesn't dead-end at a generic
  home screen.

The QR only encodes a URL (the record itself never leaves Firestore), and
Firestore's rules still require the scanner to be signed in as staff before
anything renders.

## Prerequisites

- Node.js 20+
- A Firebase project on the free Spark plan

## 1. Install dependencies

```bash
npm install
```

## 2. Create the Firebase project

1. [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. Enable **Firestore Database** (production mode) and **Authentication →
   Email/Password**. Cloud Storage is not used — everything runs on the free plan.
3. Project Settings → **Your apps** → add a **Web app** → copy the config.

## 3. Add your config

Copy `.env.local.example` to `.env.local` and fill in the six
`NEXT_PUBLIC_FIREBASE_*` values from step 2. Leave
`NEXT_PUBLIC_USE_FIREBASE_EMULATORS=false` unless you're running local
emulators. Restart the dev server after editing this file.

## 4. Create the staff logins

**Authentication → Users → Add user**, one per station (e.g.
`reception@ahmc.local`, `attendant@ahmc.local`, `doctor@ahmc.local`,
`lab@ahmc.local`). Copy each account's **User UID**.

## 4b. Give each login its role

Roles live in Firestore, not Authentication, and are written by you — the app
can never change its own role. For each user, in **Firestore Database → Start
collection**:

- Collection ID: `staff`
- **Document ID: the account's User UID** (not Auto-ID)
- Fields: `role` (string — exactly `reception`, `attendant`, `doctor`, or
  `lab`), `name` (string), `email` (string)

If you sign in before doing this, the app shows a **"No role assigned yet"**
screen with that account's UID on it, so you can copy it straight in.

## 5. Deploy the security rules and indexes

```bash
npx firebase login
npm run firebase:deploy-rules
```

This deploys `firestore.rules` and `firestore.indexes.json` together. Skip
this and the app will log in fine but most screens will fail with "query
requires an index." Indexes take 2–5 minutes to build — check **Firestore →
Indexes** until they all read **Enabled**.

## 6. Run it

```bash
npm run dev
```

Open http://localhost:3000 and log in with one of the accounts from step 4.

## 7. Deploy to Vercel

Import the repo, add the same six `NEXT_PUBLIC_FIREBASE_*` variables under
**Project Settings → Environment Variables**. `npm run build` is the build
command; no other configuration is needed.

---

## Data model

Firestore collections (types in `src/types/`):

| Collection | Purpose |
| --- | --- |
| `patients` | Permanent patient profiles — MR number, demographics, allergies, chronic conditions |
| `visits` | One per patient per day — daily token number, status, diagnosis, vitals, follow-up date |
| `counters/{YYYY-MM-DD}` \| `counters/mrNo` | Internal: daily token counter and the MR number sequence |
| `labOrders` | Tests ordered per visit, plus their results |
| `bills` | One doc per payment, `type: "consultation" \| "lab"` — the two drawers |
| `settings/clinic` | Consultation fee, lab price list, quick-pick diagnoses — editable by the doctor |
| `staff` | Staff profile + role, keyed by Firebase Auth UID (read-only from the app) |

There is no `prescriptions` collection: the doctor writes medicines by hand on
the printed slip, so they are never stored digitally.

### Duplicate patients

The patient profile flags other records sharing a phone number and can merge
them. A merge sets `mergedInto` on the duplicate rather than moving its data —
visits and bills keep pointing at their original patient ID, and the profile
screen reads history across the primary plus everything merged into it. This
keeps a merge a single write, since the security rules deliberately stop
reception from touching lab bills (and vice versa).

## Security rules

`firestore.rules` enforces the same split as the UI, so a station can't write
another station's data even if someone edits the URL:

| Collection | Who can write |
| --- | --- |
| `patients` | reception, doctor |
| `visits` | reception (create), attendant + doctor (update) |
| `counters` | reception |
| `labOrders` | doctor (create), lab (results) |
| `bills` | reception → `consultation` only; lab → `lab` only |
| `settings` | doctor only |
| `staff` | nobody — admin writes these in the console |

Roles are read from `/staff/{uid}`, which the app can never write, so an
account cannot promote itself. Nothing is deletable.

## Optional: local emulators

Requires the Firebase CLI and a working Java installation.

```bash
npm run firebase:emulators
```

Set `NEXT_PUBLIC_USE_FIREBASE_EMULATORS=true` in `.env.local` and restart the
dev server. Add a test user via the Emulator UI at http://127.0.0.1:4000.
Emulator data resets when the process stops unless you export it.

## Notes

- Firestore offline persistence is enabled, so the queue screen keeps working
  through short connectivity drops at the front desk.
- Name, complaint, diagnosis, and address fields accept Urdu script; the
  consultation textareas switch to RTL automatically when Urdu is typed.
- Printing opens a formatted slip in a new window and calls the browser's
  print dialog — it does not generate a PDF file.
- WhatsApp sharing and follow-up reminders open a `wa.me` link with the
  message prefilled as text.

## Useful commands

```bash
npm run dev                     # start the dev server
npm run build                   # production build
npm run typecheck               # TypeScript, no emit
npm run lint                    # ESLint
npm run firebase:deploy-rules   # deploy rules + indexes
```
