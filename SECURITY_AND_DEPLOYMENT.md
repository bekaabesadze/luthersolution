# Security & Deployment Checklist

This document explains what’s already in place and **what you need to do** so your site isn’t marked as dangerous or malicious and is safe to use in production.

---

## What’s Already Done in This Project

### 1. **Security headers (backend)**
The FastAPI app adds these HTTP response headers on every response:
- **X-Content-Type-Options: nosniff** – Reduces MIME sniffing attacks
- **X-Frame-Options: DENY** – Helps prevent clickjacking
- **X-XSS-Protection: 1; mode=block** – Extra XSS protection in older browsers
- **Referrer-Policy: strict-origin-when-cross-origin** – Limits referrer leakage
- **Permissions-Policy** – Restricts geolocation, microphone, camera
- **Content-Security-Policy (CSP)** – Restricts where scripts, styles, and connections can load

### 2. **Privacy Policy & Terms of Service**
- **Privacy Policy** at `/privacy` – Data collection, use, storage, and rights
- **Terms of Service** at `/terms` – Acceptable use, liability, termination
- Footer links to both on every page (required for trust and many app stores / compliance)

### 3. **Frontend security and trust**
- **index.html**: `description`, `referrer`, and `theme-color` meta tags for better behavior and appearance
- **robots.txt** in `frontend/public/` – Tells crawlers what’s allowed (adjust if the app is internal-only)

### 4. **CORS**
- Backend allows only specific origins (localhost in dev). **You must add your production domain** when you deploy (see below).

---

## What You Need To Do

### 1. **Use HTTPS (SSL/TLS) – required**

Browsers mark HTTP sites as “Not secure.” To avoid that and avoid being flagged as dangerous:

- **Serve the site only over HTTPS** in production.
- **Get an SSL certificate** and configure your server to use it.

**Options:**

| Option | Best for | What to do |
|--------|----------|------------|
| **Let’s Encrypt (free)** | Your own server or VPS | Install Certbot, run it for your domain, and point your web server (e.g. nginx) to the certificate. Renewal is automatic. |
| **Hosting provider** | Heroku, Vercel, Netlify, AWS, etc. | Most provide free HTTPS and auto-renewal. Turn it on in the dashboard and use “Force HTTPS” if available. |
| **Cloudflare** | Any domain | Add the site to Cloudflare and use “Full (strict)” SSL. They can also issue/renew certs for you. |

**After HTTPS is on:**  
- Use **https://** in all links and in `allow_origins` for your production domain (see CORS below).  
- Enable **“Force HTTPS”** or redirect HTTP → HTTPS so users never hit plain HTTP.

---

### 2. **Add your production domain to CORS**

In **`backend/main.py`**, the `CORSMiddleware` has:

```python
allow_origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    ...
]
```

When you deploy:

1. Add your **production frontend URL(s)** to `allow_origins`, using **https** only, for example:
   - `"https://yourdomain.com"`
   - `"https://www.yourdomain.com"` if you use www
2. Do **not** use `"*"` in production if you use cookies or credentials; keep the list explicit.

Example:

```python
allow_origins=[
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:8000",
    "https://yourdomain.com",           # add your real domain
    "https://www.yourdomain.com",       # if you use www
],
```

Using an environment variable for the frontend URL is a good idea so you can change it per environment without code changes.

---

### 3. **Where you host matters**

- **Same domain for API and frontend (recommended)**  
  Example: `https://yourdomain.com` (app) and `https://yourdomain.com/api` (API).  
  One SSL cert, same origin, no CORS issues. Use a reverse proxy (e.g. nginx) to route `/api` to the FastAPI app and `/` to the frontend.

- **Different subdomains**  
  Example: `https://app.yourdomain.com` and `https://api.yourdomain.com`.  
  You need both in CORS `allow_origins` and a valid SSL certificate for each (or a wildcard cert).

---

### 4. **Optional: Security headers on the frontend**

If you serve the frontend with **nginx** (or another web server) in front of the app, you can add the same kind of security headers there. That way they apply even when the HTML is served by nginx instead of FastAPI. Example for nginx:

```nginx
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
```

---

### 5. **Optional: HSTS**

After HTTPS is working, you can enable **HSTS** (HTTP Strict Transport Security) so browsers only use HTTPS for your domain.  
Many hosting platforms add this for you. If you use nginx, you can add:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

Only enable this when you’re sure HTTPS is correct everywhere; otherwise users can get stuck.

---

### 6. **Internal-only / no indexing**

If this app is **internal only** and should not appear in search engines:

- In **`frontend/public/robots.txt`** set:
  ```txt
  User-agent: *
  Disallow: /
  ```
- You can also add a login or auth so the app isn’t publicly accessible.

---

### 7. **Privacy Policy & Terms**

- The **text** in `/privacy` and `/terms` is a solid template. **You should:**
  - Replace “contact your internal administrator” with real contact details or a support email.
  - Have a lawyer review if you’re in a regulated industry (e.g. finance).
- Update the **“Last updated”** date when you change the content.

---

## Quick checklist before going live

- [ ] **HTTPS** enabled and HTTP redirected to HTTPS
- [ ] **SSL certificate** valid and (if applicable) auto-renewing
- [ ] **CORS** updated with your production frontend URL(s) only (https)
- [ ] **Privacy Policy** and **Terms** links in the footer (done) and contact info updated
- [ ] **robots.txt** set to `Disallow: /` if the app is internal-only
- [ ] **Environment** (e.g. production API URL, secrets) set via env vars, not hardcoded

---

## Summary

- **In the repo:** Security headers, Privacy Policy, Terms of Service, footer links, meta tags, and robots.txt are in place.
- **You must do:**  
  1) Use **HTTPS** and a valid **SSL certificate** in production.  
  2) Add your **production domain(s)** to CORS in `backend/main.py`.  
  3) Update **contact details** in Privacy and Terms and, if needed, **restrict indexing** via robots.txt.

That’s the minimum to avoid being marked as dangerous or malicious and to meet basic expectations for a trustworthy website.
