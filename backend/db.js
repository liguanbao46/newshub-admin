/**
 * NewsHub Admin — Database Layer (MySQL 8.0 via mysql2/promise)
 * Tables: articles, categories (parent_id tree), comments, users, media, settings, traffic_stats
 */

const mysql = require('mysql2/promise');

const DB_CONFIG = {
  host: '127.0.0.1',
  port: 3306,
  user: 'root',
  password: 'root',
  database: 'newshub_admin',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
};

let pool;

async function getDb() {
  if (!pool) {
    pool = mysql.createPool(DB_CONFIG);
    const conn = await pool.getConnection();
    await conn.ping();
    conn.release();
    await initTables();
    await seedIfEmpty();
    console.log('[DB] MySQL connected — newshub_admin @ 127.0.0.1:3306');
  }
  return pool;
}

function saveDb() {}

async function initTables() {
  const [rows] = await pool.query("SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema='newshub_admin'");
  console.log('[DB] Tables verified:', rows[0].c, 'tables found');
}

async function seedIfEmpty() {
  const [rows] = await pool.query('SELECT COUNT(*) AS c FROM articles');
  if (rows[0].c > 0) return;

  console.log('[DB] Seeding initial data...');

  // --- Categories (top-level first, then sub-categories) ---
  const topCats = [
    [1, '时事', 325, '#c7512e', '🌍'], [2, '财经', 218, '#3d8c5c', '📈'],
    [3, '科技', 467, '#5b7fa8', '💻'], [4, '体育', 189, '#8b5ea8', '⚽'],
    [5, '娱乐', 256, '#c28d2e', '🎬'], [6, '生活', 142, '#5b8c7a', '🏠'],
    [7, '教育', 98, '#6b7db3', '📚'], [8, '健康', 87, '#d4735e', '🏥'],
  ];
  for (const [id, name, count, color, icon] of topCats) {
    await pool.query('INSERT INTO categories (id,name,count,color,icon) VALUES (?,?,?,?,?)', [id, name, count, color, icon]);
  }

  const subCats = [
    ['人工智能', 156, '#5b7fa8', '🤖', 3], ['新能源', 98, '#3d8c5c', '🔋', 3],
    ['半导体', 72, '#8b5ea8', '💾', 3], ['股市', 112, '#c28d2e', '📊', 2],
    ['基金', 68, '#3d8c5c', '💰', 2], ['宏观经济', 85, '#d4735e', '🏛️', 2],
    ['足球', 95, '#c7512e', '⚽', 4], ['篮球', 88, '#c28d2e', '🏀', 4],
    ['电竞', 76, '#6b7db3', '🎮', 4], ['电影', 102, '#c28d2e', '🎬', 5],
    ['音乐', 54, '#5b7fa8', '🎵', 5], ['综艺', 48, '#d4735e', '📺', 5],
    ['美食', 42, '#c7512e', '🍜', 6], ['旅游', 38, '#3d8c5c', '✈️', 6],
    ['家居', 28, '#6b6560', '🏠', 6], ['教育政策', 55, '#6b7db3', '📚', 7],
    ['在线教育', 43, '#5b7fa8', '💻', 7],
  ];
  for (const [name, count, color, icon, parentId] of subCats) {
    await pool.query('INSERT INTO categories (name,count,color,icon,parent_id) VALUES (?,?,?,?,?)', [name, count, color, icon, parentId]);
  }

  // --- Articles ---
  const articles = [
    ['2026年第一季度GDP增长超预期，经济复苏势头强劲', '张明', '财经', '宏观经济', 'published', 45230, 128, '2026-05-29 09:30', '2026-05-29 09:30',
     'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200', 1, 1],
    ['AI大模型新突破：国产模型在多语言理解上超越GPT', '李华', '科技', '人工智能', 'published', 38920, 256, '2026-05-29 08:15', '2026-05-29 08:15',
     'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=1200', 1, 2],
    ['全国高考改革新方案公布，多地试点综合素质评价', '王芳', '时事', '教育政策', 'published', 28450, 89, '2026-05-28 16:45', '2026-05-28 16:45',
     '', 0, 0],
    ['新能源汽车渗透率突破55%，燃油车市场持续萎缩', '陈涛', '财经', '新能源', 'published', 22100, 67, '2026-05-28 14:20', '2026-05-28 14:20',
     'https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=1200', 0, 0],
    ['中国航天：新一代载人飞船完成首次无人轨道测试', '张明', '科技', '半导体', 'review', 0, 0, '2026-05-28 11:00', '2026-05-28 11:00',
     'https://images.unsplash.com/photo-1504711434969-e33886168d6c?w=1200', 1, 3],
    ['夏季食品安全预警发布，多地加强餐饮监管力度', '刘洋', '生活', '美食', 'draft', 0, 0, '2026-05-27 17:30', '2026-05-27 17:30',
     '', 0, 0],
    ['欧冠决赛前瞻：两支豪门球队的巅峰对决', '赵磊', '体育', '足球', 'published', 56340, 412, '2026-05-27 15:00', '2026-05-27 15:00',
     'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=1200', 1, 4],
    ['暑期档电影票房预测：国产科幻片备受期待', '孙悦', '娱乐', '电影', 'published', 19870, 95, '2026-05-27 10:20', '2026-05-27 10:20',
     '', 0, 0],
  ];
  for (const a of articles) {
    await pool.query(
      'INSERT INTO articles (title,author,category,sub_category,status,views,comments_count,created_at,updated_at,cover_url,is_featured,featured_order) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)', a
    );
  }

  // --- Comments ---
  const comments = [
    ['读者小王', '非常有深度的分析，期待后续报道！', 1, '2026年第一季度GDP增长超预期...', 'approved', '2026-05-29 09:45'],
    ['科技爱好者', '国产AI发展速度确实让人振奋，希望能持续突破。', 2, 'AI大模型新突破...', 'approved', '2026-05-29 09:20'],
    ['匿名用户', '这篇文章写得不错，数据很详实。', 4, '新能源汽车渗透率...', 'pending', '2026-05-29 08:55'],
    ['球迷老张', '决赛一定很精彩，两队实力都很强！', 7, '欧冠决赛前瞻...', 'pending', '2026-05-29 08:30'],
    ['匿名用户', '希望教育改革能真正落地。', 3, '全国高考改革新方案...', 'rejected', '2026-05-29 07:40'],
  ];
  for (const c of comments) {
    await pool.query(
      'INSERT INTO comments (user_name,content,article_id,article_title,status,created_at) VALUES (?,?,?,?,?,?)', c
    );
  }

  // --- Users ---
  const users = [
    ['李明远', 'limingyuan@newshub.cn', '超级管理员', 'active', '', '2024-01-15'],
    ['张明', 'zhangming@newshub.cn', '编辑', 'active', '', '2024-03-22'],
    ['李华', 'lihua@newshub.cn', '编辑', 'active', '', '2024-05-10'],
    ['王芳', 'wangfang@newshub.cn', '编辑', 'active', '', '2024-06-18'],
    ['陈涛', 'chentao@newshub.cn', '审核员', 'active', '', '2024-08-05'],
    ['赵磊', 'zhaolei@newshub.cn', '编辑', 'inactive', '', '2025-01-20'],
  ];
  for (const u of users) {
    await pool.query('INSERT INTO users (name,email,role,status,password_hash,created_at) VALUES (?,?,?,?,?,?)', u);
  }

  const mediaItems = [
    ['cover-headline.jpg', '封面-头条', '2.4 MB'], ['photo-tech.jpg', '配图-科技', '1.8 MB'],
    ['cover-finance.jpg', '封面-财经', '3.1 MB'], ['logo-icon.svg', '图标-Logo', '156 KB'],
    ['photo-sports.jpg', '配图-体育', '2.2 MB'], ['cover-entertainment.jpg', '封面-娱乐', '1.5 MB'],
    ['banner-ad.jpg', '广告横幅', '892 KB'], ['photo-life.jpg', '配图-生活', '2.7 MB'],
  ];
  for (const m of mediaItems) {
    await pool.query('INSERT INTO media (filename,label,size) VALUES (?,?,?)', m);
  }

  const traffic = [
    ['2026-05-23', 98400, 32100], ['2026-05-24', 102300, 33400],
    ['2026-05-25', 118500, 38700], ['2026-05-26', 95600, 31200],
    ['2026-05-27', 112800, 36800], ['2026-05-28', 108900, 35500],
    ['2026-05-29', 128450, 41900],
  ];
  for (const t of traffic) {
    await pool.query('INSERT INTO traffic_stats (date,page_views,unique_visitors) VALUES (?,?,?)', t);
  }

  const settings = [
    ['site_name', 'NewsHub'], ['site_description', '专业新闻资讯平台'],
    ['review_enabled', 'true'], ['comments_require_review', 'true'],
    ['seo_title', 'NewsHub - 专业新闻资讯平台'],
    ['seo_description', 'NewsHub提供最新、最全面的新闻资讯'],
  ];
  for (const [k, v] of settings) {
    await pool.query("INSERT INTO `settings` (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [k, v]);
  }

  console.log('[DB] Seed complete');
}

// ==================== QUERY HELPERS ====================

async function getOne(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

async function getAll(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

async function run(sql, params = []) {
  await pool.query(sql, params);
}

async function lastId() {
  const [rows] = await pool.query('SELECT LAST_INSERT_ID() AS id');
  return rows[0].id;
}

const queries = {
  // ==================== Dashboard ====================
  getDashboardStats: async () => {
    const [[tc], [tv], [tcm], [tu], [pc], [da]] = await Promise.all([
      pool.query('SELECT COUNT(*) AS c FROM articles'),
      pool.query('SELECT COALESCE(SUM(views),0) AS c FROM articles'),
      pool.query('SELECT COUNT(*) AS c FROM comments'),
      pool.query('SELECT COUNT(*) AS c FROM users'),
      pool.query("SELECT COUNT(*) AS c FROM comments WHERE status='pending'"),
      pool.query("SELECT COUNT(*) AS c FROM articles WHERE status='draft'"),
    ]);
    return {
      totalArticles: tc[0].c, totalViews: tv[0].c, totalComments: tcm[0].c,
      totalUsers: tu[0].c, pendingComments: pc[0].c, draftArticles: da[0].c,
    };
  },

  getTrafficData: () => getAll('SELECT date, page_views, unique_visitors FROM traffic_stats ORDER BY date ASC LIMIT 7'),

  // ==================== Articles ====================
  getArticles: (status) => {
    if (status && status !== 'all') {
      return getAll('SELECT * FROM articles WHERE status=? ORDER BY updated_at DESC', [status]);
    }
    return getAll('SELECT * FROM articles ORDER BY updated_at DESC');
  },

  // Public: published articles with pagination
  getArticlesPublic: async ({ category, sub_category, page = 1, limit = 12 }) => {
    let where = "status='published'";
    const params = [];
    if (category) { where += ' AND category=?'; params.push(category); }
    if (sub_category) { where += ' AND sub_category=?'; params.push(sub_category); }
    const offset = (Number(page) - 1) * Number(limit);

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM articles WHERE ${where}`, params);
    const articles = await getAll(
      `SELECT id,title,author,category,sub_category,views,comments_count,excerpt,cover_url,created_at FROM articles WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, Number(limit), offset]
    );
    return { articles, total: countRows[0].total, page: Number(page), limit: Number(limit) };
  },

  // Public: featured articles for carousel
  getFeaturedArticles: () => getAll(
    "SELECT id,title,author,category,sub_category,views,excerpt,cover_url FROM articles WHERE is_featured=1 AND status='published' ORDER BY featured_order ASC LIMIT 5"
  ),

  // Public: hot articles
  getHotArticles: () => getAll(
    "SELECT id,title,category,views,comments_count,created_at FROM articles WHERE status='published' ORDER BY views DESC LIMIT 6"
  ),

  getArticleById: (id) => getOne('SELECT * FROM articles WHERE id=?', [id]),

  createArticle: async (data) => {
    await run(
      'INSERT INTO articles (title,author,category,sub_category,status,excerpt,content,cover_url,is_featured,featured_order) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [data.title, data.author || '', data.category || '时事', data.sub_category || '', data.status || 'draft',
       data.excerpt || '', data.content || '', data.cover_url || '', data.is_featured || 0, data.featured_order || 0]
    );
    const id = await lastId();
    return queries.getArticleById(id);
  },

  updateArticle: async (id, data) => {
    const existing = await queries.getArticleById(Number(id));
    if (!existing) return null;
    await run(
      `UPDATE articles SET title=?,author=?,category=?,sub_category=?,status=?,excerpt=?,content=?,cover_url=?,is_featured=?,featured_order=? WHERE id=?`,
      [data.title ?? existing.title, data.author ?? existing.author,
       data.category ?? existing.category, data.sub_category ?? existing.sub_category,
       data.status ?? existing.status, data.excerpt ?? existing.excerpt,
       data.content ?? existing.content, data.cover_url ?? existing.cover_url,
       data.is_featured ?? existing.is_featured, data.featured_order ?? existing.featured_order,
       Number(id)]
    );
    return queries.getArticleById(Number(id));
  },

  deleteArticle: async (id) => {
    const existing = await queries.getArticleById(Number(id));
    if (!existing) return false;
    await run('DELETE FROM articles WHERE id=?', [Number(id)]);
    return true;
  },

  // ==================== Categories (tree + CRUD) ====================

  // Flat list (admin)
  getCategories: () => getAll('SELECT * FROM categories ORDER BY COALESCE(parent_id, id), parent_id IS NOT NULL, count DESC'),

  // Tree structure (public news page)
  getCategoryTree: async () => {
    const all = await getAll('SELECT * FROM categories ORDER BY count DESC');
    // Build parent → children map
    const parents = all.filter(c => !c.parent_id);
    const childMap = {};
    for (const c of all) {
      if (c.parent_id) {
        if (!childMap[c.parent_id]) childMap[c.parent_id] = [];
        childMap[c.parent_id].push(c);
      }
    }
    return parents.map(p => ({
      ...p,
      children: childMap[p.id] || [],
    }));
  },

  // Sub-categories for a parent
  getSubCategories: (parentId) => getAll('SELECT * FROM categories WHERE parent_id=? ORDER BY count DESC', [Number(parentId)]),

  createCategory: async (data) => {
    await run('INSERT INTO categories (name,count,color,icon,parent_id) VALUES (?,?,?,?,?)',
      [data.name, data.count || 0, data.color || '#c7512e', data.icon || '📄', data.parent_id || null]);
    const id = await lastId();
    return getOne('SELECT * FROM categories WHERE id=?', [id]);
  },

  updateCategory: async (id, data) => {
    const existing = await getOne('SELECT * FROM categories WHERE id=?', [Number(id)]);
    if (!existing) return null;
    // Don't let user set invalid parent reference (can't set self as parent)
    if (data.parent_id && Number(data.parent_id) === Number(id)) return null;
    await run('UPDATE categories SET name=?,count=?,color=?,icon=?,parent_id=? WHERE id=?',
      [data.name ?? existing.name, data.count ?? existing.count, data.color ?? existing.color,
       data.icon ?? existing.icon, data.parent_id !== undefined ? data.parent_id : existing.parent_id, Number(id)]);
    return getOne('SELECT * FROM categories WHERE id=?', [Number(id)]);
  },

  deleteCategory: async (id) => {
    const existing = await getOne('SELECT * FROM categories WHERE id=?', [Number(id)]);
    if (!existing) return false;
    // Set children's parent_id to NULL before deleting
    await run('UPDATE categories SET parent_id=NULL WHERE parent_id=?', [Number(id)]);
    await run('DELETE FROM categories WHERE id=?', [Number(id)]);
    return true;
  },

  // ==================== Comments ====================
  getComments: (status) => {
    if (status && status !== 'all') {
      return getAll('SELECT * FROM comments WHERE status=? ORDER BY created_at DESC', [status]);
    }
    return getAll('SELECT * FROM comments ORDER BY created_at DESC');
  },

  updateCommentStatus: async (id, status) => {
    const existing = await getOne('SELECT * FROM comments WHERE id=?', [Number(id)]);
    if (!existing) return null;
    await run('UPDATE comments SET status=? WHERE id=?', [status, Number(id)]);
    return getOne('SELECT * FROM comments WHERE id=?', [Number(id)]);
  },

  // ==================== Users ====================
  getUsers: () => getAll('SELECT id,name,email,role,status,created_at FROM users ORDER BY id ASC'),

  // ==================== Media ====================
  getMedia: () => getAll('SELECT * FROM media ORDER BY created_at DESC'),

  // ==================== Settings ====================
  getSettings: async () => {
    const rows = await getAll('SELECT * FROM `settings`');
    const map = {};
    for (const r of rows) map[r.key] = r.value;
    return map;
  },

  updateSettings: async (settings) => {
    for (const [key, value] of Object.entries(settings)) {
      await run("INSERT INTO `settings` (`key`, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)", [key, String(value)]);
    }
    return queries.getSettings();
  },
};

module.exports = { getDb, queries };
