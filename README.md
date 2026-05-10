# VocabMaster

A classroom vocabulary learning platform built for teachers and students. Teachers create vocabulary modules with cards, audio, and translations. Students study via flashcards, matching games, and spelling practice -- all from a browser on any device.

Made with ❤️ by Kai Kwong Kan @ Bunorden (www.bunorden.com)

---

## Before You Start

You need two free accounts:

- **Firebase** (Google account) -- for authentication and the Firestore database
- **Cloudflare** (free account) -- for R2 object storage (audio files)

Both have generous free tiers that cover this project at classroom scale.

---

## Step 1: Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/) and create a new project called **mkpeng-db**.
2. Stay on the **Spark (free) plan** -- do not upgrade to Blaze.
3. Under **Build > Authentication**, enable **Anonymous** and **Email/Password** sign-in providers.
4. Under **Build > Firestore Database**, create a database. Start in **production mode** (rules will be deployed later). Pick the region closest to your users.

> **Free tier limits (Spark plan):** 1 GiB storage, 50K reads/day, 20K writes/day. This is enough for a typical classroom deployment.

---

## Step 2: Cloudflare R2 Setup

1. Log in to [Cloudflare Dashboard](https://dash.cloudflare.com/).
2. Navigate to **R2 Object Storage** in the left sidebar.
3. Create a new bucket (any name you like, e.g. `vocabmaster-audio`).
4. Note your **Account ID** (shown on the right sidebar of the R2 page).
5. Create an **API token** with R2 read/write permissions.
6. Copy the **Access Key ID** and **Secret Access Key** -- you will need them in the next step.
7. Set a **public base URL** for the bucket (see `setup.md` for detailed instructions).

> **Free tier limits (R2):** 10 GB storage, 10M Class A operations/month, 10M Class B operations/month.

---

## Step 3: Environment Variables

```bash
cp .env.local.example .env.local
```

Open `.env.local` and fill in the values from Steps 1 and 2. You will need:

- Firebase project config (API key, auth domain, project ID, etc.)
- Cloudflare R2 credentials (account ID, access key, secret key, bucket name, public URL)
- A crypto key (see Step 4)

---

## Step 4: Generate Encryption Key

Run this command and paste the output into `NEXT_PUBLIC_CRYPTO_KEY` in `.env.local`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This key is used to encrypt sensitive student data before it is stored in Firestore.

---

## Step 5: Install and Run

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Step 6: Deploy Firestore Rules and Indexes

```bash
firebase deploy --only firestore:rules,firestore:indexes
```

This deploys the security rules and composite indexes required by the app. Without this step, Firestore queries will fail and the app will not function correctly.

---

## Step 7: Create a Teacher Account

1. Open the [Firebase Console](https://console.firebase.google.com/) and go to your **mkpeng-db** project.
2. Navigate to **Authentication > Users** and click **Add user**.
3. Enter an email address and password, then confirm.
4. Go to **Firestore Database** and create a new document in the **users** collection.
5. Set the document ID to the user's **UID** (visible in the Authentication > Users table).
6. Add a field: `role` = `"teacher"` (string).
7. You can also add `displayName` and `email` fields for convenience.

You can now log in at `/teacher/login` with these credentials.

---

## Step 8: Create Your First Class

1. Log in as a teacher.
2. Navigate to `/teacher/classes`.
3. Click **Create Class** and fill in the class name, year, and other details.
4. The class code generated here is what students use to log in.

---

## Step 9: Create Your First Module and Cards

1. From the teacher dashboard, go to **Modules**.
2. Create a new module (give it a name, set the target language, etc.).
3. Add cards to the module -- each card has a front (word/term), back (definition/translation), and optional audio.
4. Upload audio files directly in the card editor (stored in Cloudflare R2).
5. Publish the module when ready (students can only see published modules).

---

## Step 10: Deploy for Production

```bash
firebase deploy
```

This deploys the Next.js app to Firebase Hosting (or your configured hosting target).

---

## Step 11: Test on a Student Device

1. Open the app URL on a student device (iPad, phone, or laptop).
2. Select a class from the dropdown, enter a student number and name.
3. Verify that the student can:
   - See published modules
   - Study flashcards (flip and navigate)
   - Play the matching game
   - Complete spelling practice
   - View their profile and progress
4. Test audio playback to confirm R2 integration is working.

---

## Free Tier Reference

| Service | Free Tier Limit |
|---|---|
| **Firestore (Spark)** | 1 GiB storage, 50K reads/day, 20K writes/day |
| **Cloudflare R2** | 10 GB storage, 10M Class A ops/month, 10M Class B ops/month |

These limits are more than sufficient for a single classroom or small school deployment.

---

## Troubleshooting

### App shows blank page or crashes on load
- Check that `.env.local` exists and all required values are filled in.
- Make sure `NEXT_PUBLIC_CRYPTO_KEY` is set to the hex string from Step 4.

### Authentication fails
- Confirm **Anonymous** and **Email/Password** providers are enabled in Firebase Console > Authentication > Sign-in method.
- Check that the teacher user document exists in the `users` Firestore collection with `role: "teacher"`.

### Firestore permission denied errors
- Run `firebase deploy --only firestore:rules` to deploy the latest security rules.
- Verify the Firebase project ID in `.env.local` matches your actual project.

### Audio does not play
- Check Cloudflare R2 bucket name and public URL in `.env.local`.
- Ensure the API token has **read and write** permissions.
- Verify the audio file was uploaded successfully (check the R2 bucket dashboard).

### Student class dropdown is empty
- Make sure at least one class exists in the Firestore `classes` collection.
- Deploy Firestore indexes: `firebase deploy --only firestore:indexes`.

### Firebase CLI not found
```bash
npm install -g firebase-tools
firebase login
```

### Build errors after cloning
```bash
npm install
# Make sure .env.local is configured before running:
npm run dev
```

---

Made with ❤️ by Kai Kwong Kan @ Bunorden (www.bunorden.com)
