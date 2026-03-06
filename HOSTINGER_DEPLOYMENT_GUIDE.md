# Hostinger Deployment Details & Troubleshooting Guide

This document preserves the exact deployment methodology and troubleshooting history for deploying the Bank Analytics Dashboard (Viking) frontend to Hostinger. Any future AI agents or developers should reference this guide before attempting deployments or debugging live environment issues.

## Hosting Environment
*   **Provider:** Hostinger
*   **Server Type:** Apache Web Server
*   **Domain:** luthersolution.com
*   **Target Directory:** `/public_html`

## The Application Stack
*   **Frontend Framework:** React 18
*   **Router:** React Router (`BrowserRouter` / Client-side routing)
*   **Build Tool:** Vite + TypeScript

---

## Deployment Workflow (Manual)

Because Hostinger does not automatically pull from a Git repository in this specific setup, you MUST follow these precise manual steps to push changes to production.

### Step 1: Build the Application Locally
1. Stop any running local development servers (`Control + C`).
2. Run the build command in the `Viking` root directory:
   ```bash
   npm run build
   ```
   *This uses Vite to compile TS/React into static HTML/CSS/JS files inside the `dist/` directory.*

### Step 2: Package the Build
1. Zip the `dist/` directory into an archive:
   ```bash
   zip -r frontend-build.zip dist/
   ```

### Step 3: Upload & Clean Hostinger Directory
1. Log in to the Hostinger **hPanel**.
2. Navigate to **File Manager** -> **`public_html`**.
3. **CRITICAL:** Delete all existing files and folders inside `public_html` first to ensure a clean slate and prevent caching issues.
4. Upload the new `frontend-build.zip` file directly into `public_html`.

### Step 4: Extract and Move
1. Right-click the `frontend-build.zip` inside `public_html` and select **Extract**.
2. *Important Hostinger quirk:* If Hostinger requires a folder name during extraction, enter a temporary name like `temp`.
3. Open the extracted folder structure (`temp` -> `dist`).
4. Select **all** files inside the `dist` folder:
    *   `index.html`
    *   `assets/` (folder)
    *   `.htaccess`
    *   `robots.txt`
    *   `bekapfp1.jpg`
5. Click **Move** and specify `public_html` as the destination.
6. Verify that `index.html` and `.htaccess` now sit directly at the root of the `public_html` folder.
7. Clean up: Delete the empty `temp` directory (if created), the empty `dist` directory, and the `frontend-build.zip` file.

---

## Known Issues and Solutions

### 1. The "Disappearing Page" / 404 Error on Refresh
**The Problem:**
When navigating the site via clicking links, everything worked. However, refreshing the page or navigating directly to a route (e.g., `luthersolution.com/dashboard`) resulted in a 404 error or a blank page.

**The Diagnosis:**
The application uses React Router (`BrowserRouter`) for client-side routing. When a user requests `/dashboard` directly from the server, the Apache server looks for a literal file or directory named `dashboard`. Since no such file exists (Vite only builds a single `index.html`), Apache throws a 404.

**The Solution:**
We resolved this by creating an `.htaccess` file in the `public/` directory of the repository. This file instructs the Apache web server to redirect all requests for non-existent files or directories back to `index.html`. React Router then takes over and renders the correct component based on the URL.

The required `.htaccess` configuration:
```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
```
*Note: This file MUST be copied to `dist/` during the build process and MUST end up directly inside `public_html` on Hostinger.*

### 2. Mobile Responsiveness Adjustments
**The Problem:**
The application layout, particularly the sidebar, filters, expanded charts, and statistical island panels, broke or displayed incorrectly on mobile devices (viewports < 768px).

**The Diagnosis:**
The CSS modules (`.module.css`) lacked specific media queries to handle stacking and padding reduction on smaller screens. Specifically, `flex-direction: row` was maintained causing horizontal overflow or squished content. Furthermore, `hover` effects for actions (like expand buttons) were inaccessible on touch pointers.

**The Solution:**
We implemented extensive responsive media queries across the following stylesheets:
*   `Layout.module.css`: Switched `.body` to `flex-direction: column` and reduced paddings.
*   `ScoreboardPage.module.css`: Forced vertical stacking for the table and `.averagesIsland`, adjusted horizontal scrolling, and compressed filter inputs to `width: 100%`.
*   `DashboardPage.module.css`: Adjusted the `.cardChartExpanded` modal to reduce viewport inset margins (from `2rem` to `0.5rem`) so charts utilize edge-to-edge space.
*   `SummaryStats.module.css`: Wrapped the grid explicitly to smaller max-widths and included an `@media (hover: none) and (pointer: coarse)` query to permanently show the "expand" icons on touch devices instead of waiting for a hover.
*   `ReportsPage.module.css`: Condensed action buttons (Download/Refresh) and filter dropdowns to occupy 100% block widths below 768px.
*   `FilesPage.module.css`: Refactored the folder grid to a `1fr` column block and added `-webkit-overflow-scrolling: touch` for smooth horizontal scrolls on the pill-style tab buttons.

*Future developers should test any new UI components at breakpoints `1024px`, `768px`, and `480px`.*
