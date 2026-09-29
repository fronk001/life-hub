# Setting up sync (Firebase)

This connects Life Hub to a small online database of your own, so your laptop
and (Part 2, below) your phone share the same ticks. It's free: Google's
"Spark" plan, no card needed.

You do the clicks in the Firebase console; it takes about 15 minutes. Claude
never sees your password, and doesn't need to.

Everything happens at **https://console.firebase.google.com**, signed in with
your usual Google account. Google renames buttons now and then; if a label
below doesn't match exactly, look for the nearest equivalent.

---

## 1. Create the project

1. Click **Create a project** (or **Get started with a Firebase project**).
2. Name it **life-hub** and accept the terms.
3. When it offers **Gemini in Firebase** and **Google Analytics**, switch both
   off. Life Hub needs neither.
4. Click **Create project**, wait, then **Continue**.

## 2. Register Life Hub as a web app, and copy its settings

1. On the project's home page (**Project Overview**), click the **Web** icon.
   It looks like `</>`.
2. Nickname: **Life Hub**. Leave "Also set up Firebase Hosting" **unticked**.
3. Click **Register app**.
4. It suggests `npm install firebase`: ignore that, Life Hub doesn't need it.
   Below it is a block of code containing `const firebaseConfig = { … }`.
   Copy that whole `{ … }` block, from the opening `{` to the closing `}`.
   Keep it somewhere for step 6.
5. Click **Continue to console**.

(Lost it? It's always at the gear icon → **Project settings** → **General** →
scroll to **Your apps** → **Config**.)

These settings are **not secret**: every website that uses Firebase ships
them to every visitor. What protects your data is your password plus the
rules in step 5.

## 3. Turn on sign-in with email and password

1. In the left menu: **Security** → **Authentication** (older layouts:
   **Build** → **Authentication**). Click **Get started** if asked.
2. Tab **Sign-in method** → **Email/Password**.
3. Switch on the first option, **Email/Password**. Leave **Email link
   (passwordless sign-in)** off: links would open Safari instead of the
   installed app on your iPhone.
4. **Save**.

## 4. Add yourself as the only user

1. Still in Authentication, tab **Users** → **Add user**.
2. Your email address, and a **new, strong password** used for nothing else.
3. Save that password in your password manager / iCloud Keychain now, so the
   iPhone can fill it in later.
4. Click **Add user**.

Then close the door behind you, so nobody else can make an account:

5. Tab **Settings** → **User actions**. If there is a tick box **Enable create
   (sign-up)**, untick it and **Save**. (If it isn't there, don't worry: the
   rules in step 5 already keep every account out of everyone else's data.)

## 5. Create the database and paste the rules

1. Left menu: **Databases & Storage** → **Firestore** (older layouts:
   **Build** → **Firestore Database**).
2. **Create database**.
   - If it asks for an edition, pick **Standard**.
   - Location: **europe-west4 (Netherlands)**. This can't be changed later.
   - Choose **Start in production mode**.
   - **Create**.
3. When it's ready, open the **Rules** tab.
4. Delete everything in the editor. Open the file `firestore.rules` from the
   Life Hub folder (right-click → Open with → Notepad), copy **all** of it,
   and paste it in.
5. **Publish**.

## 6. Give Life Hub the settings from step 2

Easiest: paste the `{ … }` block from step 2 into your chat with Claude, and
Claude puts it in the right place.

Or do it yourself: open `src\data\firebase-config.js` in Notepad. On the last
line, replace the word `null` with the block you copied, so the line reads
`export const firebaseConfig = { apiKey: "…", … };` (keep the `;` at the end).
Save.

## 7. First sign-in, on the laptop

This is the moment your record since 28 September goes online. It has to
happen **on this laptop, in the browser you normally use**, because that is
where the data is.

Don't sign in anywhere else first. A browser without your data just shows
"Nothing is stored online yet" and waits for the laptop, so no harm done, but
the laptop is where your record comes from.

1. Double-click **Start Life Hub.bat** as usual (if it's already open, reload
   the page).
2. The dashboard appears as always, with a small red **Sign in to sync**
   button at the top right. Click it.
3. Sign in with the email and password from step 4.
4. The button shrinks to a green dot, and the bottom of the page now says
   **Signed in as (your email) · Sign out**. That's it: your data is online.

To see it with your own eyes: in the Firebase console, **Firestore** → **Data**.
You'll find `users` → a long code (your account) → `data` → `main` (your
habits, rituals and goals) and `2026` (this year's ticks).

## 8. Try the sync (still on the laptop)

Until step 5 puts Life Hub online, the phone can't reach it yet, but you can
see syncing work with a second window:

1. With Life Hub open, open a private window: in Edge, **Ctrl + Shift + N**.
2. Go to `http://localhost:8520/src/` in it. It has no data of its own, so it
   asks you to sign in. Do.
3. Your dashboard appears. Tick something in one window: it shows up in the
   other a second later.
4. Close the private window when you're done.

---

# Part 2: Life Hub on your iPhone

Your phone can't reach the laptop, so Life Hub gets its own web address,
**https://fronk001.github.io/life-hub/**, next to your Mongolian app. Claude
publishes the app to your GitHub repository `life-hub`; GitHub turns it into
that page and updates it by itself every time Claude publishes a change.

What becomes public is the app's code and these notes, nothing else. Your
habits, ticks and goals stay in your private database, behind your password,
and your personal starting file never leaves the laptop.

## 9. Make the repository public and switch on its page

GitHub only hosts pages for free from public repositories.

1. Go to **https://github.com/fronk001/life-hub** → **Settings** (top right of
   the repository, the gear).
