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
| `src/orderly`    | Orderly API integration                                        |
| `src/utils`      | Helper fn and utils                                            |
| `src/cardano`    | Cardano blockchain utilities (service only, no controller yet) |
| `src/database`   | DB connection layer                                            |
| `prisma/`        | Database schema                                                |

### 📦 Installation & Setup

## Table of contents

1. Quick start (env, run)
2. Architecture overview
3. Transaction lifecycle & `TransactionStatus`
4. Database models (important fields)
5. Environment variables (complete list)
6. Orderly integration (APIs & examples)
7. ChangeNow integration (APIs & examples)
8. Solana integration (vault deposit / withdraw)
9. APIs implemented (controller-level list + sample requests)
10. Workers (what they do & cron timing)
11. Example env file


---

## 1) Quick start

1. Ensure required system services are available:
   - Postgres (or configured DB)
   - Solana RPC endpoint (devnet/testnet/mainnet as required)
   - Cardano node or a Cardano RPC provider for sending ADA
2. Copy `.env.example` → `.env` and populate values (see section **Environment variables**).
3. Install dependencies:
   ```bash
   npm i
   ```
4. Build and start in dev:
   ```bash
   npm run build
   npm run start:dev
   ```
5. Run migrations / prisma generate if you use Prisma:
   ```bash
   npx prisma generate
   npx prisma migrate deploy    # or migrate dev in local
   ```

---

## 2) Architecture overview

- **Modules**
  - `OrderlyModule` — handles registration, deposit/withdraw, orders, asset history, internal transfers. Talks to Orderly REST API and Solana vault program.
  - `ChangeNowModule` — handles creating swaps (ADA ↔ SOL) via ChangeNow API and sending blockchain transactions (Cardano / Solana).
  - `CardanoModule` — builds and signs Cardano transactions for ADA pay-ins/pay-outs.
  - `SolanaClient` (utility provider) — helper to manage Solana Keypairs, connection, and Anchor integration.
  - `Workers` — scheduled CRON services (ChangeNowWorker, OrderlyWithdrawalWorker, etc.) that poll third-party status endpoints and advance internal transaction state.

