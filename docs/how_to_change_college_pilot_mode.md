# How to Change College Pilot Mode

This guide provides step-by-step instructions for enabling or disabling **College Pilot Mode** in Rentitout, both locally and in deployed environments.

---

## 1. Changing Locally (Development)

College Pilot Mode is controlled via the `VITE_COLLEGE_PILOT_MODE` variable in your local environment file.

### Step 1: Open `.env`
Open the `.env` file in the project root directory.

### Step 2: Set the Variable
Add or modify the `VITE_COLLEGE_PILOT_MODE` variable:

- **To Enable College Pilot Mode:**
  ```env
  VITE_COLLEGE_PILOT_MODE=true
  ```

- **To Disable College Pilot Mode (Return to Normal):**
  ```env
  VITE_COLLEGE_PILOT_MODE=false
  ```

### Step 3: Restart Dev Server
Because Vite loads environment variables at startup, restart your local development server:
```bash
# In your terminal:
Ctrl + C
npm run dev
```

---

## 2. Changing in Production (Vercel Deployment)

Because Vite embeds variables prefixed with `VITE_` into the static frontend bundle during build time, updating the variable on Vercel requires triggering a redeploy.

### Step 1: Open Vercel Project Settings
1. Go to your [Vercel Dashboard](https://vercel.com/dashboard).
2. Select your **Rentitout** project.
3. Click on the **Settings** tab.

### Step 2: Update Environment Variables
1. Click **Environment Variables** in the left sidebar.
2. Locate or add `VITE_COLLEGE_PILOT_MODE`:
   - **Key:** `VITE_COLLEGE_PILOT_MODE`
   - **Value:** `true` (to enable) or `false` (to disable)
   - **Environments:** Select **Production**, **Preview**, and **Development** as needed.
3. Click **Save**.

### Step 3: Trigger a Redeploy
The changes will not appear on the live site until the frontend is rebuilt.
1. Navigate to the **Deployments** tab in Vercel.
2. Find the latest production deployment.
3. Click the three dots (`...`) menu on the right.
4. Click **Redeploy**.
5. Once the build finishes, the new mode will be live.

---

## 3. Verification Checklist

### When College Pilot Mode is Enabled (`true`):
- [ ] College Pilot banner appears across the site.
- [ ] Checkout provides "Cash / Pay in Person" as an offline alternative.
- [ ] Online Razorpay payment is safely bypassed for pilot testing.

### When College Pilot Mode is Disabled (`false`):
- [ ] Pilot banner disappears.
- [ ] Standard checkout and booking flow is restored.
- [ ] No database schema rollbacks or migration reversions are required.

---

## 4. Critical Safety Rule

> **Important:**
> The `VITE_COLLEGE_PILOT_MODE` variable only toggles the frontend user experience and offline payment options.
> In your **Supabase Edge Functions / Secrets**, keep:
> ```env
> RAZORPAY_ENVIRONMENT=sandbox
> ```
> Live production real-money movement remains strictly disabled until formal commercial launch approval.
