# OAuth 2.0 Demo (Node.js) — Client / Authorization Server / Protected Resource

A minimal three-app OAuth 2.0 demo inspired by the book **[OAuth 2 in Action](https://www.manning.com/books/oauth-2-in-action)** and the companion repo **[oauthinaction/oauth-in-action-code](https://github.com/oauthinaction/oauth-in-action-code)**.
It shows the **Authorization Code** flow end-to-end with simple in-memory stores.

---

## What’s inside

* **`authorizationServer`** (port **9001**): exposes `/authorize` and `/token`. Renders a tiny “approve” page and issues authorization codes & bearer tokens. Provides a simple `/introspect` for the resource server.
* **`protectedResource`** (port **9002**): exposes `/resource` and `/favorites`. Accepts bearer tokens from **header, body, or query** (for learning), verifies via introspection, and enforces scopes.
* **`client`** (port **9000**): starts the Authorization Code flow, exchanges the code for an access token, and calls the protected resource.

> Design and route names mirror the style used in the book examples, while keeping code small and readable.

---

## Architecture

```
Browser → Client (9000) → AS /authorize (9001) ──(redirect with code)→ Client /callback
Client → AS /token (9001) ──(access_token)→ Client
Client → Resource (9002) with Authorization: Bearer <token>
Resource → AS /introspect (9001) to validate token (demo)
```

---

## Requirements

* Node.js 18+
* npm

---

## Setup

```bash
# 1) Install deps once at the project root
npm init -y
npm i express body-parser express-session axios concurrently nodemon --save-dev
```

Place the three files in the root (or in folders as you prefer):

```
authorizationServer.js
protectedResource.js
client.js
```

---

## Run

### Option A — Three terminals (simplest)

```bash
nodemon authorizationServer.js   # http://localhost:9001
nodemon protectedResource.js     # http://localhost:9002
nodemon client.js                # http://localhost:9000
```

### Option B — One command with `concurrently`

Add to `package.json`:

```json
{
  "scripts": {
    "start": "concurrently \"nodemon authorizationServer.js\" \"nodemon protectedResource.js\" \"nodemon client.js\""
  }
}
```

Then:

```bash
npm start
```

---

## Try it

1. Open **[http://localhost:9000](http://localhost:9000)**
2. Click **“Get Authorization Code”** → approve (choose a demo user).
3. Back on the client home, click **“Get Protected Resource”** or **“Get Favorites (scope: foo)”**.

### Curl example

```bash
# After the client has an access token, call the resource directly:
curl -H "Authorization: Bearer <ACCESS_TOKEN>" http://localhost:9002/favorites
```

---

## Configuration (defaults)

The examples use these defaults (see each file’s `config` or in-memory structures):

* **Client**

  * `client_id`: `oauth-client-1`
  * `client_secret`: `oauth-client-secret-1`
  * `redirect_uri`: `http://localhost:9000/callback`
  * `scope`: `foo bar`

* **Authorization Server**

  * Registers the above client and validates `redirect_uri`
  * Issues short-lived bearer tokens (in memory)
  * `/introspect` for demo only

* **Protected Resource**

  * Requires a valid token
  * `GET /favorites` checks scope **`foo`**
  * Demonstrates per-user data (Alice/Bob) for learning

---

## Endpoints (quick reference)

### Authorization Server (9001)

* `GET /authorize` — start auth code flow
* `POST /approve` — demo consent page handler
* `POST /token` — exchange `authorization_code` → `access_token`
* `POST /introspect` — demo token check (not for production)

### Protected Resource (9002)

* `POST /resource` — simple echo with token subject/client
* `GET /favorites` — returns user favorites (requires `foo` scope)
* Accepts bearer token via header (`Authorization: Bearer`), body, or query (demo).

### Client (9000)

* `GET /authorize` — redirect to AS `/authorize`
* `GET /callback` — handle `code` and exchange token
* `GET /fetch_resource` — call `/resource`
* `GET /favorites` — call `/favorites`

---

## Notes & Learning Tips

* **Security**: This is a **learning** project. Do not use as-is in production. Add HTTPS, CSRF defenses, proper user auth at AS, real databases, and consider **PKCE** for public clients.
* **Scopes**: The client requests `foo bar`; resource enforces `foo` on `/favorites`.
* **Token transport**: RFC 6750 recommends **Authorization header**; body/query are shown only to match book exercises.

---

## Attribution

* Modeled after ***OAuth 2 in Action*** (Manning) and **oauthinaction/oauth-in-action-code**.
* This repository is for educational purposes. Please refer to the book and its license for original materials and guidance.