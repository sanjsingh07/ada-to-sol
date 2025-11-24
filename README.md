## 📌 **READ ME FIRST**

### ⚡ Project Overview

This repository is a **NestJS backend** that services a blockchain-based application with:

* 🔐 **Authentication using wallet signature verification**
* 👤 **User management**
* 🔄 **ChangeNOW crypto exchange integration**
* 💳 **Cardano service utilities**
* 🛢 **Prisma ORM + PostgreSQL**

### 🏗 Project Structure (Important Modules)

| Folder           | Purpose                                                        |
| ---------------- | -------------------------------------------------------------- |
| `src/auth`       | Signature-based auth & token refresh                           |
| `src/users`      | User CRUD & profile updates                                    |
| `src/change-now` | ChangeNOW exchange API integration                             |
| `src/cardano`    | Cardano blockchain utilities (service only, no controller yet) |
| `src/database`   | DB connection layer                                            |
| `prisma/`        | Database schema                                                |

### 📦 Installation & Setup

#### **1. Install dependencies**

```bash
npm install
```

#### **2. Configure Environment**

Create `.env` based on `.env.example` (if provided). Required variables likely include:

```
DATABASE_URL=
DIRECT_URL=
ENCRYPTION_KEY= // For encrpyting and decrypting wallets
JWT_SECRET=
CHANGENOW_API_KEY=
CHANGENOW_API_URL=
BLOCKFROST_API_KEY=
BLOCKFROST_URL=
```

#### **3. Run Migrations**

```bash
npx prisma migrate deploy
```

#### **4. Start the Application**

```bash
npm run start:dev
```

---

## 🌐 **API Integration Guide (Frontend)**

### 🔐 **Authentication (Wallet Signature)**

#### 📝 **POST `/auth/verify-signature`**

**Public endpoint**

**Request Body**

```json
{
  "address": "walletPublicKey",
  "signature": "signedMessage",
  "message": "nonceOrMessage"
}
```

**Response**
Returns:

* Access token (short-lived)
* Refresh token (persistent)

```json
{
  "access_token": "...",
  "refresh_token": "...",
  "user": { "...user data..." }
}
```

---

#### ♻ **POST `/auth/refresh`**

**Public endpoint**

**Request Body**

```json
{ "refreshToken": "string" }
```

**Response**

```json
{
  "access_token": "...",
  "refresh_token": "..."
}
```

---

### 👤 **User Module**

🔐 **All endpoints require `Authorization: Bearer <TOKEN>`**
(Except `/users/create`)

---

#### 🆕 **POST `/users/create`**

**Public endpoint**

```json
{
  "address": "walletPublicKey",
  "username": "optional",
  "email": "optional"
}
```

---

#### 🔎 **GET `/users/:userAddress`**

Fetch user by address.

---

#### ✏ **PATCH `/users/:userAddress`**

Update user.

```json
{
  "username": "newUserName",
  "email": "newEmail"
}
```

---

#### 🗑 **DELETE `/users/:userAddress`**

---

### 🔄 **ChangeNOW Exchange Service**

#### 🚫 Authentication Required

Headers example:

```
Authorization: Bearer <access_token>
```

---

#### 📉 **GET `/changenow/exchange/min-amount`**

**Query params required**

```
fromCurrency=
toCurrency=
fromNetwork=
toNetwork=
```

**Example**

```
GET /changenow/exchange/min-amount?fromCurrency=btc&toCurrency=ada&fromNetwork=btc&toNetwork=ada
```

---

#### 💱 **POST `/changenow/exchange`**

Creates an exchange and sends funds using the wallet linked to the token.

**Body**

```json
{
  "fromCurrency": "btc",
  "toCurrency": "ada",
  "fromNetwork": "btc",
  "toNetwork": "ada",
  "amount": 0.01,
  "recipientAddress": "addr1..."
}
```

⚠ Backend extracts the wallet address from `req.user.sub` (token).

---

### 💳 **Cardano Module**

⚠ Currently **service only, no HTTP endpoints exposed yet.**

---

### 🔐 Required Headers Summary

| Endpoint        | Auth Required                           | Headers                         |
| --------------- | --------------------------------------- | ------------------------------- |
| `/auth/*`       | ❌ No                                    | none                            |
| `/users/create` | ❌ No                                    | none                            |
| `/users/*`      | ✔ Yes                                   | `Authorization: Bearer <token>` |
| `/changenow/*`  | ✔ Yes (except min-amount may be public) | `Authorization: Bearer <token>` |

---