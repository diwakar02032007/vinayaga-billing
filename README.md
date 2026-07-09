# GST Billing System Backend

Essential backend for a billing system with:

- GST invoice creation
- CGST + SGST for same-state sale
- IGST for other-state sale
- Product and stock management
- Auto stock deduction after invoice save
- Customer management
- Invoice history
- GST report
- Low-stock report
- Admin/Cashier login

## Tech Stack

- Node.js
- Express.js
- MySQL
- JWT Authentication

## Folder Structure

```txt
billing-system-backend/
├── database/
│   └── schema.sql
├── scripts/
│   └── seed.js
├── src/
│   ├── config/db.js
│   ├── middleware/
│   ├── routes/
│   ├── utils/gst.js
│   └── server.js
├── .env.example
├── package.json
└── README.md
```

## Setup Steps

### 1. Install Node packages

```bash
npm install
```

### 2. Create MySQL database and tables

Open MySQL Workbench or MySQL terminal and run:

```sql
SOURCE database/schema.sql;
```

If `SOURCE` is not working, copy everything from `database/schema.sql` and run it manually.

### 3. Create `.env` file

Copy `.env.example` and rename it to `.env`.

Update your MySQL password:

```env
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=billing_system
PORT=5000
JWT_SECRET=my_secret_key_123
FRONTEND_URL=http://127.0.0.1:5500
```

### 4. Add sample admin + sample products

```bash
npm run db:seed
```

Default login:

```txt
Email: admin@billing.local
Password: admin123
```

### 5. Run backend

Development mode:

```bash
npm run dev
```

Normal mode:

```bash
npm start
```

Backend URL:

```txt
http://localhost:5000
```

Health check:

```txt
http://localhost:5000/api/health
```

## Important API Routes

### Login

```http
POST /api/auth/login
```

Body:

```json
{
  "email": "admin@billing.local",
  "password": "admin123"
}
```

Use the returned token in all other requests:

```txt
Authorization: Bearer YOUR_TOKEN_HERE
```

### Business Settings

```http
GET /api/settings
PUT /api/settings
```

### Products

```http
GET /api/products
POST /api/products
PUT /api/products/:id
DELETE /api/products/:id
POST /api/products/:id/stock
```

Add product body:

```json
{
  "name": "Bosch All-in-One Metal Hand Tool Kit",
  "hsn_sac": "8302",
  "category": "Tools",
  "unit": "NOS",
  "purchase_price": 2000,
  "selling_price": 2535,
  "gst_rate": 18,
  "current_stock": 20,
  "min_stock": 3
}
```

Add stock body:

```json
{
  "type": "PURCHASE",
  "qty": 10,
  "note": "New purchase"
}
```

### Customers

```http
GET /api/customers
POST /api/customers
PUT /api/customers/:id
DELETE /api/customers/:id
```

### Create Invoice

```http
POST /api/invoices
```

Body example:

```json
{
  "invoice_date": "2026-06-30",
  "customer": {
    "name": "Shiv Engineering",
    "phone": "9878789878",
    "email": "hardik@shiveng.com",
    "address": "Kochi, Kerala",
    "gstin": "32AABBA7890B1ZB",
    "state_name": "Kerala",
    "state_code": "32"
  },
  "payment_method": "UPI",
  "payment_status": "Paid",
  "challan_no": "33",
  "eway_bill_no": "78456378",
  "transport_name": "Silver Roadlines",
  "transport_gstin": "24ABSFS0321B2ZL",
  "items": [
    {
      "product_id": 1,
      "qty": 1
    },
    {
      "product_id": 2,
      "qty": 1
    }
  ]
}
```

The backend will:

1. Generate invoice number automatically.
2. Decide IGST or CGST/SGST using business state code and customer state code.
3. Calculate taxable amount, GST and grand total.
4. Save invoice and invoice items.
5. Reduce product stock automatically.
6. Add stock transaction history.

### Invoice History

```http
GET /api/invoices
GET /api/invoices/:id
```

### Reports

```http
GET /api/reports/dashboard
GET /api/reports/sales?from=2026-06-01&to=2026-06-30
GET /api/reports/gst?from=2026-06-01&to=2026-06-30
GET /api/reports/low-stock
```

## Connect This Backend to Your Frontend

Your frontend should call this API base URL:

```js
const API_BASE_URL = "http://localhost:5000/api";
```

Example login request:

```js
async function login(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();
  if (data.success) {
    localStorage.setItem("billing_token", data.token);
  }
  return data;
}
```

Example authorized request:

```js
async function getProducts() {
  const token = localStorage.getItem("billing_token");
  const res = await fetch(`${API_BASE_URL}/products`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  return res.json();
}
```

## Notes

- A4 invoice print and thermal print can remain in the frontend.
- Backend stores only invoice data, products, customers, stock and reports.
- For real shop use, keep MySQL database backup regularly.
- Change default admin password before using it for real business.
