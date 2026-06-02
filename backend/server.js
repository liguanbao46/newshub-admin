/**
 * NewsHub Admin Backend — Express + MySQL 8.0 API Server (前后端分离)
 * 端口: 3001 | 认证: Bearer Token | 跨域: CORS enabled | 数据库: MySQL 8.0.12
 */

const express = require('express');
const crypto = require('crypto');
const cors = require('cors');
const { getDb, queries } = require('./db');

const app = express();
const PORT = process.env.PORT || 3001;

// ==================== SESSION & CAPTCHA STORE ====================
const sessions = new Map();        // token → { username, createdAt }
const captchaStore = new Map();    // captchaId → { answer, createdAt }

const SESSION_TTL = 8 * 60 * 60 * 1000;
const CAPTCHA_TTL = 5 * 60 * 1000;
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of sessions) { if (now - v.createdAt > SESSION_TTL) sessions.delete(k); }
  for (const [k, v] of captchaStore) { if (now - v.createdAt > CAPTCHA_TTL) captchaStore.delete(k); }
}, 600_000);

// ==================== MIDDLEWARE ====================
app.use(cors({
  origin: ['http://localhost:5500', 'http://localhost:3000', 'http://localhost:8080', 'http://127.0.0.1:5500', 'http://127.0.0.1:3000'],
  credentials: true,
}));
app.use(express.json());

// Auth middleware
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: '未登录或登录已过期', code: 'UNAUTHORIZED' });
  }
  req.session = sessions.get(token);
  next();
}

// Public route paths (relative to /api mount) — these skip auth
const PUBLIC_API_PATHS = new Set([
  '/categories/tree', '/articles/featured', '/articles/hot',
  '/categories/children',
]);

function isPublicGet(req) {
  // Auth routes are always public
  if (req.path.startsWith('/auth/')) return true;
  // Public news routes
  if (PUBLIC_API_PATHS.has(req.path)) return true;
  // /articles/:id is public for GET
  if (req.method === 'GET' && /^\/articles\/\d+$/.test(req.path)) return true;
  // /articles?public=1
  if (req.method === 'GET' && req.path === '/articles' && req.query.public) return true;
  return false;
}

// ==================== AUTH ROUTES ====================

function generateCaptcha() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let answer = '';
  for (let i = 0; i < 4; i++) answer += chars[Math.floor(Math.random() * chars.length)];

  const colors = ['#c7512e', '#3d8c5c', '#5b7fa8', '#c28d2e', '#6b6560', '#2d2b28'];
  const items = [];
  items.push('<rect width="160" height="56" fill="#faf9f6" rx="8"/>');
  for (let i = 0; i < 40; i++) {
    const cx = Math.floor(Math.random() * 160);
    const cy = Math.floor(Math.random() * 56);
    const r = (Math.random() * 2 + 0.4).toFixed(1);
    const op = (Math.random() * 0.35 + 0.05).toFixed(2);
    items.push(`<circle cx="${cx}" cy="${cy}" r="${r}" fill="#c4bfb8" opacity="${op}"/>`);
  }
  for (let i = 0; i < 3; i++) {
    const x1 = Math.floor(Math.random() * 100);
    const y1 = Math.floor(Math.random() * 56);
    const x2 = x1 + Math.floor(Math.random() * 60 + 30);
    const y2 = Math.floor(Math.random() * 56);
    items.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#d4cfc8" stroke-width="1.2" opacity="0.45"/>`);
  }
  for (let i = 0; i < answer.length; i++) {
    const x = 20 + i * 35 + (Math.random() * 8 - 4);
    const y = 38 + (Math.random() * 10 - 5);
    const rotate = (Math.random() * 32 - 16).toFixed(1);
    const size = Math.floor(24 + Math.random() * 8);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const skew = (Math.random() * 18 - 9).toFixed(1);
    items.push(`<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" font-weight="bold" fill="${color}" transform="rotate(${rotate}, ${x}, ${y}) skewX(${skew})">${answer[i]}</text>`);
  }
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
  if (!username || !password) return res.status(400).json({ success: false, message: '请输入用户名和密码' });
  if (!captchaId || !captchaAnswer) return res.status(400).json({ success: false, message: '请输入验证码' });

  const captcha = captchaStore.get(captchaId);
  if (!captcha) return res.status(400).json({ success: false, message: '验证码已过期，请刷新' });
  if (captcha.answer.toLowerCase() !== captchaAnswer.toLowerCase()) {
    captchaStore.delete(captchaId);
    return res.status(400).json({ success: false, message: '验证码错误' });
  }
  captchaStore.delete(captchaId);

  if (username !== 'xiaobai' || password !== 'xiaobai') {
    return res.status(401).json({ success: false, message: '用户名或密码错误' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username, createdAt: Date.now() });
  res.json({ success: true, data: { username, token }, message: '登录成功' });
});

app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (token) sessions.delete(token);
  res.json({ success: true, message: '已退出登录' });
});

app.get('/api/auth/check', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, message: '未登录', code: 'UNAUTHORIZED' });
  }
  const session = sessions.get(token);
  res.json({ success: true, data: { username: session.username } });
});

// ==================== PUBLIC NEWS ROUTES (NO AUTH) ====================