2. **General** is open. Scroll to the bottom, **Danger Zone** →
   **Change visibility** → **Change to public**, and confirm (GitHub asks you to
   type the name, `fronk001/life-hub`).
3. Left menu: **Pages**. Under **Build and deployment** → **Source**, choose
   **GitHub Actions**. It applies straight away; there is no Save button.
4. Top menu: **Actions** → **Deploy to Pages** (left) → **Run workflow** (right)
   → **Run workflow**. After about a minute it gets a green tick, and
   https://fronk001.github.io/life-hub/ shows Life Hub.

GitHub may have emailed you that an earlier run failed: that was before the
page was switched on, and step 4 replaces it.

## 10. Let the new address sign in

In the Firebase console: **Security** → **Authentication** → tab **Settings**
→ **Authorized domains** → **Add domain** → type `fronk001.github.io` →
**Add**. (A precaution: it makes sure Firebase accepts sign-ins from the new
address.)

## 11. Install it on the iPhone

1. Open **Safari** (it has to be Safari) and go to
   **https://fronk001.github.io/life-hub/**.
2. Tap the **Share** button (the square with the arrow), then **Add to Home
   Screen** (scroll down, or look under **More**). If there is a switch **Open
   as Web App**, leave it on. Tap **Add**.
3. Close Safari and open **Life Hub from the home screen**. From now on always
   use that icon: the installed app keeps its own storage, separate from Safari.
4. It asks you to sign in. Type your email; for the password, tap the
   suggestion above the keyboard (your saved password from step 4).
5. Your dashboard appears, in the phone layout.

## 12. Try it

Tick a habit on the phone: with Life Hub open on the laptop, it shows up there
a second or two later. And the other way round.

From now on:

- **No signal?** Life Hub still opens and you can tick; the ticks go up by
  themselves once you're connected.
- **Updates** arrive by themselves: the next time you open the app after Claude
  publishes a change, it reloads once (a quick flash) and shows the new version.
- **The laptop** keeps using **Start Life Hub.bat**. You can also open the online
  address there; both show the same data once signed in.

---

## What the little signs mean

The sync button sits in the top right corner, the same signs as the
Mongolian app's dot. Tap it to see what it means in words.

- **Green dot**: this device is in step. Every tick goes up by itself.
- **Green ring**: on its way, nothing to do: connecting for a moment when
  the app opens, offline, or changes still going up. The last two come
  with words:
  - **Offline · 2 changes saved here**: no internet. Keep ticking; everything
    goes up by itself once you're back online, even if you close the app
    meanwhile.
  - **Syncing…**: changes are taking a while to reach the database.
- **Red**: needs you.
  - **Sign in to sync**: this device isn't connected yet. Click to sign in.
  - **Signed out · Sign in**: the connection ended (say, after a password
    change). Your ticks are kept on the device; sign in and they go up.
  - **Not syncing**: the database refused something. Tap it for the reason,
    and tell Claude.

**Sign out** (bottom of the page) removes Life Hub's data from *that device
only*. Everything stays safe online, and signing in again brings it back.

## If something goes wrong

- **"That email and password don't match."** Check for typos. Forgotten
  password: type your email and tap **Forgot password?**, and a reset link
  arrives by email.
- **"Not syncing" saying "permission-denied".** The rules from step 5
  didn't get published. Paste them again and press **Publish**.
- **Sign-in never finishes.** Check the internet connection, then reload the
  page. Still stuck: tell Claude what you see.
