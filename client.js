// client.js
const express = require('express');
const session = require('express-session');
const axios = require('axios');
const querystring = require('querystring');
const crypto = require('crypto');

const app = express();
app.use(session({ secret: 'dev-secret', resave: false, saveUninitialized: true }));

const config = {
    client_id: 'oauth-client-1',
    client_secret: 'oauth-client-secret-1',
    authorize_endpoint: 'http://localhost:9001/authorize',
    token_endpoint: 'http://localhost:9001/token',
    redirect_uri: 'http://localhost:9000/callback',
    protected_resource: 'http://localhost:9002/resource',
    favorites_resource: 'http://localhost:9002/favorites',
    scope: 'foo bar'
};

app.get('/', (req, res) => {
    const token = req.session.access_token ? `✅ ${req.session.access_token.slice(0, 12)}…` : '❌ none';
    const scope = req.session.scope || 'none';
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>OAuth Client Demo</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
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
          max-width: 600px;
          width: 100%;
        }
        h2 {
          color: #333;
          margin-bottom: 10px;
          font-size: 28px;
        }
        .subtitle {
          color: #666;
          margin-bottom: 30px;
          font-size: 14px;
        }
        .info-box {
          background: #f8f9fa;
          border-left: 4px solid #667eea;
          padding: 15px;
          margin-bottom: 20px;
          border-radius: 4px;
        }
        .info-box p {
          margin: 8px 0;
          color: #555;
          font-size: 14px;
        }
        .info-box strong {
          color: #333;
          font-weight: 600;
        }
        .info-box code {
          background: #e9ecef;
          padding: 2px 6px;
          border-radius: 3px;
          font-family: 'Courier New', monospace;
          font-size: 13px;
        }
        .actions {
          display: grid;
          gap: 12px;
          margin-top: 25px;
        }
        .btn {
          display: block;
          padding: 14px 24px;
          text-decoration: none;
          border-radius: 8px;
          font-weight: 500;
          text-align: center;
          transition: all 0.3s ease;
          font-size: 15px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }
        .btn-primary:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
        }
        .btn-secondary {
          background: #f8f9fa;
          color: #333;
          border: 2px solid #e9ecef;
        }
        .btn-secondary:hover {
          background: #e9ecef;
          transform: translateY(-2px);
        }
        .btn-danger {
          background: #fff;
          color: #dc3545;
          border: 2px solid #dc3545;
        }
        .btn-danger:hover {
          background: #dc3545;
          color: white;
          transform: translateY(-2px);
        }
        .token-status {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
        }
        .token-active {
          background: #d4edda;
          color: #155724;
        }
        .token-inactive {
          background: #f8d7da;
          color: #721c24;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>🔐 OAuth Client Demo</h2>
        <p class="subtitle">Authorization Code Flow Implementation</p>
        
        <div class="info-box">
          <p><strong>Access Token:</strong> <code>${token}</code></p>
          <p><strong>Granted Scope:</strong> <code>${scope}</code></p>
          <p><strong>Status:</strong> <span class="token-status ${req.session.access_token ? 'token-active' : 'token-inactive'}">${req.session.access_token ? 'Authenticated' : 'Not Authenticated'}</span></p>
        </div>
        
        <div class="actions">
          <a href="/authorize" class="btn btn-primary">🔑 Get Authorization Code</a>
          <a href="/fetch_resource" class="btn btn-secondary">📦 Get Protected Resource</a>
          <a href="/favorites" class="btn btn-secondary">⭐ Get Favorites (scope: foo)</a>
          <a href="/logout" class="btn btn-danger">🚪 Logout & Clear Session</a>
        </div>
      </div>
    </body>
    </html>
  `);
});

// Bước 1: chuyển hướng tới /authorize
app.get('/authorize', (req, res) => {
    const state = crypto.randomBytes(8).toString('hex');
    req.session.state = state;
    const url = `${config.authorize_endpoint}?` + querystring.stringify({
        response_type: 'code',
        client_id: config.client_id,
        redirect_uri: config.redirect_uri,
        scope: config.scope,
        state
    });
    res.redirect(url);
});

// Bước 2: nhận code và đổi token tại /token
app.get('/callback', async (req, res) => {
    const { code, state } = req.query;
    if (!code || state !== req.session.state) {
        return res.status(400).send('state_mismatch_or_missing_code');
    }
    try {
        const body = querystring.stringify({
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.redirect_uri,
            client_id: config.client_id,
            client_secret: config.client_secret
        });
        const r = await axios.post(config.token_endpoint, body, {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        req.session.access_token = r.data.access_token;
        req.session.scope = r.data.scope || '';
        res.redirect('/');
    } catch (e) {
        res.status(400).send('token_exchange_failed');
    }
});

// Bước 3: dùng token với protected resource (POST /resource)
app.get('/fetch_resource', async (req, res) => {
    if (!req.session.access_token) {
        return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .error-box {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          .error-icon { font-size: 48px; margin-bottom: 20px; }
          h3 { color: #dc3545; margin-bottom: 10px; }
          p { color: #666; margin-bottom: 25px; }
          .btn {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="error-box">
          <div class="error-icon">🔒</div>
          <h3>Access Token Required</h3>
          <p>You need to authenticate first to access this resource.</p>
          <a href="/" class="btn">← Back to Home</a>
        </div>
      </body>
      </html>
    `);
    }
    try {
        const r = await axios.post(
            config.protected_resource,
            {},
            { headers: { Authorization: `Bearer ${req.session.access_token}` } }
        );
        res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            padding: 20px;
            margin: 0;
          }
          .container {
            max-width: 800px;
            margin: 40px auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
          }
          h2 { color: #333; margin-bottom: 20px; }
          pre {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            border-left: 4px solid #667eea;
            font-size: 14px;
            line-height: 1.6;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
          }
          .success-badge {
            display: inline-block;
            background: #d4edda;
            color: #155724;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>📦 Protected Resource Response</h2>
          <div class="success-badge">✓ Success</div>
          <pre>${JSON.stringify(r.data, null, 2)}</pre>
          <a href="/" class="btn">← Back to Home</a>
        </div>
      </body>
      </html>
    `);
    } catch (e) {
        console.log("ERROR FROM PR: ", e);
        res.status(400).send('resource_call_failed');
    }
});

// Gọi /favorites (cần scope foo)
app.get('/favorites', async (req, res) => {
    if (!req.session.access_token) {
        return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f8f9fa;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 100vh;
            margin: 0;
          }
          .error-box {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 400px;
          }
          .error-icon { font-size: 48px; margin-bottom: 20px; }
          h3 { color: #dc3545; margin-bottom: 10px; }
          p { color: #666; margin-bottom: 25px; }
          .btn {
            display: inline-block;
            padding: 12px 30px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
          }
        </style>
      </head>
      <body>
        <div class="error-box">
          <div class="error-icon">🔒</div>
          <h3>Access Token Required</h3>
          <p>You need to authenticate first to access favorites.</p>
          <a href="/" class="btn">← Back to Home</a>
        </div>
      </body>
      </html>
    `);
    }
    try {
        const r = await axios.get(config.favorites_resource, {
            headers: { Authorization: `Bearer ${req.session.access_token}` }
        });
        res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            min-height: 100vh;
            padding: 20px;
            margin: 0;
          }
          .container {
            max-width: 800px;
            margin: 40px auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            padding: 40px;
          }
          h2 { color: #333; margin-bottom: 20px; }
          pre {
            background: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            border-left: 4px solid #f5576c;
            font-size: 14px;
            line-height: 1.6;
          }
          .btn {
            display: inline-block;
            padding: 12px 24px;
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
            color: white;
            text-decoration: none;
            border-radius: 8px;
            font-weight: 600;
            margin-top: 20px;
          }
          .success-badge {
            display: inline-block;
            background: #d4edda;
            color: #155724;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 13px;
            font-weight: 600;
            margin-bottom: 20px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h2>⭐ User Favorites</h2>
          <div class="success-badge">✓ Success (scope: foo)</div>
          <pre>${JSON.stringify(r.data, null, 2)}</pre>
          <a href="/" class="btn">← Back to Home</a>
        </div>
      </body>
      </html>
    `);
    } catch (e) {
        console.log("ERROR FROM PR: ", e);
        res.status(400).send('favorites_call_failed');
    }
});

app.get('/logout', (req, res) => req.session.destroy(() => res.redirect('/')));

app.listen(9000, () => console.log('Client http://localhost:9000'));
