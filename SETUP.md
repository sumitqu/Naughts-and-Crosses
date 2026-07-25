# Firebase setup (one-time, ~10 minutes)

## 1. Create a Firebase project
1. Go to https://console.firebase.google.com
2. Click **Add project**, name it anything (e.g. `fadetactoe`), skip Google Analytics if you don't need it.

## 2. Add a Web app
1. In your new project, click the **</>** (Web) icon on the project overview page.
2. Give it a nickname, click **Register app**.
3. Firebase shows you a `firebaseConfig` object — copy it.
4. Paste those values into `firebase-config.js` in this repo, replacing the `PASTE_YOUR_...` placeholders.

## 3. Enable Realtime Database
1. Left sidebar → **Build → Realtime Database** → **Create Database**.
2. Pick any region close to you.
3. Start in **locked mode** (we'll set proper rules next).
4. Once created, go to the **Rules** tab and paste this in, then click **Publish**:

```json
{
  "rules": {
    "rooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

This means: only signed-in clients (including anonymous ones — see next step) can read or write room data. It's not perfect (any anonymous visitor can still tamper with any room code if they guess it), but it blocks casual/automated abuse while keeping things simple. Random 5-character codes make guessing impractical for a casual game.

## 4. Enable Anonymous Authentication
1. Left sidebar → **Build → Authentication** → **Get started**.
2. Under **Sign-in method**, enable **Anonymous**.
3. Save.

This lets `script.js` silently sign each visitor in (no login screen, no password) just so the database rules above have an `auth != null` to check against.

## 5. Push to GitHub
Commit and push `index.html`, `style.css`, `script.js`, and `firebase-config.js` (with your real keys filled in) to your repo like normal. GitHub Pages will serve it exactly as before — Firebase runs entirely from the browser, so no server hosting is needed.

**Important:** `firebase-config.js` will contain your Firebase project's public config values. These are safe to expose in a client-side app (that's how Firebase is designed to work) — the security rules above are what actually protect your data, not secrecy of these values.

## 6. Test it
1. Open your GitHub Pages URL in two different browser tabs (or your phone + laptop).
2. In tab 1: enter a name → Create Room → note the code.
3. In tab 2: enter a different name → Join Room → type the code.
4. Both should land on the game screen and be able to play against each other live.
