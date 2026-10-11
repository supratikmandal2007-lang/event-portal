# Campus Event Pass

An event website hosted free on GitHub Pages, with Firebase storing accounts and registrations.

- **Sign-in:** people sign up by year with email and password, and verify their email. First-years may use a personal email. Everyone else needs an institutional one (admins can use any email).
- **Events:** each event shows its date, place, price, brochure, who it's for and how attendees benefit. It has buttons for Google, Outlook and Apple calendars and for Google or Apple Maps.
- **Registration:** people register in one tap and get an entry code. Seat limits and registration deadlines are enforced.
- **Suggestions and notifications:** a "For you" page suggests events from each person's interests, and a notifications bell shows announcements.
- **Admin tab:** add, edit or delete events; see members and their interests; email chosen groups through Gmail; post announcements; change settings.

## Files

| File | What it is |
|---|---|
| `index.html` | The page layout and styles |
| `app.js` | Everything the website does |
| `firebase-config.js` | Your Firebase project settings (paste them here) |
| `firestore.rules` | Security rules. Paste into Firebase → Firestore → Rules |
| `.nojekyll` | Tells GitHub Pages to serve the files as they are |

## Setup

Follow the step-by-step setup guide shared with this code. In short:
1. Upload these files to a public GitHub repository and turn on **Settings → Pages** (branch `main`, folder `/ (root)`).
2. Create a Firebase project. Turn on **Authentication → Email/Password** and add `yourname.github.io` under **Authorized domains**.
3. Create a **Firestore Database** and paste `firestore.rules` into its **Rules** tab.
4. Register a **Web app** in Project settings and paste its config into `firebase-config.js`.
5. In Firestore, add a collection called `admins` with one document whose ID is your email in lowercase.
6. Open your site, create your account, verify your email, and fill in **Admin → Settings**.

## Free plan limits (Firebase Spark)

- 1,000 verification emails per day
- 50,000 database reads and 20,000 writes per day
- 1 GB of storage

That is plenty for a college club.
