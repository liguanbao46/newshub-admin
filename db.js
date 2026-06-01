/**
 * NewsHub Admin — Database Layer (SQLite via better-sqlite3)
 * Tables: articles, categories, comments, users, media, settings, traffic_stats
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'newshub.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initTables();
    seedIfEmpty();
    console.log('[DB] SQLite initialized at', DB_PATH);
  }
  return db;
}

function initTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '时事',
      status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','review','published')),
      views INTEGER NOT NULL DEFAULT 0,
      comments_count INTEGER NOT NULL DEFAULT 0,
      excerpt TEXT DEFAULT '',
      content TEXT DEFAULT '',
      cover_url TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      count INTEGER NOT NULL DEFAULT 0,
      color TEXT NOT NULL DEFAULT '#c7512e',
      icon TEXT NOT NULL DEFAULT '📄'
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_name TEXT NOT NULL DEFAULT '匿名用户',
      content TEXT NOT NULL,
      article_id INTEGER NOT NULL,
      article_title TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT '编辑',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
      password_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      label TEXT NOT NULL DEFAULT '',
      size TEXT NOT NULL DEFAULT '0 KB',
      url TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS traffic_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      page_views INTEGER NOT NULL DEFAULT 0,
      unique_visitors INTEGER NOT NULL DEFAULT 0
    );
  `);
}

function seedIfEmpty() {
  const articleCount = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
  if (articleCount > 0) return;

  console.log('[DB] Seeding initial data...');

  const insertArticle = db.prepare(`INSERT INTO articles (title,author,category,status,views,comments_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)`);
  const articles = [
    ['2026年第一季度GDP增长超预期，经济复苏势头强劲', '张明', '财经', 'published', 45230, 128, '2026-05-29 09:30', '2026-05-29 09:30'],
    ['AI大模型新突破：国产模型在多语言理解上超越GPT', '李华', '科技', 'published', 38920, 256, '2026-05-29 08:15', '2026-05-29 08:15'],
    ['全国高考改革新方案公布，多地试点综合素质评价', '王芳', '时事', 'published', 28450, 89, '2026-05-28 16:45', '2026-05-28 16:45'],
    ['新能源汽车渗透率突破55%，燃油车市场持续萎缩', '陈涛', '财经', 'published', 22100, 67, '2026-05-28 14:20', '2026-05-28 14:20'],
    ['中国航天：新一代载人飞船完成首次无人轨道测试', '张明', '科技', 'review', 0, 0, '2026-05-28 11:00', '2026-05-28 11:00'],
    ['夏季食品安全预警发布，多地加强餐饮监管力度', '刘洋', '生活', 'draft', 0, 0, '2026-05-27 17:30', '2026-05-27 17:30'],
    ['欧冠决赛前瞻：两支豪门球队的巅峰对决', '赵磊', '体育', 'published', 56340, 412, '2026-05-27 15:00', '2026-05-27 15:00'],
    ['暑期档电影票房预测：国产科幻片备受期待', '孙悦', '娱乐', 'published', 19870, 95, '2026-05-27 10:20', '2026-05-27 10:20'],
  ];
  for (const a of articles) insertArticle.run(...a);

  const insertCategory = db.prepare(`INSERT INTO categories (name,count,color,icon) VALUES (?,?,?,?)`);
  const categories = [
    ['时事', 325, '#c7512e', '🌍'], ['财经', 218, '#3d8c5c', '📈'],
    ['科技', 467, '#5b7fa8', '💻'], ['体育', 189, '#8b5ea8', '⚽'],
    ['娱乐', 256, '#c28d2e', '🎬'], ['生活', 142, '#5b8c7a', '🏠'],
    ['教育', 98, '#6b7db3', '📚'], ['健康', 87, '#d4735e', '🏥'],
  ];
  for (const c of categories) insertCategory.run(...c);

  const insertComment = db.prepare(`INSERT INTO comments (user_name,content,article_id,article_title,status,created_at) VALUES (?,?,?,?,?,?)`);
  const comments = [
    ['读者小王', '非常有深度的分析，期待后续报道！', 1, '2026年第一季度GDP增长超预期...', 'approved', '2026-05-29 09:45'],
    ['科技爱好者', '国产AI发展速度确实让人振奋，希望能持续突破。', 2, 'AI大模型新突破...', 'approved', '2026-05-29 09:20'],
    ['匿名用户', '这篇文章写得不错，数据很详实。', 4, '新能源汽车渗透率...', 'pending', '2026-05-29 08:55'],
    ['球迷老张', '决赛一定很精彩，两队实力都很强！', 7, '欧冠决赛前瞻...', 'pending', '2026-05-29 08:30'],
    ['匿名用户', '希望教育改革能真正落地。', 3, '全国高考改革新方案...', 'rejected', '2026-05-29 07:40'],
  ];
  for (const c of comments) insertComment.run(...c);

  const insertUser = db.prepare(`INSERT INTO users (name,email,role,status,password_hash,created_at) VALUES (?,?,?,?,?,?)`);
  const users = [
    ['李明远', 'limingyuan@newshub.cn', '超级管理员', 'active', '', '2024-01-15'],
    ['张明', 'zhangming@newshub.cn', '编辑', 'active', '', '2024-03-22'],
    ['李华', 'lihua@newshub.cn', '编辑', 'active', '', '2024-05-10'],
    ['王芳', 'wangfang@newshub.cn', '编辑', 'active', '', '2024-06-18'],
    ['陈涛', 'chentao@newshub.cn', '审核员', 'active', '', '2024-08-05'],
    ['赵磊', 'zhaolei@newshub.cn', '编辑', 'inactive', '', '2025-01-20'],
  ];
  for (const u of users) insertUser.run(...u);

  const insertMedia = db.prepare(`INSERT INTO media (filename,label,size) VALUES (?,?,?)`);
  const mediaItems = [
    ['cover-headline.jpg', '封面-头条', '2.4 MB'], ['photo-tech.jpg', '配图-科技', '1.8 MB'],
    ['cover-finance.jpg', '封面-财经', '3.1 MB'], ['logo-icon.svg', '图标-Logo', '156 KB'],
    ['photo-sports.jpg', '配图-体育', '2.2 MB'], ['cover-entertainment.jpg', '封面-娱乐', '1.5 MB'],
    ['banner-ad.jpg', '广告横幅', '892 KB'], ['photo-life.jpg', '配图-生活', '2.7 MB'],
  ];
  for (const m of mediaItems) insertMedia.run(...m);

  const insertTraffic = db.prepare(`INSERT INTO traffic_stats (date,page_views,unique_visitors) VALUES (?,?,?)`);
  const traffic = [
    ['2026-05-23', 98400, 32100], ['2026-05-24', 102300, 33400],
    ['2026-05-25', 118500, 38700], ['2026-05-26', 95600, 31200],
    ['2026-05-27', 112800, 36800], ['2026-05-28', 108900, 35500],
    ['2026-05-29', 128450, 41900],
  ];
  for (const t of traffic) insertTraffic.run(...t);

  // Default settings
  const insertSetting = db.prepare(`INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)`);
  insertSetting.run('site_name', 'NewsHub');
  insertSetting.run('site_description', '专业新闻资讯平台');
  insertSetting.run('review_enabled', 'true');
  insertSetting.run('comments_require_review', 'true');
  insertSetting.run('seo_title', 'NewsHub - 专业新闻资讯平台');
  insertSetting.run('seo_description', 'NewsHub提供最新、最全面的新闻资讯');

  console.log('[DB] Seed complete —', articleCount, '→', articles.length, 'articles');
}

// ==================== QUERY HELPERS ====================

const queries = {
  // Dashboard
  getDashboardStats: () => {
    const totalArticles = db.prepare('SELECT COUNT(*) as c FROM articles').get().c;
    const totalViews = db.prepare('SELECT COALESCE(SUM(views),0) as c FROM articles').get().c;
    const totalComments = db.prepare('SELECT COUNT(*) as c FROM comments').get().c;
    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const pendingComments = db.prepare("SELECT COUNT(*) as c FROM comments WHERE status='pending'").get().c;
    const draftArticles = db.prepare("SELECT COUNT(*) as c FROM articles WHERE status='draft'").get().c;
    return { totalArticles, totalViews, totalComments, totalUsers, pendingComments, draftArticles };
  },

  getTrafficData: () => {
    return db.prepare('SELECT date, page_views, unique_visitors FROM traffic_stats ORDER BY date ASC LIMIT 7').all();
  },

  // Articles
  getArticles: (status) => {
    if (status && status !== 'all') {
      return db.prepare('SELECT * FROM articles WHERE status=? ORDER BY updated_at DESC').all(status);
    }
    return db.prepare('SELECT * FROM articles ORDER BY updated_at DESC').all();
  },

  getArticleById: (id) => db.prepare('SELECT * FROM articles WHERE id=?').get(id),

  createArticle: (data) => {
    const stmt = db.prepare(`INSERT INTO articles (title,author,category,status,excerpt,content,cover_url) VALUES (?,?,?,?,?,?,?)`);
    const result = stmt.run(data.title, data.author || '', data.category || '时事', data.status || 'draft', data.excerpt || '', data.content || '', data.cover_url || '');
    return queries.getArticleById(result.lastInsertRowid);
  },

  updateArticle: (id, data) => {
    const existing = queries.getArticleById(Number(id));
    if (!existing) return null;
    const stmt = db.prepare(`UPDATE articles SET title=?,author=?,category=?,status=?,excerpt=?,content=?,cover_url=?,updated_at=datetime('now','localtime') WHERE id=?`);
    stmt.run(
      data.title ?? existing.title, data.author ?? existing.author,
      data.category ?? existing.category, data.status ?? existing.status,
      data.excerpt ?? existing.excerpt, data.content ?? existing.content,
      data.cover_url ?? existing.cover_url, Number(id)
    );
    return queries.getArticleById(Number(id));
  },

  deleteArticle: (id) => {
    const existing = queries.getArticleById(Number(id));
    if (!existing) return false;
    db.prepare('DELETE FROM articles WHERE id=?').run(Number(id));
    return true;
  },

  // Categories
  getCategories: () => db.prepare('SELECT * FROM categories ORDER BY count DESC').all(),

  // Comments
  getComments: (status) => {
    if (status && status !== 'all') {
      return db.prepare('SELECT * FROM comments WHERE status=? ORDER BY created_at DESC').all(status);
    }
    return db.prepare('SELECT * FROM comments ORDER BY created_at DESC').all();
  },

  updateCommentStatus: (id, status) => {
    const existing = db.prepare('SELECT * FROM comments WHERE id=?').get(Number(id));
    if (!existing) return null;
    db.prepare('UPDATE comments SET status=? WHERE id=?').run(status, Number(id));
    return db.prepare('SELECT * FROM comments WHERE id=?').get(Number(id));
  },

  // Users
  getUsers: () => db.prepare('SELECT id,name,email,role,status,created_at FROM users ORDER BY id ASC').all(),

  // Media
  getMedia: () => db.prepare('SELECT * FROM media ORDER BY created_at DESC').all(),

  // Settings
  getSettings: () => {
    const rows = db.prepare('SELECT * FROM settings').all();
    const map = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  },

  updateSettings: (settings) => {
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)');
    for (const [key, value] of Object.entries(settings)) {
      stmt.run(key, String(value));
    }
    return queries.getSettings();
  },
};

module.exports = { getDb, queries };
