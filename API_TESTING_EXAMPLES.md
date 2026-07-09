# API Testing Examples

Use Postman, Thunder Client, or VS Code REST Client.

## 1. Login

POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "email": "admin@billing.local",
  "password": "admin123"
}

Copy the token from response.

## 2. Get Products

GET http://localhost:5000/api/products
Authorization: Bearer YOUR_TOKEN_HERE

## 3. Add Customer

POST http://localhost:5000/api/customers
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

{
  "name": "Test Customer",
  "phone": "9999999999",
  "address": "Salem, Tamil Nadu",
  "state_name": "Tamil Nadu",
  "state_code": "33"
}

## 4. Create Invoice

POST http://localhost:5000/api/invoices
Authorization: Bearer YOUR_TOKEN_HERE
Content-Type: application/json

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
  "items": [
    { "product_id": 1, "qty": 1 },
    { "product_id": 2, "qty": 1 }
  ]
}
