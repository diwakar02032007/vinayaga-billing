# GST BillPro — Vercel + Aiven MySQL Deployment

This package gives one public client link using:

- Vercel: frontend + serverless Node/Express API
- Aiven: MySQL database

## 1. Upload to GitHub

Upload all files in this folder to your GitHub repository.

Do not upload `.env` with real passwords. Use Vercel Environment Variables instead.

## 2. Aiven MySQL

Create Aiven MySQL Free service and copy:

- Host
- Port
- User
- Password
- Database

## 3. Vercel Import

1. Open Vercel
2. Add New Project
3. Import your GitHub repository
4. Framework Preset: Other
5. Install Command: `npm install`
6. Build Command: `npm install`
7. Output Directory: `public`

## 4. Add Environment Variables in Vercel

Add these in Vercel Project Settings → Environment Variables:

```env
DB_HOST=your-aiven-host
DB_PORT=your-aiven-port
DB_USER=your-aiven-user
DB_PASSWORD=your-aiven-password
DB_NAME=your-aiven-db-name
DB_SSL=true
DB_SSL_REJECT_UNAUTHORIZED=false
DB_CONNECTION_LIMIT=3
JWT_SECRET=replace_with_long_secret
JWT_EXPIRES_IN=7d
AUTO_DB_SETUP=true
ADMIN_EMAIL=admin@billing.local
ADMIN_PASSWORD=admin123
ADMIN_NAME=Admin
```

## 5. Deploy

Deploy the project.

Open:

```txt
https://your-project-name.vercel.app
```

Login with:

```txt
admin@billing.local
admin123
```

## 6. After first successful login

Change this Vercel environment variable:

```env
AUTO_DB_SETUP=false
```

Then redeploy.

This prevents auto setup from running again.

## 7. Final client setup

Inside app Business Settings, update:

- Real GSTIN
- Real business address
- Real phone/email
- Bank details
- UPI ID
- QR code
- Products and stock

## Notes

- Aiven MySQL free tier has limits. For serious client usage, take regular database backups.
- Vercel serverless functions are suitable for small usage. If billing usage grows, upgrade hosting.