// Category tree — for news page navigation
app.get('/api/categories/tree', async (_req, res) => {
  try {
    const tree = await queries.getCategoryTree();
    res.json({ success: true, data: tree });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Sub-categories for a parent
app.get('/api/categories/children', async (req, res) => {
  try {
    const { parent_id } = req.query;
    if (!parent_id) {
      const tree = await queries.getCategoryTree();
      return res.json({ success: true, data: tree });
    }
    const children = await queries.getSubCategories(parent_id);
    res.json({ success: true, data: children });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Featured articles — carousel
app.get('/api/articles/featured', async (_req, res) => {
  try {
    const articles = await queries.getFeaturedArticles();
    res.json({ success: true, data: articles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Hot articles — sidebar
app.get('/api/articles/hot', async (_req, res) => {
  try {
    const articles = await queries.getHotArticles();
    res.json({ success: true, data: articles });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public article reading (single)
app.get('/api/articles/:id', async (req, res) => {
  try {
    const article = await queries.getArticleById(Number(req.params.id));
    if (!article) return res.status(404).json({ success: false, message: '文章不存在' });
    // Only show published unless the user is authenticated
    if (article.status !== 'published') {
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
      if (!token || !sessions.has(token)) {
        return res.status(404).json({ success: false, message: '文章不存在' });
      }
    }
    res.json({ success: true, data: article });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Public published articles list (for news page)
app.get('/api/articles', async (req, res) => {
  // If public=true, serve published articles only
  if (req.query.public) {
    try {
      const { category, sub_category, page, limit } = req.query;
      const result = await queries.getArticlesPublic({ category, sub_category, page, limit });
      return res.json({ success: true, ...result });
    } catch (err) {
      return res.status(500).json({ success: false, message: err.message });
    }
  }
  // Otherwise require auth (fall through to middleware)
  requireAuth(req, res, async () => {
    try {
      const { status } = req.query;
      const articles = await queries.getArticles(status);
      res.json({ success: true, data: articles });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  });
});

// ==================== AUTH-GATED ROUTES BELOW ====================
// All /api/* routes that aren't explicitly handled above require auth

app.use('/api', (req, res, next) => {
  if (isPublicGet(req)) return next();
  if (req.path.startsWith('/auth/')) return next();
  requireAuth(req, res, next);
});

// ==================== DASHBOARD ====================

app.get('/api/dashboard/stats', async (_req, res) => {
  try {
    const stats = await queries.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/dashboard/traffic', async (_req, res) => {
  try {
    const data = await queries.getTrafficData();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== ARTICLES (admin CRUD) ====================

app.post('/api/articles', async (req, res) => {
  try {
    const { title, author, category, sub_category, status, excerpt, content, cover_url, is_featured, featured_order } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ success: false, message: '文章标题不能为空' });
    const article = await queries.createArticle({ title, author, category, sub_category, status, excerpt, content, cover_url, is_featured, featured_order });
    res.status(201).json({ success: true, data: article, message: '文章创建成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/articles/:id', async (req, res) => {
  try {
    const article = await queries.updateArticle(req.params.id, req.body);
    if (!article) return res.status(404).json({ success: false, message: '文章不存在' });
    res.json({ success: true, data: article, message: '文章更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/articles/:id', async (req, res) => {
  try {
    const ok = await queries.deleteArticle(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: '文章不存在' });
    res.json({ success: true, message: '文章已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== CATEGORIES (admin CRUD) ====================

app.get('/api/categories', async (_req, res) => {
  try {
    const categories = await queries.getCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/categories', async (req, res) => {
  try {
    const { name, color, icon, parent_id } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ success: false, message: '分类名称不能为空' });
    const category = await queries.createCategory({ name, color, icon, parent_id: parent_id || null });
    res.status(201).json({ success: true, data: category, message: '分类创建成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const category = await queries.updateCategory(req.params.id, req.body);
    if (!category) return res.status(404).json({ success: false, message: '分类不存在或操作无效' });
    res.json({ success: true, data: category, message: '分类更新成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const ok = await queries.deleteCategory(req.params.id);
    if (!ok) return res.status(404).json({ success: false, message: '分类不存在' });
    res.json({ success: true, message: '分类已删除' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== COMMENTS ====================

app.get('/api/comments', async (req, res) => {
  try {
    const { status } = req.query;
    const comments = await queries.getComments(status);
    res.json({ success: true, data: comments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/comments/:id', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, message: '无效的评论状态' });
    }
    const comment = await queries.updateCommentStatus(req.params.id, status);
    if (!comment) return res.status(404).json({ success: false, message: '评论不存在' });
    res.json({ success: true, data: comment, message: '评论状态已更新' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== USERS ====================

app.get('/api/users', async (_req, res) => {
  try {
    const users = await queries.getUsers();
    res.json({ success: true, data: users });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== MEDIA ====================

app.get('/api/media', async (_req, res) => {
  try {
    const media = await queries.getMedia();
    res.json({ success: true, data: media });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== SETTINGS ====================

app.get('/api/settings', async (_req, res) => {
  try {
    const settings = await queries.getSettings();
    res.json({ success: true, data: settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    const settings = await queries.updateSettings(req.body);
    res.json({ success: true, data: settings, message: '设置已保存' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ==================== BOOT ====================
getDb().then(() => {
  app.listen(PORT, () => {
    console.log('\n  🗞️  NewsHub Admin API (前后端分离 + MySQL)');
    console.log('  🔌 API → http://localhost:' + PORT);
    console.log('  🗄️  DB → MySQL 8.0.12 @ newshub_admin');
    console.log('  🔐 Captcha → http://localhost:' + PORT + '/api/auth/captcha');
    console.log('  📰 Public → http://localhost:' + PORT + '/api/categories/tree\n');
  });
});
