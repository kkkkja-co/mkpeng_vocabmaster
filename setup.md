# Cloudflare R2 Setup Guide for VocabMaster

This guide walks you through setting up Cloudflare R2 (object storage) for VocabMaster. R2 stores the audio files that teachers upload for vocabulary cards. The free tier is generous enough for classroom use.

Made with ❤️ by Kai Kwong Kan @ Bunorden (www.bunorden.com)

---

## 1. Create a Cloudflare Account

1. Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up).
2. Sign up with an email address, or use a Google/GitHub account.
3. Complete the email verification process.
4. You do not need to add a domain or purchase any plan. The free tier is sufficient.

---

## 2. Navigate to R2 in the Dashboard

1. Once logged in, you will see the Cloudflare dashboard home.
2. In the left sidebar, scroll down and click **R2 Object Storage**.
3. If this is your first time using R2, you may see an introductory page. Click **Get Started** or **Create bucket** to proceed.

---

## 3. Create an R2 Bucket

1. On the R2 page, click **Create bucket**.
2. Choose a bucket name (e.g. `vocabmaster-audio`). Bucket names must be globally unique within your account.
3. Select a **location** closest to your users (e.g. APAC, ENAM, WEUR).
4. Leave **Object-level storage class** as the default.
5. Click **Create bucket**.
6. Note the bucket name -- you will need it for your `.env.local` file.

---

## 4. Find Your Account ID

1. On the R2 overview page, look at the **right sidebar** (or the top-right corner on smaller screens).
2. You will see your **Account ID** displayed there. It is a 32-character alphanumeric string.
3. Copy this value -- it goes into `CLOUDFLARE_ACCOUNT_ID` in your `.env.local`.

---

## 5. Create an API Token

1. In the R2 dashboard, click **Manage R2 API Tokens** (or navigate to **Manage Account > API Tokens** from the top-right account menu).
2. Click **Create API token**.
3. Give the token a descriptive name (e.g. `vocabmaster-r2`).
4. Under **Permissions**, select **Object Read & Write**. This allows the app to upload and retrieve audio files.
5. Under **Specify bucket(s)**, select the bucket you created in Step 3 (e.g. `vocabmaster-audio`).
6. Leave **TTL** as the default (no expiration) unless you prefer a time-limited token.
7. Click **Create API Token**.
8. On the confirmation screen, you will see:
   - **Access Key ID** -- copy this
   - **Secret Access Key** -- copy this immediately (it will not be shown again)
9. Store both values securely. They go into your `.env.local` file.

---

## 6. Set the Public Base URL

Your audio files need a publicly accessible URL so students can play them in the browser.

### Option A: Use R2.dev Public Access (Simplest)

1. In your R2 bucket dashboard, go to **Settings**.
2. Scroll down to **Public Access** (or **R2.dev subdomain**).
3. Click **Allow Access** to enable the R2.dev public URL for this bucket.
4. The public base URL will be in the format:
   ```
   https://<ACCOUNT_ID>.r2.dev/<BUCKET_NAME>
   ```
   or:
   ```
   https://pub-<HASH>.r2.dev
   ```
5. Copy this URL and set it as `CLOUDFLARE_R2_PUBLIC_URL` in your `.env.local`.

### Option B: Use a Custom Domain

1. In the R2 bucket **Settings**, go to **Custom Domains**.
2. Add a custom domain you own (e.g. `audio.yourdomain.com`).
3. Follow the DNS verification steps.
4. Use that custom domain as your public base URL.

---

## 7. Testing the R2 Connection

After configuring `.env.local` with your R2 credentials:

1. Start the dev server:
   ```bash
   npm run dev
   ```
2. Log in as a teacher.
3. Open a module and edit or create a card.
4. Upload an audio file (e.g. an MP3 or WAV file).
5. Check the upload succeeds without errors.
6. Log in as a student and navigate to the same card.
7. Play the audio -- if it plays, R2 is configured correctly.
8. Optionally, log in to the Cloudflare dashboard and check the R2 bucket to confirm the uploaded file appears there.

---

## Common Issues and Fixes

### "Access Denied" when uploading audio
- The API token may not have **write** permissions. Create a new token with **Object Read & Write** permissions.
- The token may be scoped to a different bucket. Make sure the token is configured for your `vocabmaster-audio` bucket.

### Audio files upload but do not play for students
- The R2 bucket may not have public access enabled. Go to **Bucket Settings > Public Access** and enable the R2.dev subdomain.
- The `CLOUDFLARE_R2_PUBLIC_URL` in `.env.local` may be incorrect. Double-check the URL format.
- CORS may be blocking playback. Add a CORS policy to the bucket:

  Go to **Bucket Settings > CORS Policy** and add:
  ```json
  [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedHeaders": ["*"]
    }
  ]
  ```

### Bucket not appearing when creating API token
- Make sure you are in the same Cloudflare account that owns the bucket.
- Refresh the page if the bucket list has not loaded.

### "Invalid Account ID" error
- The Account ID is the 32-character string in the right sidebar of the R2 page, not your Cloudflare username or email.
- Make sure there are no extra spaces or characters when pasting into `.env.local`.

### Secret Access Key lost
- Cloudflare only shows the Secret Access Key once at creation time. If you lost it, create a new API token and copy the new key.

### CORS errors in the browser console
- Add the CORS policy shown above. Also make sure `AllowedOrigins` includes your app's domain (or use `["*"]` for development).

### R2 bucket hits storage limit
- The free tier provides 10 GB of storage. Check the **R2 Analytics** page in the Cloudflare dashboard to see current usage.
- Delete unused audio files from the bucket if needed.

### Public URL returns 404
- Verify the file exists in the bucket (check the R2 dashboard object list).
- Make sure the public URL format is correct: `https://<public-url>/<filename>`.

---

## .env.local Reference (R2 Section)

```env
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
CLOUDFLARE_R2_ACCESS_KEY_ID=your_access_key_id_here
CLOUDFLARE_R2_SECRET_ACCESS_KEY=your_secret_access_key_here
CLOUDFLARE_R2_BUCKET_NAME=vocabmaster-audio
CLOUDFLARE_R2_PUBLIC_URL=https://your-public-url-here.r2.dev
```

---

Made with ❤️ by Kai Kwong Kan @ Bunorden (www.bunorden.com)
