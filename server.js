/**
 * NewsHub Admin Backend — Express + SQLite API Server
 * 含登录认证 + 图形验证码
 */

const express = require('express');
const crypto = require('crypto');
const path = require('path');
const { getDb, queries } = require('./db');

const app = express();
const PORT = process.env.PORT || 3460;

// ==================== SESSION & CAPTCHA STORE ====================
const sessions = new Map();        // token → { username, createdAt }
const captchaStore = new Map();    // captchaId → { answer, createdAt }

// Clean expired sessions & captchas every 10 min
const SESSION_TTL = 8 * 60 * 60 * 1000; // 8 hours
const CAPTCHA_TTL = 5 * 60 * 1000;      // 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) { if (now - v.createdAt > SESSION_TTL) sessions.delete(k); }
  for (const [k, v] of captchaStore) { if (now - v.createdAt > CAPTCHA_TTL) captchaStore.delete(k); }
}, 600_000);

// ==================== MIDDLEWARE ====================
app.use(express.json());

// Auth middleware — checks cookie token
function requireAuth(req, res, next) {
  const token = req.cookies?.session_token || req.headers['x-session-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: '未登录或登录已过期', code: 'UNAUTHORIZED' });
  }
  req.session = sessions.get(token);
  next();
}

// Parse cookies (simple, no dependency)
app.use((req, _res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(c => {
      const [name, ...rest] = c.trim().split('=');
      if (name) req.cookies[name] = decodeURIComponent(rest.join('='));
    });
  }
  next();
});

// ==================== AUTH ROUTES ====================

// Generate captcha
function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let answer = '';
  for (let i = 0; i < 4; i++) answer += chars[Math.floor(Math.random() * chars.length)];

  const colors = ['#c7512e', '#3d8c5c', '#5b7fa8', '#c28d2e', '#6b6560', '#2d2b28'];
  const items = [];

  // background
  items.push('<rect width="160" height="56" fill="#faf9f6" rx="8"/>');

  // noise dots
  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(Math.random() * 160);
    const cy = Math.floor(Math.random() * 56);
    const r = (Math.random() * 2 + 0.4).toFixed(1);
    const op = (Math.random() * 0.35 + 0.05).toFixed(2);
    items.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#c4bfb8" opacity="${op}"/>`);
  }

  // noise lines
  for (let i = 0; i < 3; i++) {
    const x1 = Math.floor(Math.random() * 100);
    const y1 = Math.floor(Math.random() * 56);
    const x2 = x1 + Math.floor(Math.random() * 60 + 30);
    const y2 = Math.floor(Math.random() * 56);
    items.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d4cfc8" stroke-width="1.2" opacity="0.45"/>`);
  }

  // text characters
  for (let i = 0; i < answer.length; i++) {
    const x = 20 + i * 35 + (Math.random() * 8 - 4);
    const y = 38 + (Math.random() * 10 - 5);
    const rotate = (Math.random() * 32 - 16).toFixed(1);
    const size = Math.floor(24 + Math.random() * 8);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const skew = (Math.random() * 18 - 9).toFixed(1);
    const ch = answer[i];
    items.push(`<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" font-weight="bold" fill="${color}" transform="rotate(${rotate}, ${x}, ${y}) skewX(${skew})">${ch}</text>`);
  }

  // border
  items.push('<rect x="0.5" y="0.5" width="159" height="55" fill="none" stroke="#e8e4de" stroke-width="1" rx="8"/>');

  const svg = `<svg width="160" height="56" xmlns="http://www.w3.org/2000/svg">${items.join('')}</svg>`;
  return { answer, svg };
}

app.get('/api/auth/captcha', (_req, res) => {
  const { answer, svg } = generateCaptcha();
  const captchaId = crypto.randomUUID();
  captchaStore.set(captchaId, { answer, createdAt: Date.now() });
  res.json({ success: true, data: { captchaId, svg } });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password, captchaId, captchaAnswer } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  }
  if (!captchaId || !captchaAnswer) {
    return res.status(400).json({ success: false, message: '请输入验证码' });
  }

  // Verify captcha
  const captcha = captchaStore.get(captchaId);
  if (!captcha) {
    return res.status(400).json({ success: false, message: '验证码已过期，请刷新' });
  }
  if (captcha.answer.toLowerCase() !== captchaAnswer.toLowerCase()) {
    captchaStore.delete(captchaId);
    return res.status(400).json({ success: false, message: '验证码错误' });
  }
  captchaStore.delete(captchaId); // one-time use

  // Verify credentials — only admin account
  if (username !== 'xiaobai' || password !== 'xiaobai') {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  // Create session
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, createdAt: Date.now() });

  // Set cookie (HttpOnly, SameSite Lax)
  res.setHeader('Set-Cookie',
    `session_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_TTL / 1000}`
  );

  res.json({ success: true, data: { username }, message: '登录成功' });
});