- **High-level flows**
  - **Deposit (user → ADA → swap → SOL → Orderly deposit):**
    1. User deposits ADA to the Cardano address we generated for them (this address is `newCardanoAddress` stored in `UserWallet`).
    2. A transaction record is created when ChangeNow exchange is created (status `CHANGENOW_CREATED`).
    3. Cardano transaction is sent to ChangeNow payin address (`CHANGENOW_EXCHANGING`).
    4. ChangeNow completes swap and sends SOL to our intermediate SOL address (or directly to user's SOL if configured).
    5. Anchor program `depositSol` is called to transfer SOL into the Orderly vault (status `ORDERLY_DEPOSIT_PENDING` → `ORDERLY_DEPOSIT_CONFIRMED`).
  - **Withdraw (user requests → Orderly withdraw → SOL received → swap SOL→ADA → ADA sent to user):**
    1. User requests withdrawal via the frontend (call to `POST /orderly/withdraw`).
    2. `OrderlyService.withdrawSol` creates a Transaction record with status `ORDERLY_WITHDRAW_PENDING` and calls Orderly `/v1/withdraw_request`.
    3. `OrderlyWithdrawalWorker` polls Orderly `/v1/asset/history` to detect when the withdraw is `COMPLETED` (Orderly moved SOL out).
    4. Once Orderly confirmed, we create a ChangeNow exchange (SOL → ADA) and persist the exchange in a Transaction (`CHANGENOW_CREATED`).
    5. `ChangeNowWorker` polls ChangeNow exchange status, updates DB (`CHANGENOW_EXCHANGING`, then `CHANGENOW_COMPLETED`).
    6. When ChangeNow reports `finished`, we mark transaction `COMPLETED` and confirm ADA was sent (or initiate final send to user).

---

## 3) Transaction lifecycle & enum `TransactionStatus`

The canonical enum used by the code:

```
enum TransactionStatus {
  CREATED                 // user initiated tx (deposit or withdraw)
  WAITING_CHAIN_DEPOSIT   // waiting for ADA / SOL to arrive
  CHAIN_CONFIRMED         // funds confirmed on-chain
  CHANGENOW_CREATED       // exchange created on ChangeNow
  CHANGENOW_EXCHANGING    // swap in progress
  CHANGENOW_COMPLETED     // swap finished
  ORDERLY_DEPOSIT_PENDING
  ORDERLY_DEPOSIT_CONFIRMED
  ORDERLY_WITHDRAW_PENDING
  ORDERLY_WITHDRAW_CONFIRMED
  SENDING_TO_USER         // ADA being sent to user (final)
  COMPLETED               // final success
  FAILED
  REFUND_PENDING
  REFUNDED
}
```

**Important**: The codebase uses this status field to orchestrate workers. Make sure the worker cron jobs target the statuses listed above.

---

## 4) Database models (high-level important fields)

`UserWallet` (relevant fields used in flows):

- `walletAddress` — primary identifier for user in the app (string).
- `solanaAddress` — user's Solana public key.
- `solanaPriKey`, `solanaPriKeyIv`, `solanaPriKeyTag` — encrypted Solana secret Key (base58).
- `newCardanoAddress` — Cardano address (bech32) used as pay-in / pay-out for ADA.
- `orderlyAccountId` — Orderly account id after registration.
- `orderlyKeySecret`, `orderlyKeyIv`, `orderlyKeyTag` — encrypted orderly private key (for signing REST requests).
- `nonce`, `status` etc.

`Transaction` model (relevant fields):

- `id` — uuid
- `userAddress` — reference to `UserWallet.walletAddress`.
- ChangeNow fields: `fromAmount`, `toAmount`, `flow`, `type`, `payinAddress`, `payoutAddress`, `fromCurrency`, `toCurrency`, `exchangeId`, `directedAmount`, `fromNetwork`, `toNetwork`.
- `direction` — `"DEPOSIT"` or `"WITHDRAW"` (you may have it in code; if not add it).
- `status` — TransactionStatus
- `TxHash`, `refundHash` — chain tx hashes.
- `createdAt`, `updatedAt`

**Advice:** `exchangeId` is currently unique. Keep it as unique to avoid creating duplicate ChangeNow records.

---

## 5) Environment variables — full list

Populate `.env` with these keys (common names used in code):

- `NODE_ENV` — `development` | `production`
- `PORT` — service port
- `DATABASE_URL` — Prisma/Postgres connection string
- `ORDERLY_BASE_URL` — e.g. `https://testnet-api.orderly.org` or `https://api.orderly.org`
- `ORDERLY_BROKER_ID` — builder broker id used in keccak/brokerHash
- `ORDERLY_CHAIN_ID` — numeric chain id used by Orderly (e.g. `101` or configured value)
- `ORDERLY_KEY_PRIVATE_BASE58` — (optional) base58 private key for automated account actions if you have a service key
- `CHANGENOW_API_URL` — e.g. `https://api.changenow.io`
- `CHANGENOW_API_KEY` — ChangeNow API key
- `SOLANA_RPC_URL` — RPC for solana connection (e.g. `https://api.devnet.solana.com`)
- `SOLANA_COMMITMENT` — `confirmed` (optional)
- `ORDERLY_VAULT_PROGRAM_ID` (if differing from constants)
- `CARDANO_NODE_URL` — Cardano node / API endpoint (if needed)
- `JWT_SECRET` — for auth
- `ENCRYPTION_KEY` — master secret for encrypt/decrypt utilities (AES GCM)
- `SENTRY_DSN` — (optional) monitoring

**Note:** Your code references `ORDERLY_BASE_URL`, `ORDERLY_BROKER_ID`, and `ORDERLY_CHAIN_ID`. Make sure they're present.

---

## 6) Orderly integration — APIs & signing

### 6.1 Register account
**Endpoint:** `POST /v1/register_account` (Orderly)  
**Flow in code:** `OrderlyService.registerAccountForUser(walletAddress)`:
- Decrypt user's Solana key
- Get `registration_nonce` from `/v1/registration_nonce`
- Build registration text message
- Sign message using Solana key (ed25519/tweetnacl, base58 encode)
- POST `{ message, signature, userAddress }` to register_account

### 6.2 Withdraw (v1/withdraw_request)
**Function:** `OrderlyService.withdrawSol()`

Steps:
1. Create `WITHDRAW` message payload (brokerId, chainId, receiver, token, amount, withdrawNonce, timestamp, chainType, allowCrossChainWithdraw).
2. Sign message using user's Solana key (base58 ed25519).
3. Sign REST request headers using the **Orderly signing scheme (ed25519)**:
   - Headers required by Orderly: `orderly-timestamp`, `orderly-account-id`, `orderly-key`, `orderly-signature`
   - The `signOrderlyRequest` helper (in code) should produce those headers. It uses `@noble/ed25519` to sign the normalized string.
4. POST to `/v1/withdraw_request` with body:
```json
{
  "signature": "<hex-sig-or-prefixed?>",
  "userAddress": "<solana-address>",
  "verifyingContract": "<verifying contract address (vault ledger)>",
  "message": { ... }
}
```

**Important:** Code expects `orderlySecretKey` in base58 and converts to bytes (`bs58.decode`) before passing to signer.

### 6.3 Deposit (Solana vault program)
Deposit uses Anchor to call `depositSol` on the Solana vault program:

- `Program.methods.depositSol(depositParams, oappParams).accounts({...}).signers([user]).rpc();`
- `depositParams` includes:
  - `accountId` — user orderly account id as bytes (hex from 0x...)
  - `brokerHash` — `keccak256(brokerId)`
  - `tokenHash` — `keccak256('SOL')`
  - `userAddress` — user's public key buffer
  - `tokenAmount` — amount in lamports (BigInt)
- `oappParams` includes `nativeFee` and `lzTokenFee` (0n for now)

**Accounts** required include `vaultAuthority`, `solVault`, `peer`, `enforcedOptions`, `oappConfig`, and `systemProgram`. If `allowedBroker` / `allowedToken` are optional, pass `undefined` rather than `null`.

---

## 7) ChangeNow integration — APIs & tips

- `POST /exchange` — create a swap
  - Body example:
    ```json
    {
      "fromCurrency": "ada",
      "toCurrency": "sol",
      "fromNetwork": "cardano",
      "toNetwork": "sol",
      "fromAmount": "1.23",
      "address": "<payout address>",
      "flow": "standard"
    }
    ```
  - Response contains `id`, `payinAddress`, `payoutAddress`, `fromAmount`, `toAmount`, `flow`.
- `GET /exchange/by-id?id=<id>` — get exchange status (`created`, `exchanging`, `finished`, `failed`).

**Flow tips**
- When creating ChangeNow exchange for **deposit** (user → ADA → SOL), persist a `Transaction` with status `CHANGENOW_CREATED` immediately.
- After sending ADA tx to `payinAddress`, update status to `CHANGENOW_EXCHANGING` and store txHash in `refundHash`.
- Poll the exchange state in `ChangeNowWorker` and when `finished`, update the transaction to `CHANGENOW_COMPLETED` and then trigger final step (for deposit, call `depositSol` to Orderly; for withdraw, finalize COMPLETE and/or send ADA to user).

---

## 8) Solana integration — anchor & vaults

- `SolanaClient` wraps creation of Keypair from base58, connection, helper functions.
- Use `KeypairWallet` adapter to satisfy Anchor `Wallet` interface which must implement `publicKey`, `signTransaction` and `signAllTransactions`.
- When building `AnchorProvider`, pass the `KeypairWallet` instance (not a raw object with `publicKey` and `signTransaction`).
- The `solana.vaultIdl.json` is used to instantiate `Program`.

**Important constant checklist**
- `SOLANA_VAULT.PROGRAM_ID` — must be a **base58** value. If you accidentally put a hex string (e.g. `0x...` or `1826B7...`), `PublicKey` construction will throw `Non-base58 character`.
- `SOLANA_VAULT.LEDGER` in constants must be a Solana public key (base58). If it represents an Ethereum/hex address, keep it as plain string in verify fields but do not pass to `new PublicKey()`.

---

## 9) APIs implemented (controllers)

This section summarizes the main endpoints you have available (controller paths, short description). Some endpoints are used internally by your frontend and should be protected (Auth/Guard).

- `POST /orderly/register` — register user on Orderly (calls `registerAccountForUser`)
- `GET /orderly/account/status?userAddress=...` — check account existence
- `POST /orderly/deposit-sol` — (internal) deposit SOL from user's Solana key into Orderly vault (calls `depositSolForUser`)
- `POST /orderly/withdraw` — create withdrawal request, returns transaction id (calls `withdrawSol`)
- `POST /orderly/order` — place order (calls `createOrder`)
- `PUT /orderly/order` — edit order
- `DELETE /orderly/order` — cancel order
- `GET /orderly/orders` — get orders
- `GET /orderly/asset/history` — get asset deposit/withdraw history (proxy to orderly)
- `POST /orderly/settle_pnl` — settle pnl (signed by user)
- `POST /orderly/internal_transfer` — internal transfer helper

**DTOs**: See `src/orderly/dto/*` for exact payloads.

---

## 10) Workers (CRON tasks)

- `ChangeNowWorker` — cron `*/45 * * * * *`:
  - Polls transactions with statuses `CHANGENOW_CREATED` / `CHANGENOW_EXCHANGING`.
  - Calls ChangeNow `/exchange/by-id` and updates status (`CHANGENOW_EXCHANGING` → `CHANGENOW_COMPLETED`).
  - After ChangeNow `finished` on **deposit** flows, it should trigger `OrderlyService.depositSolForUser()` to move funds into Orderly vault (you need to wire this in the worker — see comment placeholders).
- `OrderlyWithdrawalWorker` — cron `*/30 * * * * *`:
  - Polls transactions with status `ORDERLY_WITHDRAW_PENDING`.
  - Calls `OrderlyService.getAssetHistory(...)` and searches for a matching `COMPLETED` withdraw entry.
  - On match, it creates ChangeNow exchange `SOL → ADA` and updates transaction to `CHANGENOW_CREATED`.

**Important:** Both workers must gracefully handle network timeouts and ensure idempotency (don't create duplicate ChangeNow exchanges for the same tx).

---



## 11) Example `.env` (skeleton)

```
NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:pass@localhost:5432/dbname

ORDERLY_BASE_URL=https://testnet-api.orderly.org
ORDERLY_BROKER_ID=woofi_pro
ORDERLY_CHAIN_ID=101
ORDERLY_KEY_PRIVATE_BASE58=...

CHANGENOW_API_URL=https://api.changenow.io
CHANGENOW_API_KEY=YOUR_CHANGE_NOW_KEY

SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_COMMITMENT=confirmed

JWT_SECRET=your_jwt_secret
ENCRYPTION_KEY=32BYTE_BASE64_KEY
```

---


