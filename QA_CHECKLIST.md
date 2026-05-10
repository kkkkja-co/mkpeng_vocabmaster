# VocabMaster -- QA Checklist

A comprehensive checklist for verifying every feature of the VocabMaster platform before classroom deployment.

Made with ❤️ by Kai Kwong Kan @ Bunorden (www.bunorden.com)

---

## Firebase Project Setup

- [ ] Firebase project **mkpeng-db** created and confirmed
- [ ] **Spark (free) plan** confirmed -- no upgrade to Blaze
- [ ] Authentication providers enabled: **Anonymous** and **Email/Password**
- [ ] Firestore database created in production mode

## No Paid Firebase Services Used

- [ ] No Firebase Storage used (audio is stored in Cloudflare R2)
- [ ] No Cloud Functions used
- [ ] No Blaze plan required

## Environment Variables

- [ ] `.env.local` created from `.env.local.example`
- [ ] All Firebase config values filled in (API key, auth domain, project ID, etc.)
- [ ] All Cloudflare R2 values filled in (account ID, access key, secret key, bucket, public URL)
- [ ] `NEXT_PUBLIC_CRYPTO_KEY` set to a valid 64-character hex string

## Firestore Rules and Indexes

- [ ] Firestore rules deployed: `firebase deploy --only firestore:rules`
- [ ] Firestore indexes built and enabled: `firebase deploy --only firestore:indexes`

## Cloudflare R2

- [ ] R2 bucket created
- [ ] API token with R2 read/write permissions created
- [ ] Access Key ID and Secret Access Key stored in `.env.local`
- [ ] Public base URL configured for the bucket

---

## Audio Upload

- [ ] Teacher can upload audio files in the card editor
- [ ] Audio files are stored in Cloudflare R2 (not Firebase Storage)
- [ ] Student can hear audio playback on study cards

## Encryption

- [ ] Firestore documents show **encrypted strings**, not plaintext
- [ ] Sensitive student data is encrypted before storage
- [ ] Decryption works correctly on read (data displays properly in the app)

---

## Student Authentication

- [ ] Anonymous login works with class selection, student number, and name
- [ ] Student login class dropdown is populated from Firestore
- [ ] Invalid class codes are rejected with appropriate feedback

## Teacher Authentication

- [ ] Email/password login works at `/teacher/login`
- [ ] Teacher user document exists in `users` collection with `role: "teacher"`
- [ ] Non-teacher users are denied access to teacher routes

---

## Class Management

- [ ] Class creation works from teacher dashboard (`/teacher/classes`)
- [ ] Classes can be edited and deleted (CRUD operations)
- [ ] Class codes are generated and usable for student login

## Module and Card Management

- [ ] Teacher can create a new module
- [ ] Teacher can edit module details
- [ ] Teacher can publish a module (only published modules are visible to students)
- [ ] Teacher can create, edit, and delete cards within a module
- [ ] Teacher can upload audio to individual cards

---

## Student Study Flow

- [ ] Cards page loads with the correct module's cards
- [ ] Flashcard flip animation works
- [ ] Card navigation (next/previous) works
- [ ] Progress is tracked as the student studies

## Match Game

- [ ] Match game loads and displays card pairs
- [ ] Matching mechanics work correctly (tap/click to pair)
- [ ] Game completion is detected and score is shown

## Spelling Practice

- [ ] Spelling practice loads words from the module
- [ ] Input validation works (correct/incorrect feedback)
- [ ] Spelling scores are recorded

## Reading Support

- [ ] Reading support page loads correctly
- [ ] Content displays as expected

## Profile and Progress

- [ ] Profile page shows student progress
- [ ] Progress data reflects actual study activity
- [ ] Module completion status is displayed correctly

---

## Teacher Console -- Dashboard

- [ ] Dashboard loads with KPIs (key performance indicators)
- [ ] KPI data is accurate and up to date

## Teacher Console -- Class Management

- [ ] Can create new classes
- [ ] Can edit existing classes
- [ ] Can delete classes
- [ ] Student roster is displayed per class

## Teacher Console -- Student Roster

- [ ] Student roster is searchable
- [ ] Student data is displayed correctly

## Teacher Console -- Module Management

- [ ] Can create new modules
- [ ] Can edit module details
- [ ] Can publish/unpublish modules
- [ ] Can manage cards within modules

## Teacher Console -- Card Editor

- [ ] Card editor opens and displays fields correctly
- [ ] Audio upload works from within the card editor
- [ ] Changes are saved to Firestore

## Teacher Console -- Analytics

- [ ] Analytics page loads with student and module data
- [ ] Charts or metrics are displayed accurately

---

## Battle Mode

- [ ] Teacher can create a battle room and receive an invite code
- [ ] Student can join a battle using the invite code
- [ ] Countdown timer works and starts the battle correctly
- [ ] Students can answer questions during the battle
- [ ] Scoring is correct (correct answers earn points)
- [ ] Live leaderboard updates in real time for all participants
- [ ] Results screen displays at the end with confetti animation

---

## Responsive Design

- [ ] **iPad** -- layout is responsive and usable (landscape and portrait)
- [ ] **Phone** -- layout is responsive and usable
- [ ] **Computer** -- full layout displays correctly at standard screen sizes

---

## Accessibility

- [ ] `prefers-reduced-motion` is respected (animations disabled when user preference is set)

---

## Pages and Navigation

- [ ] Footer is present on all pages with correct credit text
- [ ] Privacy Policy page exists at `/privacy` and loads correctly
- [ ] Terms of Use page exists at `/terms` and loads correctly

---

## Pre-Class Module Publishing

- [ ] Steps for publishing a module before class are documented

---

## Final Verification

- [ ] Full end-to-end flow works: teacher creates class and module, student logs in, studies cards, plays match game, completes spelling practice, views profile
- [ ] No console errors on any page
- [ ] All audio plays without errors

---

Made with ❤️ by Kai Kwong Kan @ Bunorden (www.bunorden.com)