app.post('/api/auth/logout', (req, res) => {
  const token = req.cookies?.session_token;
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0');
  res.json({ success: true, message: '已退出登录' });
});

app.get('/api/auth/check', (req, res) => {
  const token = req.cookies?.session_token;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: '未登录', code: 'UNAUTHORIZED' });
  }
  const session = sessions.get(token);
  res.json({ success: true, data: { username: session.username } });
});

// ==================== PROTECT ALL /api/* BELOW ====================
app.use('/api', (req, res, next) => {
  // Exclude auth routes (already handled above)
  if (req.path.startsWith('/auth/')) return next();
  requireAuth(req, res, next);
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard/stats', (_req, res) => {
  try {
    const stats = queries.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    console.error('[API] /dashboard/stats error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/dashboard/traffic', (_req, res) => {
  try {
    const data = queries.getTrafficData();
    res.json({ success: true, data });
  } catch (err) {
    console.error('[API] /dashboard/traffic error:', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== ARTICLES ====================

app.get('/api/articles', (req, res) => {
  try {
    const { status } = req.query;
    const articles = queries.getArticles(status);
    res.json({ success: true, data: articles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/articles/:id', (req, res) => {
  try {
    const article = queries.getArticleById(Number(req.params.id));
    if (!article) return res.status(404).json({ success: false, message: '文章不存在' });
    res.json({ success: true, data: article });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/articles', (req, res) => {
  try {
    const { title, author, category, status, excerpt, content, cover_url } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, message: '文章标题不能为空' });
    }
    const article = queries.createArticle({ title, author, category, status, excerpt, content, cover_url });
    res.status(201).json({ success: true, data: article, message: '文章创建成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/articles/:id', (req, res) => {
  try {
    const article = queries.updateArticle(req.params.id, req.body);
    if (!article) return res.status(404).json({ success: false, message: '文章不存在' });
    res.json({ success: true, data: article, message: '文章更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/articles/:id', (req, res) => {
  try {
    const ok = queries.deleteArticle(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: '文章不存在' });
    res.json({ success: true, message: '文章已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== CATEGORIES ====================

app.get('/api/categories', (_req, res) => {
  try {
    const categories = queries.getCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== COMMENTS ====================

app.get('/api/comments', (req, res) => {
  try {
    const { status } = req.query;
    const comments = queries.getComments(status);
    res.json({ success: true, data: comments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/comments/:id', (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: '无效的评论状态' });
    }
    const comment = queries.updateCommentStatus(req.params.id, status);
    if (!comment) return res.status(404).json({ success: false, message: '评论不存在' });
    res.json({ success: true, data: comment, message: '评论状态已更新' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== USERS ====================

app.get('/api/users', (_req, res) => {
  try {
    const users = queries.getUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== MEDIA ====================

app.get('/api/media', (_req, res) => {
  try {
    const media = queries.getMedia();
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== SETTINGS ====================

app.get('/api/settings', (_req, res) => {
  try {
    const settings = queries.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const settings = queries.updateSettings(req.body);
    res.json({ success: true, data: settings, message: '设置已保存' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== STATIC FILES ====================
// Block access to source code, database, and config files
app.use((req, res, next) => {
  const unsafe = ['.js', '.db', '.json', '.env', '.lock', '.md', '.yml', '.yaml', '.toml', '.sqlite'];
  const ext = path.extname(req.path).toLowerCase();
  if (unsafe.includes(ext)) return res.status(404).send('Not found');
  next();
});
app.use(express.static(path.join(__dirname)));

// ==================== FALLBACK ====================
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard.html'));
});

// ==================== BOOT ====================
getDb(); // initialize DB on startup

app.listen(PORT, () => {
  console.log(`\n  🗞️  NewsHub Admin API running at http://localhost:${PORT}`);
  console.log(`  🔐 Login →     http://localhost:${PORT}/login.html`);
  console.log(`  📊 Dashboard → http://localhost:${PORT}/admin-dashboard.html\n`);
});
