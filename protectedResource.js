// protectedResource.js
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const INTROSPECT = 'http://localhost:9001/introspect';

// ======= Middleware: lấy Bearer từ header/body/query theo RFC 6750 =======
function getAccessToken(req, res, next) {
  let token = null;

  // 1) Authorization: Bearer <token> (khuyến nghị)
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+([^\s]+)$/i);
  if (m) token = m[1];

  // 2) Hoặc body (form-encoded POST)
  if (!token && req.body && req.body.access_token) token = req.body.access_token;

  // 3) Hoặc query parameter
  if (!token && req.query && req.query.access_token) token = req.query.access_token;

  if (!token) {
    res.set('WWW-Authenticate', 'Bearer realm="photos", error="invalid_token"');
    return res.status(401).json({ error: 'invalid_token' });
  }
  req.token = token;
  next();
}

// ======= Kiểm tra token qua introspection và gán vào req.access =======
async function requireAccessToken(req, res, next) {
  try {
    const r = await axios.post(INTROSPECT, { token: req.token });
    if (!r.data || !r.data.active) {
      res.set('WWW-Authenticate', 'Bearer realm="photos", error="invalid_token"');
      return res.status(401).json({ error: 'invalid_token' });
    }
    req.access = r.data; // {active, sub, scope, client_id, exp}
    next();
  } catch (e) {
    return res.status(500).json({ error: 'server_error' });
  }
}

// ======= Dữ liệu mẫu & kiểm tra scope giống sách =======
const requireScope = (scope) => (req, res, next) => {
  const s = new Set((req.access.scope || '').split(' ').filter(Boolean));
  if (!s.has(scope)) {
    res.set('WWW-Authenticate', `Bearer error="insufficient_scope", scope="${scope}"`);
    return res.status(403).json({ error: 'insufficient_scope', required: scope });
  }
  next();
};

// /resource: ví dụ resource cơ bản (POST) — client sẽ gọi qua Bearer header
app.post('/resource', getAccessToken, requireAccessToken, (req, res) => {
  res.json({ success: true, user: req.access.sub, client: req.access.client_id });
});

// /favorites: trả dữ liệu theo “resource owner” (Alice/Bob) và scope
const aliceFavorites = {
  movies: ['The Multidmensional Vector', 'Space Fights', 'Jewelry Boss'],
  foods: ['bacon', 'pizza', 'bacon pizza'],
  music: ['techno', 'industrial', 'alternative']
};
const bobFavorites = {
  movies: ['Ansible: The Movie', 'React to the Future', 'OAuth Rocks'],
  foods: ['spaghetti', 'salad', 'bread'],
  music: ['classical', 'jazz', 'rock']
};

app.get('/favorites', getAccessToken, requireAccessToken, requireScope('foo'), (req, res) => {
  const who = (req.access.sub || 'unknown').toLowerCase();
  const data = who === 'alice' ? aliceFavorites : who === 'bob' ? bobFavorites : { movies: [], foods: [], music: [] };
  res.json({ user: who, favorites: data });
});

app.listen(9002, () => console.log('Protected Resource http://localhost:9002'));
