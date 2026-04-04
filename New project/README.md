# Attendance Tracker

A lightweight static web app for:

- clock in / clock out
- working hour calculation
- daily progress notes
- local browser history
- CSV export for Excel

## Files

- `index.html`
- `styles.css`
- `script.js`

## Share Online

This project is ready to host as a static website.

### Option 1: GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository root.
3. Open the repository `Settings`.
4. Go to `Pages`.
5. Under `Build and deployment`, choose:
   Source: `Deploy from a branch`
6. Select:
   Branch: `main`
   Folder: `/ (root)`
7. Save and wait for the site URL.

### Option 2: Netlify

1. Create a Netlify account.
2. Drag this project folder into Netlify Drop.
3. Netlify will instantly generate a public URL.

### Option 3: Vercel

1. Create a Vercel account.
2. Import the project from GitHub, or upload it through the dashboard.
3. Deploy as a static site.

## Important Note

Saved history currently uses browser `localStorage`.

That means:

- your own records stay on your browser
- other people opening the same link will not see your saved history
- each user gets separate local data

## If You Want Shared Progress

To let multiple people see the same attendance history online, the app needs a backend or cloud database such as:

- Firebase
- Supabase
- Airtable
- Google Sheets API

## Local Preview

Open `index.html` in a browser.
