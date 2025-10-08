// authorizationServer.js
const express = require('express');
const bodyParser = require('body-parser');
const querystring = require('querystring');
const crypto = require('crypto');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// ======= In-memory data stores (giống mẫu sách) =======
const clients = [
  {
    client_id: 'oauth-client-1',
    client_secret: 'oauth-client-secret-1',
    redirect_uris: ['http://localhost:9000/callback'],
    scope: 'foo bar' // sách có ví dụ khai báo scope cho client để kiểm soát phạm vi yêu cầu
  }
];

const authorizationCodes = new Map(); // code -> { client_id, redirect_uri, scope, user }
const accessTokens = new Map();       // token -> { client_id, scope, user, exp }

// ======= Helpers =======
const findClient = (id) => clients.find(c => c.client_id === id);
const gen = (len=32) => crypto.randomBytes(len).toString('hex');

// Demo “đăng nhập”/chọn user tại AS (sách cũng cho phép chọn Alice/Bob ở trang approve)
const USERS = ['alice', 'bob'];

// ======= Authorization Endpoint (GET /authorize) =======
// /authorize?response_type=code&client_id=...&redirect_uri=...&scope=...&state=...
app.get('/authorize', (req, res) => {
  const { response_type, client_id, redirect_uri, scope, state } = req.query;

  const client = findClient(client_id);
  if (response_type !== 'code' || !client) return res.status(400).send('invalid_request');
  if (!client.redirect_uris.includes(redirect_uri)) return res.status(400).send('invalid_redirect_uri');

  const rscope = scope ? scope.split(' ') : undefined;
  const cscope = client.scope ? client.scope.split(' ') : undefined;

  if (rscope && cscope && rscope.some(s => !cscope.includes(s))) {
    return res.status(400).send('invalid_scope');
  }

  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Authorization Request</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .container {
          background: white;
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          padding: 40px;
          max-width: 500px;
          width: 100%;
        }
        h3 {
          color: #333;
          margin-bottom: 10px;
          font-size: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .subtitle {
          color: #666;
          margin-bottom: 25px;
          font-size: 14px;
        }
        .app-info {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
        }
        .app-info p {
          margin: 10px 0;
          color: #555;
          font-size: 14px;
        }
        .app-info strong {
          color: #333;
          font-weight: 600;
        }
        .app-info code {
          background: #e9ecef;
          padding: 2px 8px;
          border-radius: 4px;
          font-family: 'Courier New', monospace;
          color: #d63384;
          font-size: 13px;
        }
        .app-name {
          font-size: 18px;
          color: #f5576c;
          font-weight: 700;
        }
        .form-group {
          margin-bottom: 20px;
        }
        label {
          display: block;
          margin-bottom: 8px;
          color: #333;
          font-weight: 500;
          font-size: 14px;
        }
        select {
          width: 100%;
          padding: 12px;
          border: 2px solid #e9ecef;
          border-radius: 8px;
          font-size: 15px;
          background: white;
          cursor: pointer;
          transition: border-color 0.3s;
        }
        select:focus {
          outline: none;
          border-color: #f5576c;
        }
        .button-group {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-top: 25px;
        }
        button {
          padding: 14px 24px;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: all 0.3s ease;
        }
        .btn-approve {
          background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
          color: white;
        }
        .btn-approve:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(245, 87, 108, 0.4);
        }
        .btn-deny {
          background: #f8f9fa;
          color: #666;
          border: 2px solid #e9ecef;
        }
        .btn-deny:hover {
          background: #e9ecef;
          transform: translateY(-2px);
        }
        .scope-badge {
          display: inline-block;
          background: #fff3cd;
          color: #856404;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          margin: 2px;
        }
        .permissions {
          background: #d1ecf1;
          border-left: 4px solid #0c5460;
          padding: 15px;
          border-radius: 4px;
          margin-bottom: 20px;
        }
        .permissions p {
          color: #0c5460;
          font-size: 13px;
          font-weight: 500;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h3>🔐 Authorization Request</h3>
        <p class="subtitle">An application is requesting access to your account</p>
        
        <div class="app-info">
          <p><strong>Application:</strong></p>
          <p class="app-name">${client_id}</p>
          <p style="margin-top: 15px"><strong>Requested Permissions:</strong></p>
          <p>${scope ? scope.split(' ').map(s => `<span class="scope-badge">${s}</span>`).join('') : '<code>(none)</code>'}</p>
        </div>

        <div class="permissions">
          <p>⚠️ This application will be able to access your protected resources</p>
        </div>
        
        <form method="POST" action="/approve">
          <input type="hidden" name="client_id" value="${client_id}"/>
          <input type="hidden" name="redirect_uri" value="${redirect_uri}"/>
          <input type="hidden" name="state" value="${state || ''}"/>
          <input type="hidden" name="scope" value="${scope || ''}"/>
          
          <div class="form-group">
            <label>👤 Select User Account (Demo):</label>
            <select name="user">
              ${USERS.map(u => `<option value="${u}">${u.charAt(0).toUpperCase() + u.slice(1)}</option>`).join('')}
            </select>
          </div>
          
          <div class="button-group">
            <button type="submit" name="approve" value="yes" class="btn-approve">✓ Approve</button>
            <button type="submit" name="approve" value="no" class="btn-deny">✗ Deny</button>
          </div>
        </form>
      </div>
    </body>
    </html>
  `);
});

// ======= Approve (POST /approve) — phát authorization code =======
app.post('/approve', (req, res) => {
  const { approve, client_id, redirect_uri, state, scope, user } = req.body;
  const client = findClient(client_id);
  if (!client || !client.redirect_uris.includes(redirect_uri)) {
    return res.status(400).send('invalid_client_or_redirect');
  }
  if (approve !== 'yes') {
    const location = `${redirect_uri}?${querystring.stringify({ error: 'access_denied', state })}`;
    return res.redirect(location);
  }

  const code = gen(16);
  authorizationCodes.set(code, {
    client_id,
    redirect_uri,
    scope: (scope || '').split(' ').filter(Boolean),
    user: { sub: user || 'alice' }
  });

  const location = `${redirect_uri}?${querystring.stringify({ code, state })}`;
  return res.redirect(location);
});

// ======= Token Endpoint (POST /token) =======
app.post('/token', (req, res) => {
  const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;
  const client = findClient(client_id);
  if (!client || client.client_secret !== client_secret) {
    return res.status(401).json({ error: 'invalid_client' });
  }
  if (grant_type !== 'authorization_code') {
    return res.status(400).json({ error: 'unsupported_grant_type' });
  }

  const payload = authorizationCodes.get(code);
  if (!payload) return res.status(400).json({ error: 'invalid_grant' });
  if (payload.client_id !== client_id || payload.redirect_uri !== redirect_uri) {
    return res.status(400).json({ error: 'invalid_grant' });
  }
  authorizationCodes.delete(code);

  const access_token = gen(32);
  accessTokens.set(access_token, {
    client_id,
    scope: payload.scope,
    user: payload.user,
    exp: Math.floor(Date.now()/1000) + 3600
  });

  // Trả về Bearer token + scope như mẫu
  res.json({
    access_token,
    token_type: 'Bearer',
    scope: payload.scope.join(' '),
    expires_in: 3600
  });
});

// ======= (tùy chọn) Introspection tối giản cho resource =======
app.post('/introspect', (req, res) => {
  const { token } = req.body || {};
  const t = token && accessTokens.get(token);
  if (!t) return res.json({ active: false });
  res.json({
    active: true,
    client_id: t.client_id,
    scope: t.scope.join(' '),
    sub: t.user.sub,
    exp: t.exp
  });
});

app.listen(9001, () => console.log('Authorization Server http://localhost:9001'));
