/**
 * fetch_news.js — v3 完全体
 *
 * 职责：
 *   1. 多源新闻抓取 (NewsAPI + RSSHub 中英合流) 100 条
 *   2. Yahoo Finance 四大核心指数 7 日历史行情 (yahoo-finance2)
 *   3. 全球宏观气压计 (USDCNY, CL=F)
 *   4. 个股/基金实时查价 (供二次握手闭环)
 */

const axios = require('axios');
const RSSParser = require('rss-parser');
const fs = require('fs');
const path = require('path');

/* Finnhub 美股行情免费通道 — 从 https://finnhub.io/register 免费获取 Token */
const FINNHUB_TOKEN = process.env.FINNHUB_TOKEN || '';

/* ======================================================================
   代理配置
   ====================================================================== */

let _proxyAgent = null;
async function getProxyAgent() {
  const proxyUrl = process.env.LOCAL_PROXY;
  if (!proxyUrl) return null;
  if (_proxyAgent) return _proxyAgent;
  try {
    const { HttpsProxyAgent } = await import('https-proxy-agent');
    _proxyAgent = new HttpsProxyAgent(proxyUrl);
    console.log(`[fetch_news] 🔌 本地代理已配置: ${proxyUrl}`);
    return _proxyAgent;
  } catch (err) {
    console.warn('[fetch_news] ⚠ https-proxy-agent 加载失败:', err.message);
    return null;
  }
}

async function createRSSParser() {
  const baseOptions = {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  };
  const agent = await getProxyAgent();
  if (!agent) return new RSSParser(baseOptions);
  return new RSSParser({
    ...baseOptions,
    request: async (url, options) => {
      const res = await axios.get(url, {
        headers: { ...baseOptions.headers, ...options?.headers },
        timeout: options?.timeout || 10000,
        httpsAgent: agent,
      });
      return res.data;
    },
  });
}

/* ======================================================================
   Yahoo Finance 数据获取（双模式）
   模式 A: yahoo-finance2 (npm 包, 适用无代理环境)
   模式 B: 直接 HTTP API + HttpsProxyAgent (适用国内代理环境)
   ====================================================================== */

/**
 * 模式 A: 通过 yahoo-finance2 npm 包获取（自动处理 cookie/crumb）
 */
/* ======================================================================
   分时行情时间戳 & Mock 发生器工具（v5 新增）
   ====================================================================== */

const MARKET_TIMEZONES = {
  sp500: 'America/New_York', nasdaq: 'America/New_York',
  csi300: 'Asia/Shanghai', csi500: 'Asia/Shanghai',
  chinaA50: 'Asia/Shanghai', kwetf: 'America/New_York',
};

function formatMarketTime(date, timezone) {
  const opts = { timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: false };
  const [h, m] = date.toLocaleTimeString('en-US', opts).split(':');
  return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
}

function formatMarketDate(date, timezone = 'America/New_York') {
  const opts = { timeZone: timezone, month: '2-digit', day: '2-digit', year: 'numeric' };
  const str = new Intl.DateTimeFormat('en-CA', opts).format(date);
  const parts = str.split('-');
  return `${parts[1]}-${parts[2]}`;
}

/**
 * Intraday Slicer: 从5天5分钟线数据中智能定位最新活跃交易日,
 * 提取该交易日完整的高密度分时序列，彻底消除非交易时区断层。
 */
function sliceToLatestTradingDay(timestamps, closes, timezone) {
  const dateGroups = {};
  timestamps.forEach((ts, i) => {
    const dateKey = new Date(ts * 1000).toISOString().slice(0, 10);
    if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
    dateGroups[dateKey].push(i);
  });

  const sortedDates = Object.keys(dateGroups).sort();
  let bestDate = null;
  // 从最新日期倒序查找，选择数据点 >= 10 的活跃交易日
  for (let i = sortedDates.length - 1; i >= 0; i--) {
    if (dateGroups[sortedDates[i]].length >= 10) {
      bestDate = sortedDates[i];
      break;
    }
  }
  if (!bestDate && sortedDates.length > 0) bestDate = sortedDates[sortedDates.length - 1];
  if (!bestDate) return [];

  const bestIndices = dateGroups[bestDate];
  const trend = [];
  for (const i of bestIndices) {
    if (closes[i] != null) {
      trend.push({
        time: formatMarketTime(new Date(timestamps[i] * 1000), timezone),
        price: Math.round(closes[i] * 10) / 10,
      });
    }
  }
  return trend;
}

function genMockIntradayTrend(basePrice, startH, startM, count, stepMin) {
  const trend = [];
  let p = basePrice;
  for (let i = 0; i < count; i++) {
    const totalMin = startH * 60 + startM + i * stepMin;
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    if (h >= 24) break;
    p += (Math.random() - 0.48) * basePrice * 0.002;
    trend.push({ time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, price: Math.round(p * 10) / 10 });
  }
  return trend;
}

let _yfInstance = null;
async function getYahooFinance() {
  if (_yfInstance) return _yfInstance;
  const { default: YahooFinance } = await import('yahoo-finance2');
  _yfInstance = new YahooFinance({ suppressNotices: ['yahooSurvey'], versionCheck: false });
  return _yfInstance;
}

/**
 * 模式 B: 直接调用 Yahoo Finance HTTP API（支持 HttpsProxyAgent）
 */
async function directYahooIntradayChart(symbol, timezone = 'America/New_York') {
  const agent = await getProxyAgent();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=5m`;

  const response = await axios.get(url, {
    timeout: 15000,
    ...(agent ? { httpsAgent: agent } : {}),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  });

  const chart = response.data?.chart?.result?.[0];
  if (!chart) throw new Error('直连分时接口返回为空');

  const timestamps = chart.timestamp || [];
  const closes = chart.indicators?.quote?.[0]?.close || [];
  if (timestamps.length < 3) throw new Error('分钟级分时数据不足');

  const trend = sliceToLatestTradingDay(timestamps, closes, timezone);
  if (trend.length < 3) throw new Error('智能切片后分时数据不足');

  console.warn(`[fetch_news] ℹ ${symbol}: 5d数据截取最近活跃交易日, ${trend.length} 个分时点`);
  return trend;
}

async function directYahooDailyChart(symbol, timezone = 'America/New_York') {
  const agent = await getProxyAgent();
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

  async function fetchDailyChart(range) {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=1d`;
    const response = await axios.get(url, {
      timeout: 15000,
      ...(agent ? { httpsAgent: agent } : {}),
      headers,
    });
    return response.data?.chart?.result?.[0];
  }

  function extractDailyTrend(chart) {
    if (!chart) return [];
    const timestamps = chart.timestamp || [];
    const closes = chart.indicators?.quote?.[0]?.close || [];
    // 尝试 adjclose 作为备选（部分中国指数 close 为 null 但 adjclose 有数据）
    const adjcloses = chart.indicators?.adjclose?.[0]?.adjclose || [];
    const trend = [];
    let prevClose = null;
    for (let i = 0; i < timestamps.length; i++) {
      let price = closes[i] != null ? Math.round(closes[i] * 10) / 10 : null;
      // close 为 null 时尝试 adjclose
      if (price == null && adjcloses[i] != null) {
        price = Math.round(adjcloses[i] * 10) / 10;
      }
      // 向前填充
      if (price == null) price = prevClose;
      if (price != null) {
        trend.push({
          time: formatMarketDate(new Date(timestamps[i] * 1000), timezone),
          price: price,
        });
        prevClose = price;
      }
    }
    return trend;
  }

  let chart = await fetchDailyChart('7d');
  let trend = extractDailyTrend(chart);

  if (trend.length < 2) {
    console.warn(`[fetch_news] ⚠ ${symbol} 7d日线数据不足(${trend.length}有效), 尝试 1mo`);
    chart = await fetchDailyChart('1mo');
    trend = extractDailyTrend(chart);
  }

  if (trend.length < 2) {
    console.warn(`[fetch_news] ⚠ ${symbol} 1mo日线数据不足(${trend.length}有效), 尝试 3mo`);
    chart = await fetchDailyChart('3mo');
    trend = extractDailyTrend(chart);
  }

  if (trend.length < 2) throw new Error('日线数据不足');
  return trend;
}

/**
 * 极端降级：从5d分钟线数据中聚合出日线收盘价
 * 用于 chart/historical 都拿不到日线数据的资产（如 000905.SS）
 */
async function directYahooIntradayDailyFallback(symbol, timezone = 'America/New_York') {
  const agent = await getProxyAgent();
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=5m`;
  const response = await axios.get(url, {
    timeout: 15000,
    ...(agent ? { httpsAgent: agent } : {}),
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
  });
  const chart = response.data?.chart?.result?.[0];
  if (!chart) throw new Error('5m接口返回为空');
  const timestamps = chart.timestamp || [];
  const closes = chart.indicators?.quote?.[0]?.close || [];

  // 按日期分组，取每日最后一笔有效close
  const dateGroups = {};
  timestamps.forEach((ts, i) => {
    if (closes[i] == null) return;
    const dateKey = new Date(ts * 1000).toISOString().slice(0, 10);
    if (!dateGroups[dateKey]) dateGroups[dateKey] = [];
    dateGroups[dateKey].push({ ts, close: closes[i] });
  });

  const sortedDates = Object.keys(dateGroups).sort();
  const trend = [];
  for (const dateKey of sortedDates) {
    const points = dateGroups[dateKey];
    const lastPoint = points[points.length - 1];
    trend.push({
      time: formatMarketDate(new Date(lastPoint.ts * 1000), timezone),
      price: Math.round(lastPoint.close * 10) / 10,
    });
  }

  if (trend.length < 2) throw new Error('从5m数据构建日线失败');
  console.warn(`[fetch_news] ℹ ${symbol}: 从5d分钟线聚合出 ${trend.length} 个日线点`);
  return trend;
}

async function directYahooQuote(symbols) {
  const agent = await getProxyAgent();
  const results = [];
  const headers = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };

  // 使用 quote endpoint 同时获取行情 + 基本面
  const tasks = symbols.map(async (symbol) => {
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
      const response = await axios.get(url, {
        timeout: 15000,
        ...(agent ? { httpsAgent: agent } : {}),
        headers,
      });
      const result = response.data?.quoteResponse?.result?.[0];
      if (!result || result.regularMarketPrice == null) return;

      const entry = {
        symbol: symbol,
        regularMarketPrice: result.regularMarketPrice,
        regularMarketChangePercent: result.regularMarketChangePercent ?? null,
        trailingPE: result.trailingPE ?? null,
        priceToBook: result.priceToBook ?? null,
        quarterlyRevenueGrowth: null,
      };

      // 二次请求获取季度营收同比增速（部分 symbol 可能在 quote 中就包含了 revenueGrowth）
      if (entry.priceToBook == null && entry.trailingPE == null) {
        // 仅当 quote 未返回基本面时再补调 quoteSummary，减少冗余请求
        try {
          const fsUrl = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(symbol)}?modules=defaultKeyStatistics`;
          const fsRes = await axios.get(fsUrl, {
            timeout: 15000,
            ...(agent ? { httpsAgent: agent } : {}),
            headers,
          });
          const ks = fsRes.data?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
          if (ks) {
            if (entry.trailingPE == null) entry.trailingPE = ks.trailingPE?.raw ?? null;
            if (ks.revenueGrowth?.raw != null) entry.quarterlyRevenueGrowth = ks.revenueGrowth.raw;
          }
        } catch (_) {}
      }

      results.push(entry);
    } catch (_) { /* 单个 symbol 查询失败静默跳过 */ }
  });

  await Promise.all(tasks);
  return results;
}

/* ======================================================================
   Mock 数据（降级用）
   ====================================================================== */

const MOCK_BENCHMARKS = (() => {
  function gt(base, sh, sm, ct, st) {
    const arr = []; let p = base;
    for (let i = 0; i < ct; i++) {
      const tm = sh * 60 + sm + i * st;
      const h = Math.floor(tm / 60), m = tm % 60;
      if (h >= 24) break;
      p += (Math.random() - 0.48) * base * 0.002;
      arr.push({ time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`, price: Math.round(p * 10) / 10 });
    }
    return arr;
  }
  function gd(base, count) {
    const arr = []; let p = base;
    const now = new Date();
    let tradingDays = 0;
    for (let offset = count * 2; offset >= 0 && tradingDays < count; offset--) {
      const d = new Date(now); d.setDate(d.getDate() - offset);
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      tradingDays++;
      p += (Math.random() - 0.48) * base * 0.008;
      arr.push({ time: formatMarketDate(d), price: Math.round(p * 10) / 10 });
    }
    return arr;
  }
  return {
    sp500:  { name: '标普 500',  current: 5210.3, change: 0.45, trend24h: gt(5180, 9, 30, 78, 5), trend7d: gd(5180, 7) },
    nasdaq: { name: '纳斯达克',  current: 16340.5, change: -0.12, trend24h: gt(16360, 9, 30, 78, 5), trend7d: gd(16360, 7) },
    csi300: { name: '沪深 300',  current: 3650.2, change: 1.25, trend24h: gt(3605, 9, 30, 66, 5), trend7d: gd(3605, 7) },
    csi500: { name: '中证 500',  current: 5420.8, change: -0.45, trend24h: gt(5445, 9, 30, 66, 5), trend7d: gd(5445, 7) },
    chinaA50: { name: '富时中国 A50 指数', current: 12350.0, change: 0.85, trend24h: gt(12300, 9, 0, 80, 5), trend7d: gd(12300, 7) },
    kwetf:    { name: '金龙中国中概股 ETF',    current: 32.45, change: -0.32, trend24h: gt(32.55, 9, 30, 78, 5), trend7d: gd(32.55, 7) },
  };
})();

const MOCK_MACRO_BAROMETERS = {
  usdcny:   { price: 7.24, change: -0.05 },
  crudeOil: { price: 78.50, change: 0.85 },
};

const MOCK_NEWS = [
  { title: 'DeepSeek Releases Next-Generation Reasoning Model with 1.8T Parameters, Ousts GPT-5 on Multiple Benchmarks', source: 'TechCrunch', url: 'https://example.com/deepseek-reasoning-model', description: 'DeepSeek has unveiled its latest reasoning model featuring 1.8 trillion parameters.', category: 'ai_model', publishedAt: '2026-05-18T06:30:00Z' },
  { title: 'OpenAI Quietly Ships GPT-5 to Enterprise Customers, Pricing Model Sparks Heated Debate', source: 'The Verge', url: 'https://example.com/openai-gpt5-enterprise', description: 'OpenAI has begun rolling out GPT-5 to select enterprise partners.', category: 'ai_model', publishedAt: '2026-05-18T04:15:00Z' },
  { title: 'TSMC Accelerates 2nm Mass Production Timeline as NVIDIA Pre-Orders Entire 2027 Capacity', source: 'Bloomberg', url: 'https://example.com/tsmc-2nm-nvidia', description: 'TSMC is accelerating its 2nm fabrication timeline.', category: 'semiconductor', publishedAt: '2026-05-18T02:00:00Z' },
  { title: 'US CHIPS Act Allocates $8.7B for Advanced Packaging Facilities', source: 'Reuters', url: 'https://example.com/chips-act-packaging', description: 'US government allocated $8.7B for semiconductor packaging.', category: 'semiconductor', publishedAt: '2026-05-17T22:30:00Z' },
  { title: 'Bitcoin Breaks $120K as Spot ETF Inflows Surge', source: 'CoinDesk', url: 'https://example.com/bitcoin-120k-etf', description: 'Bitcoin surged past $120,000.', category: 'digital_assets', publishedAt: '2026-05-18T07:45:00Z' },
  { title: 'Ethereum Pectra Upgrade Goes Live, Reduces L2 Settlement Costs by 90%', source: 'The Block', url: 'https://example.com/ethereum-pectra-upgrade', description: 'Ethereum Pectra upgrade deployed.', category: 'digital_assets', publishedAt: '2026-05-17T20:00:00Z' },
  { title: 'Tesla Delivers Record 520K Units in Q2', source: 'CNBC', url: 'https://example.com/tesla-q2-deliveries', description: 'Tesla reported record quarterly deliveries.', category: 'smart_mobility', publishedAt: '2026-05-18T05:00:00Z' },
  { title: 'BYD Overtakes Tesla in Global EV Revenue for First Time', source: 'Financial Times', url: 'https://example.com/byd-tesla-revenue', description: 'BYD surpassed Tesla in EV revenue.', category: 'smart_mobility', publishedAt: '2026-05-18T03:20:00Z' },
  { title: 'CRISPR Therapeutics Gains FDA Breakthrough Status for In-Vivo Gene Editing', source: 'STAT News', url: 'https://example.com/crispr-fda-breakthrough', description: 'CRISPR received FDA Breakthrough designation.', category: 'biotech', publishedAt: '2026-05-17T19:00:00Z' },
  { title: 'AI-Designed Protein Therapeutic Enters Phase 3 Trials', source: 'Nature Biotechnology', url: 'https://example.com/ai-protein-therapy', description: 'AI-designed protein therapeutic entered Phase 3.', category: 'biotech', publishedAt: '2026-05-17T16:30:00Z' },
];

const MOCK_REDDIT = [
  { title: 'DeepSeek R3 just crushed every coding benchmark', score: 23100, commentsCount: 5432, url: 'https://reddit.com/r/technology/comments/mock1', source: 'r/technology', publishedAt: '2026-05-18T08:00:00Z' },
  { title: 'Microsoft built a photonic AI chip that runs at 1/100th the power', score: 18500, commentsCount: 3890, url: 'https://reddit.com/r/technology/comments/mock2', source: 'r/technology', publishedAt: '2026-05-18T06:00:00Z' },
  { title: 'Strategy bought another 12,000 BTC', score: 15200, commentsCount: 4100, url: 'https://reddit.com/r/singularity/comments/mock3', source: 'r/singularity', publishedAt: '2026-05-18T04:30:00Z' },
  { title: 'First human with neural-link-controlled bionic arm discharged', score: 27800, commentsCount: 6200, url: 'https://reddit.com/r/singularity/comments/mock4', source: 'r/singularity', publishedAt: '2026-05-17T23:00:00Z' },
];

const MOCK_CHINESE_NEWS = [
  { title: 'DeepSeek R3 正式开源：1.8T 参数的国产推理模型全面超越 GPT-5', source: '36氪', url: 'https://example.com/deepseek-r3-open-source', description: 'DeepSeek 正式开源 R3 推理模型。', category: 'ai_model', publishedAt: '2026-05-18T08:30:00Z' },
  { title: '华为昇腾 910C 量产在即：国产 AI 芯片算力逼近 H100', source: '华尔街见闻', url: 'https://example.com/huawei-ascend-910c', description: '华为昇腾 910C AI 芯片预计 Q3 量产。', category: 'ai_model', publishedAt: '2026-05-18T07:00:00Z' },
  { title: '台积电 2nm 试产良率突破 80%', source: '财新', url: 'https://example.com/tsmc-2nm-yield', description: '台积电 2nm N2 工艺试产良率超预期。', category: 'semiconductor', publishedAt: '2026-05-18T05:45:00Z' },
  { title: '荷兰扩大光刻机出口管制：ASML 高端机型对中国全面禁售', source: '华尔街见闻', url: 'https://example.com/asml-export-restrictions', description: '荷兰政府扩大对华光刻机出口管制。', category: 'semiconductor', publishedAt: '2026-05-17T21:00:00Z' },
  { title: '香港虚拟资产新政落地：散户合规交易通道全面开放', source: '财新', url: 'https://example.com/hk-crypto-policy', description: '香港证监会发布虚拟资产牌照制度升级版。', category: 'digital_assets', publishedAt: '2026-05-18T02:15:00Z' },
  { title: '比亚迪固态电池装车实测：续航突破 1200 公里', source: '36氪', url: 'https://example.com/byd-solid-state-battery', description: '比亚迪全固态电池完成百万公里路测。', category: 'smart_mobility', publishedAt: '2026-05-18T01:30:00Z' },
  { title: '小米 SU7 Ultra 月交付破 2 万', source: '华尔街见闻', url: 'https://example.com/xiaomi-su7-ultra', description: '小米 SU7 Ultra 交付量突破 2 万台。', category: 'smart_mobility', publishedAt: '2026-05-17T18:00:00Z' },
  { title: '百济神州替雷利珠单抗获 FDA 完全批准', source: '36氪', url: 'https://example.com/beigene-fda-approval', description: '百济神州获得 FDA 完全批准。', category: 'biotech', publishedAt: '2026-05-17T15:30:00Z' },
  { title: '英矽智能 AI 发现新靶点：阿尔茨海默病候选药物进入临床 II 期', source: '36氪', url: 'https://example.com/insilico-ai-drug', description: '英矽智能 AI 发现新靶点药物。', category: 'biotech', publishedAt: '2026-05-17T14:00:00Z' },
];

/* ======================================================================
   反脆弱降级：读取本地缓存
   ====================================================================== */

let _usedCacheFallback = false;

function readLatestCache() {
  try {
    const cachePath = path.resolve(__dirname, '..', 'src', 'data', 'latest.json');
    if (fs.existsSync(cachePath)) {
      const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));
      console.log('[fetch_news] 📦 读取本地缓存 latest.json 作为降级数据');
      return data;
    }
  } catch (e) {
    console.warn(`[fetch_news] ⚠ 缓存读取失败: ${e.message}`);
  }
  return null;
}

/* ======================================================================
   配置
   ====================================================================== */

const NEWS_API_BASE = 'https://newsapi.org/v2';
const NEWS_QUERY_STRING =
  '( "Artificial Intelligence" OR LLM OR OpenAI OR "DeepSeek" ' +
  'OR Semiconductor OR "TSMC" OR "NVIDIA" ' +
  'OR Crypto OR Bitcoin OR "Electric Vehicle" OR Tesla OR Biotech )';
const CN_NEWS_QUERY_STRING =
  '( AI OR 人工智能 OR 大模型 OR 半导体 OR 芯片 OR 光刻机 ' +
  'OR 新能源车 OR 电动汽车 OR 锂电池 OR 固态电池 ' +
  'OR 光伏 OR 储能 OR 碳中和 OR 碳交易 ' +
  'OR 创新药 OR 生物医药 OR 基因编辑 OR AI制药 ' +
  'OR 数字经济 OR 数据资产 OR 算力 OR 云计算 ' +
  'OR 国产替代 OR 信创 OR 鸿蒙 OR 半导体设备 ' +
  'OR 美联储 OR 降息 OR 通胀 OR 人民币汇率 OR A股 )';
const NEWS_EVERYTHING_PAGE_SIZE = 100;
const REDDIT_FEEDS = [
  'https://www.reddit.com/r/technology/.rss',
  'https://www.reddit.com/r/singularity/.rss',
];
const REDDIT_RSS_FALLBACKS = {
  'https://www.reddit.com/r/technology/.rss': 'https://rsshub.app/reddit/r/technology',
  'https://www.reddit.com/r/singularity/.rss': 'https://rsshub.app/reddit/r/singularity',
};
const CHINESE_RSS_SOURCES = [
  { name: '36氪', url: 'https://rsshub.app/36kr/news' },
  { name: '华尔街见闻', url: 'https://rsshub.app/wallstreetcn/news' },
];

/* ======================================================================
   工具：文章分类
   ====================================================================== */

function categorizeArticle(title, description = '') {
  const text = `${title} ${description}`.toLowerCase();
  if (/ai\b|artificial intelligence|llm|openai|deepseek|gpt-?4?5?|claude|machine learning|neural network|reasoning model|chatbot|large language model|agentic|multimodal/.test(text)) return 'ai_model';
  if (/semiconductor|chip\b|tsmc|nvidia|intel|amd\b|foundry|fabrication|processor|gpu|nanometer|2nm|3nm|5nm|wafer|fab\b/.test(text)) return 'semiconductor';
  if (/crypto|bitcoin|blockchain|ethereum|web3|defi|nft|token|digital asset|cryptocurrency|solana|stablecoin/.test(text)) return 'digital_assets';
  if (/electric vehicle|ev\b|tesla|autonomous|self-driving|battery|ev battery|charging|smart mobility|lidar|neural interface|brain-computer/.test(text)) return 'smart_mobility';
  if (/biotech|biotechnology|crispr|gene|pharma|clinical trial|drug|therapy|vaccine|genomic|protein|antibody|fda approval|therapeutic/.test(text)) return 'biotech';
  if (/人工智能|大模型|llm|深度学习|机器学习|神经网络|自然语言|多模态|推理模型|gpt|deepseek|openai|claude|智能体/.test(text)) return 'ai_model';
  if (/半导体|芯片|光刻|晶圆|制程|封装|gpu|处理器|先进制造|nm制程|台积电|中芯|intel|nvidia|龙芯|算力芯片/.test(text)) return 'semiconductor';
  if (/区块链|加密货币|比特币|以太坊|web3|defi|nft|数字资产|数字货币|稳定币|加密|挖矿/.test(text)) return 'digital_assets';
  if (/新能源车|电动汽车|锂电池|固态电池|自动驾驶|充电桩|智能驾驶|比亚迪|宁德时代|蔚来|小鹏|理想|tesla|小米汽车/.test(text)) return 'smart_mobility';
  if (/生物医药|创新药|基因编辑|crispr|抗体|疫苗|临床|fda|药监局|car-t|核酸|蛋白|AI制药/.test(text)) return 'biotech';
  return 'technology';
}

/* ======================================================================
   Yahoo Finance — 四大核心指数 7 日历史行情
   ====================================================================== */

const YAHOO_INDICES = [
  { key: 'sp500',   symbol: '^GSPC',     name: '标普 500',                   timezone: 'America/New_York', tzLabel: 'ET' },
  { key: 'nasdaq',  symbol: '^IXIC',     name: '纳斯达克',                   timezone: 'America/New_York', tzLabel: 'ET' },
  { key: 'csi300',  symbol: '000300.SS', name: '沪深 300',                   timezone: 'Asia/Shanghai',    tzLabel: 'CST' },
  { key: 'csi500',  symbol: '000905.SS', name: '中证 500',                   timezone: 'Asia/Shanghai',    tzLabel: 'CST' },
  { key: 'chinaA50', symbol: '2823.HK',   name: '富时中国 A50 指数',         timezone: 'Asia/Shanghai',    tzLabel: 'CST' },
  { key: 'kwetf',    symbol: 'KWEB',     name: '金龙中国中概股 ETF',          timezone: 'America/New_York', tzLabel: 'ET' },
];

async function fetchMarketBenchmarks() {
  console.log('[fetch_news] 📈 正在抓取全球六大基准资产双轨行情 (24h分时 + 7d日线)...');
  const result = {};
  let useDirectApi = false;

  for (const idx of YAHOO_INDICES) {
    try {
      let trend24h = [];
      let trend7d = [];

      // === Track A: 24h 日内分时 (5分钟间隔) ===
      // 模式 A: yahoo-finance2 — 使用5日窗口+智能切片，杜绝时区断层
      if (!useDirectApi) {
        try {
          const yf = await getYahooFinance();
          const chartData = await yf.chart(idx.symbol, {
            period1: new Date(Date.now() - 5 * 86400000),
            period2: new Date(),
            interval: '5m',
          });
          const valid = (chartData.quotes || []).filter(q => q && q.close != null);
          if (valid.length >= 3) {
            const timestamps = valid.map(q => q.date.getTime() / 1000);
            const closes = valid.map(q => q.close);
            trend24h = sliceToLatestTradingDay(timestamps, closes, idx.timezone);
          }
        } catch (yfErr) {
          console.warn(`[fetch_news] ⚠ yahoo-finance2 分时失败 (${idx.name}): ${yfErr.message}, 切换直连`);
          useDirectApi = true;
        }
      }

      if (trend24h.length === 0) {
        try {
          trend24h = await directYahooIntradayChart(idx.symbol, idx.timezone);
        } catch (directErr) {
          console.warn(`[fetch_news] ⚠ 直连分时失败 (${idx.name}): ${directErr.message}`);
        }
      }

      // === Track B: 7d 短线日线 (1天间隔) ===
      // 中证500和富时A50期货使用 historical() 接口（独立于useDirectApi，不同API端点）
      if (idx.key === 'csi500' || idx.key === 'chinaA50') {
        try {
          const yf = await getYahooFinance();
          const now = new Date();
          const period1 = new Date(now.getTime() - 10 * 86400000);
          const histData = await yf.historical(idx.symbol, {
            period1, period2: now, interval: '1d',
          });
          if (histData && histData.length > 0) {
            let prevClose = null;
            for (const row of histData) {
              let close = row.close != null ? parseFloat(row.close) : prevClose;
              if (close != null) {
                trend7d.push({
                  time: formatMarketDate(row.date, idx.timezone),
                  price: Math.round(close * 10) / 10,
                });
                prevClose = close;
              }
            }
          }
        } catch (histErr) {
          console.warn(`[fetch_news] ⚠ yahoo-finance2 historical 日线失败 (${idx.name}): ${histErr.message}`);
        }
      } else {
        // 其他资产使用 chart() 路径
        if (!useDirectApi) {
          try {
            const yf = await getYahooFinance();
            const chartData = await yf.chart(idx.symbol, {
              period1: new Date(Date.now() - 14 * 86400000),
              period2: new Date(),
              interval: '1d',
            });
            const valid = (chartData.quotes || []).filter(q => q && q.close != null);
            if (valid.length >= 2) {
              trend7d = valid.map(q => ({
                time: formatMarketDate(q.date, idx.timezone),
                price: Math.round(q.close * 10) / 10,
              }));
            }
          } catch (yfErr) {
            console.warn(`[fetch_news] ⚠ yahoo-finance2 日线失败 (${idx.name}): ${yfErr.message}`);
          }
        }
      }

      if (trend7d.length === 0) {
        try {
          trend7d = await directYahooDailyChart(idx.symbol, idx.timezone);
        } catch (directErr) {
          console.warn(`[fetch_news] ⚠ 直连日线失败 (${idx.name}): ${directErr.message}`);
        }
      }

      // 极致降级：从5m分钟线聚合日线收盘价（专治 000905.SS 等 chart 返回 null 的资产）
      if (trend7d.length === 0) {
        try {
          trend7d = await directYahooIntradayDailyFallback(idx.symbol, idx.timezone);
        } catch (fbErr) {
          console.warn(`[fetch_news] ⚠ 5m日线聚合失败 (${idx.name}): ${fbErr.message}`);
        }
      }

      // === 极致保底：单点收盘价 ===
      if (trend24h.length === 0) {
        console.warn(`[fetch_news] ⚠ ${idx.name} 分时数据为空, 尝试单点查价`);
        try {
          const yf = await getYahooFinance();
          const q = await yf.quote(idx.symbol);
          const p = Array.isArray(q) ? q[0]?.regularMarketPrice : q?.regularMarketPrice;
          if (p != null) {
            trend24h = [{ time: new Date().toISOString().slice(11, 16), price: Math.round(p * 10) / 10 }];
          }
        } catch (_) {}
      }

      if (trend24h.length === 0 && trend7d.length === 0) throw new Error('所有数据源均失败');

      // 优先用分时计算涨跌幅，分时不足时降级至日线
      const prices = trend24h.length > 0
        ? trend24h.filter(t => t.price != null).map(t => t.price)
        : trend7d.filter(t => t.price != null).map(t => t.price);
      const current = prices[prices.length - 1];
      const firstPrice = prices[0];
      const change = firstPrice ? ((current - firstPrice) / firstPrice) * 100 : null;

      result[idx.key] = {
        name: idx.name,
        current: Math.round(current * 10) / 10,
        change: change != null ? Math.round(change * 100) / 100 : null,
        trend24h: trend24h,
        trend7d: trend7d,
      };

      console.log(`[fetch_news] ✅ ${idx.name}: ${result[idx.key].current} (${result[idx.key].change > 0 ? '+' : ''}${result[idx.key].change}%) 分时:${trend24h.length}点 日线:${trend7d.length}点`);
    } catch (err) {
      console.warn(`[fetch_news] ⚠ 获取 ${idx.name} 失败: ${err.message}`);
      const cache = readLatestCache();
      if (cache?.marketBenchmarks?.[idx.key]) {
        console.warn(`[fetch_news] ℹ ${idx.name} 降级至缓存数据`);
        _usedCacheFallback = true;
        const cacheEntry = { ...cache.marketBenchmarks[idx.key] };

        // 兼容旧版缓存迁移：trend → trend24h + trend7d
        if (cacheEntry.trend && !cacheEntry.trend24h) {
          let oldTrend = [...cacheEntry.trend];
          if (oldTrend.length > 0 && typeof oldTrend[0] === 'number') {
            oldTrend = oldTrend.map((price, i) => ({
              time: `T-${oldTrend.length - i}`,
              price: Math.round(price * 10) / 10,
            }));
            console.warn(`[fetch_news] 🔄 缓存趋势格式已迁移: ${oldTrend.length} 数字点 → {time,price} 对象`);
          }
          cacheEntry.trend24h = oldTrend;
          cacheEntry.trend7d = [];
          delete cacheEntry.trend;
        }
        if (!cacheEntry.trend24h) cacheEntry.trend24h = [];
        if (!cacheEntry.trend7d) cacheEntry.trend7d = [];

        result[idx.key] = cacheEntry;
      } else {
        console.warn(`[fetch_news] ℹ ${idx.name} 降级至 Mock 数据`);
        result[idx.key] = { ...MOCK_BENCHMARKS[idx.key] };
      }
    }
  }
  return result;
}

/* ======================================================================
   Yahoo Finance — 全球宏观气压计 (USDCNY, CL=F)
   ====================================================================== */

async function fetchMacroBarometers() {
  console.log('[fetch_news] 🌡️ 正在抓取全球宏观气压计 (USDCNY, CL=F)...');
  try {
    let results;
    try {
      // 模式 A: yahoo-finance2
      const yf = await getYahooFinance();
      results = await yf.quote(['USDCNY=X', 'CL=F']);
    } catch (yfErr) {
      // 模式 B: 直连 HTTP API
      console.warn(`[fetch_news] ⚠ yahoo-finance2 宏观气压计失败: ${yfErr.message}, 切换直连`);
      results = await directYahooQuote(['USDCNY=X', 'CL=F']);
    }

    const map = {};
    for (const q of results) {
      const symbol = q.symbol || '';
      if (symbol.includes('USDCNY')) {
        map.usdcny = { price: q.regularMarketPrice ?? 0, change: q.regularMarketChangePercent ?? 0 };
      } else if (symbol === 'CL=F') {
        map.crudeOil = { price: q.regularMarketPrice ?? 0, change: q.regularMarketChangePercent ?? 0 };
      }
    }
    console.log(`[fetch_news] ✅ 宏观气压计: USDCNY=${map.usdcny?.price} (${map.usdcny?.change > 0 ? '+' : ''}${(map.usdcny?.change || 0).toFixed(2)}%), 原油=${map.crudeOil?.price} (${map.crudeOil?.change > 0 ? '+' : ''}${(map.crudeOil?.change || 0).toFixed(2)}%)`);
    return map;
  } catch (err) {
    console.warn('[fetch_news] ⚠ 宏观气压计抓取失败:', err.message);
    const cache = readLatestCache();
    if (cache?.macroBarometers) {
      console.warn('[fetch_news] ℹ 宏观气压计降级至缓存数据');
      _usedCacheFallback = true;
      return { ...cache.macroBarometers };
    }
    return { ...MOCK_MACRO_BAROMETERS };
  }
}

/* ======================================================================
   个股/基金实时查价（二次握手闭环）
   底层通道：A股 → 东方财富  美股 → Finnhub
   ====================================================================== */

/** 东方财富 A 股极速行情（JSON，支持 PE/PB） */
async function fetchEastMoneyPrice(code, marketSuffix) {
  const marketId = marketSuffix === 'SZ' ? 1 : 0;
  try {
    const agent = await getProxyAgent();
    const url = `https://push2.eastmoney.com/api/qt/stock/get?secid=${marketId}.${code}&fields=f43,f170,f162,f167`;
    const res = await axios.get(url, {
      timeout: 10000,
      ...(agent ? { httpsAgent: agent } : {}),
      headers: { Referer: 'https://quote.eastmoney.com/' },
    });
    const d = res.data?.data;
    if (!d || d.f43 == null) return null;
    return {
      price: d.f43,
      changePercent: d.f170,
      trailingPE: d.f162 ?? null,
      priceToBook: d.f167 ?? null,
      quarterlyRevenueGrowth: null,
    };
  } catch (_) {
    return null;
  }
}

/** 腾讯财经 A 股行情降级（纯文本，作为 East Money 的备胎） */
async function fetchTencentPrice(code, marketSuffix) {
  try {
    const agent = await getProxyAgent();
    // Tencent 统一用 sz/sh 前缀
    const prefix = marketSuffix === 'SZ' ? 'sz' : 'sh';
    const res = await axios.get(`https://qt.gtimg.cn/q=${prefix}${code}`, {
      timeout: 10000,
      ...(agent ? { httpsAgent: agent } : {}),
      headers: { Referer: 'https://gu.qq.com/' },
    });
    const m = res.data.match(/"([^"]+)"/);
    if (!m) return null;
    const parts = m[1].split('~');
    const price = parseFloat(parts[3]);
    const prevClose = parseFloat(parts[4]);
    if (isNaN(price) || isNaN(prevClose)) return null;
    return {
      price: price,
      changePercent: parseFloat(parts[32]) ?? null,
      trailingPE: parts[39] ? parseFloat(parts[39]) : null,
      priceToBook: parts[46] ? parseFloat(parts[46]) : null,
      quarterlyRevenueGrowth: null,
    };
  } catch (_) {
    return null;
  }
}

/** A 股查价：优先东方财富，降级腾讯财经 */
async function fetchASharePrice(code, marketSuffix) {
  // 双通道并发竞速：谁先返回用谁
  const result = await Promise.any([
    fetchEastMoneyPrice(code, marketSuffix),
    fetchTencentPrice(code, marketSuffix),
  ]).catch(() => null);
  return result;
}

/** Finnhub 美股行情 */
async function fetchFinnhubQuote(symbol) {
  if (!FINNHUB_TOKEN) return null;
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_TOKEN}`,
      { timeout: 10000 },
    );
    if (!res.data || res.data.c == null) return null;
    return {
      price: res.data.c,
      changePercent: res.data.dp,
      trailingPE: null,
      priceToBook: null,
      quarterlyRevenueGrowth: null,
    };
  } catch (_) {
    return null;
  }
}

/** Finnhub 基本面补充（市盈率等） */
async function fetchFinnhubMetrics(symbol) {
  if (!FINNHUB_TOKEN) return {};
  try {
    const res = await axios.get(
      `https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all&token=${FINNHUB_TOKEN}`,
      { timeout: 10000 },
    );
    const m = res.data?.metric;
    if (!m) return {};
    return {
      trailingPE: m.peBasicExclExtraTTM ?? null,
      priceToBook: m.pbQuarterly ?? null,
      quarterlyRevenueGrowth: m.revenueGrowth ?? null,
    };
  } catch (_) {
    return {};
  }
}

async function fetchStockPrices(symbols) {
  if (!symbols || symbols.length === 0) return {};
  const unique = [...new Set(symbols)];
  console.log(`[fetch_news] 🔍 正在查价 ${unique.length} 只标的: ${unique.slice(0, 8).join(', ')}${unique.length > 8 ? '...' : ''}`);

  if (!FINNHUB_TOKEN) {
    console.warn('[fetch_news] ⚠ FINNHUB_TOKEN 未设置，美股查价将静默跳过；请设置环境变量或从 https://finnhub.io/register 免费获取');
  }

  const map = {};
  const tasks = unique.map(async (symbol) => {
    // A 股：纯数字 + .SZ / .SS / .SH 后缀 → 东方财富(优先) / 腾讯财经(降级)
    const aShareMatch = symbol.match(/^(\d+)\.(SZ|SS|SH)$/i);
    if (aShareMatch) {
      const entry = await fetchASharePrice(aShareMatch[1], aShareMatch[2].toUpperCase());
      if (entry) map[symbol] = entry;
      return;
    }

    // 美股及其他：Finnhub
    const entry = await fetchFinnhubQuote(symbol);
    if (entry) {
      const metrics = await fetchFinnhubMetrics(symbol);
      map[symbol] = { ...entry, ...metrics };
    }
  });

  await Promise.all(tasks);
  console.log(`[fetch_news] ✅ 查价完成: ${Object.keys(map).length}/${unique.length} 只成功`);
  return map;
}

/* ======================================================================
   NewsAPI 新闻抓取（保持原有逻辑）
   ====================================================================== */

async function fetchNewsAPI() {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    console.warn('[fetch_news] ⚠ NEWS_API_KEY 未设置，使用 Mock 新闻数据。');
    return MOCK_NEWS;
  }
  try {
    const agent = await getProxyAgent();
    const fromDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
    const response = await axios.get(`${NEWS_API_BASE}/everything`, {
      params: { q: NEWS_QUERY_STRING, language: 'en', sortBy: 'publishedAt', pageSize: NEWS_EVERYTHING_PAGE_SIZE, from: fromDate, apiKey },
      timeout: 20000,
      ...(agent ? { httpsAgent: agent } : {}),
    });
    const items = response.data?.articles || [];
    const seen = new Set();
    const articles = [];
    for (const item of items) {
      if (!item.title || item.title === '[Removed]') continue;
      const normalized = item.title.toLowerCase().trim();
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      articles.push({
        title: item.title,
        source: item.source?.name || 'Unknown',
        url: item.url,
        description: item.description || '',
        category: categorizeArticle(item.title, item.description),
        publishedAt: item.publishedAt || new Date().toISOString(),
      });
    }
    console.log(`[fetch_news] ✅ NewsAPI 英文: ${articles.length} 条`);
    return articles;
  } catch (err) {
    console.error('[fetch_news] ❌ NewsAPI 请求失败：', err.message);
    const cache = readLatestCache();
    if (cache?.articles?.length > 0) {
      console.warn('[fetch_news] ℹ NewsAPI 降级至缓存新闻');
      _usedCacheFallback = true;
      return cache.articles.map(a => ({
        title: a.originalTitle || a.title || '',
        source: a.source || 'Cache',
        url: a.url || '',
        description: a.forensicAnalysis?.underlyingFact || (Array.isArray(a.summary) ? a.summary[0] : '') || '',
        category: a.category || 'technology',
        publishedAt: a.publishedAt || new Date().toISOString(),
      }));
    }
    return MOCK_NEWS;
  }
}

/* ======================================================================
   Reddit RSS
   ====================================================================== */

async function fetchRedditRSS() {
  try {
    const parser = await createRSSParser();
    const feedResults = await Promise.all(
      REDDIT_FEEDS.map(async (feedUrl) => {
        try { return await parser.parseURL(feedUrl); }
        catch (err) {
          const fallbackUrl = REDDIT_RSS_FALLBACKS[feedUrl];
          if (fallbackUrl) return parser.parseURL(fallbackUrl).catch(() => null);
          return null;
        }
      })
    );
    const posts = [];
    for (let i = 0; i < feedResults.length; i++) {
      const feed = feedResults[i];
      const subreddit = REDDIT_FEEDS[i].match(/\/r\/(\w+)/)?.[1] || 'unknown';
      if (!feed?.items?.length) continue;
      for (const item of feed.items.slice(0, 10)) {
        const title = item.title?.trim();
        if (!title) continue;
        const score = parseInt(item.content?.match(/score:?\s*(\d+)/i)?.[1], 10) || 0;
        posts.push({ title, score, commentsCount: 0, url: item.link || item.guid || '', source: `r/${subreddit}`, publishedAt: item.isoDate || item.pubDate || new Date().toISOString() });
      }
    }
    posts.sort((a, b) => b.score - a.score);
    const top = posts.slice(0, 20);
    console.log(`[fetch_news] ✅ Reddit RSS: ${top.length} 条热帖`);
    return top;
  } catch (err) {
    console.warn('[fetch_news] ⚠ Reddit RSS 失败:', err.message);
    return MOCK_REDDIT;
  }
}

/* ======================================================================
   中文新闻抓取
   ====================================================================== */

async function fetchChineseNews() {
  const results = [];
  const apiKey = process.env.NEWS_API_KEY;
  if (apiKey) {
    try {
      const agent = await getProxyAgent();
      const fromDate = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      const response = await axios.get(`${NEWS_API_BASE}/everything`, {
        params: { q: CN_NEWS_QUERY_STRING, language: 'zh', sortBy: 'publishedAt', pageSize: NEWS_EVERYTHING_PAGE_SIZE, from: fromDate, apiKey },
        timeout: 20000,
        ...(agent ? { httpsAgent: agent } : {}),
      });
      const items = response.data?.articles || [];
      const seen = new Set();
      for (const item of items) {
        if (!item.title || item.title === '[Removed]') continue;
        const normalized = item.title.trim();
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        results.push({ title: item.title, source: item.source?.name || '中文媒体', url: item.url, description: item.description || '', category: categorizeArticle(item.title, item.description), lang: 'zh', publishedAt: item.publishedAt || new Date().toISOString() });
      }
      console.log(`[fetch_news] ✅ NewsAPI 中文: ${results.length} 条`);
    } catch (err) {
      console.warn(`[fetch_news] ⚠ 中文 NewsAPI 失败: ${err.message}`);
    }
  }
  for (const source of CHINESE_RSS_SOURCES) {
    try {
      const parser = await createRSSParser();
      const feed = await parser.parseURL(source.url);
      if (feed?.items?.length) {
        let count = 0;
        for (const item of feed.items) {
          const title = item.title?.trim();
          if (!title) continue;
          const isDup = results.some(r => r.title.includes(title.slice(0, 20)));
          if (isDup) continue;
          results.push({ title, source: source.name, url: item.link || item.guid || '', description: item.contentSnippet || item.content || '', category: categorizeArticle(title, item.contentSnippet || ''), lang: 'zh', publishedAt: item.isoDate || item.pubDate || new Date().toISOString() });
          count++;
          if (count >= 20) break;
        }
        console.log(`[fetch_news] ✅ RSSHub ${source.name}: ${count} 条`);
      }
    } catch (err) {
      console.warn(`[fetch_news] ⚠ RSSHub ${source.name} 失败: ${err.message}`);
    }
  }
  if (results.length === 0) {
    console.warn('[fetch_news] ⚠ 中文源全部失败，使用 Mock');
    const cache = readLatestCache();
    if (cache?.articles?.length > 0) {
      const cachedCn = cache.articles.filter(a => a.originalTitle || a.title).slice(0, 30);
      if (cachedCn.length > 0) {
        console.warn('[fetch_news] ℹ 中文新闻降级至缓存数据');
        _usedCacheFallback = true;
        return cachedCn.map(a => ({
          title: a.title || '',
          source: a.source || 'Cache',
          url: a.url || '',
          description: a.forensicAnalysis?.underlyingFact || (Array.isArray(a.summary) ? a.summary[0] : '') || '',
          category: a.category || 'technology',
          lang: 'zh',
          publishedAt: a.publishedAt || new Date().toISOString(),
        }));
      }
    }
    return MOCK_CHINESE_NEWS.map(a => ({ ...a, lang: 'zh' }));
  }
  return results;
}

/* ======================================================================
   合流
   ====================================================================== */

function mergeResults(enNews, cnNews, reddit, marketBenchmarks, macroBarometers) {
  const seenUrls = new Set();
  const dedupEn = enNews.filter(a => { const k = a.url || a.title; if (seenUrls.has(k)) return false; seenUrls.add(k); return true; });
  const dedupCn = cnNews.filter(a => { const k = a.url || a.title; if (seenUrls.has(k)) return false; seenUrls.add(k); return true; });
  const dedupReddit = reddit.filter(p => { const k = p.url || p.title; if (seenUrls.has(k)) return false; seenUrls.add(k); return true; });

  // 交叉混编
  const MAX_TOTAL = 100;
  const allItems = [];
  let enIdx = 0, cnIdx = 0, turn = 0;
  while (allItems.length < MAX_TOTAL && (enIdx < dedupEn.length || cnIdx < dedupCn.length)) {
    if (turn === 0) {
      if (enIdx < dedupEn.length) { allItems.push({ ...dedupEn[enIdx], lang: 'en' }); enIdx++; }
      else if (cnIdx < dedupCn.length) { allItems.push({ ...dedupCn[cnIdx], lang: 'zh' }); cnIdx++; }
    } else {
      if (cnIdx < dedupCn.length) { allItems.push({ ...dedupCn[cnIdx], lang: 'zh' }); cnIdx++; }
      else if (enIdx < dedupEn.length) { allItems.push({ ...dedupEn[enIdx], lang: 'en' }); enIdx++; }
    }
    turn = 1 - turn;
  }

  const lines = [];
  lines.push('=== UNIFIED GLOBAL INTELLIGENCE FEED (中英合流) ===');
  lines.push(`Total items: ${allItems.length}`);
  lines.push('---');
  allItems.forEach((a, i) => {
    const langTag = a.lang === 'zh' ? '🇨🇳CN' : '🇺🇸EN';
    lines.push(`[${i + 1}] [${langTag}] [${a.category.toUpperCase()}] ${a.title}`);
    lines.push(`     Source: ${a.source}`);
    lines.push(`     Link: ${a.url}`);
    if (a.publishedAt) lines.push(`     Published: ${a.publishedAt}`);
    if (a.description) lines.push(`     Summary: ${a.description.replace(/\n/g, ' ').slice(0, 350)}`);
    lines.push('');
  });
  if (dedupReddit.length > 0) {
    lines.push('=== SOCIAL MEDIA HOTS (Reddit) ===');
    lines.push(`Total hot posts: ${dedupReddit.length}`);
    lines.push('---');
    dedupReddit.forEach((p, i) => {
      lines.push(`[${i + 1}] [r/${p.source}] ${p.title}`);
      lines.push(`     Heat Score: ${p.score.toLocaleString()}`);
      lines.push(`     Link: ${p.url}`);
      lines.push('');
    });
  }

  // 追加定量行情数据
  if (marketBenchmarks) {
    lines.push('=== MARKET BENCHMARKS (24h 分钟级分时行情) ===');
    for (const [key, val] of Object.entries(marketBenchmarks)) {
      lines.push(`[${key}] ${val.name}: ${val.current} (${val.change > 0 ? '+' : ''}${val.change}%)`);
      const trend24hLog = val.trend24h || [];
      const trend7dLog = val.trend7d || [];
      const sampled24h = trend24hLog.filter((_, i) => i % Math.max(1, Math.floor(trend24hLog.length / 12)) === 0);
      lines.push(`     分时(${trend24hLog.length}点, 采样12点): ` + sampled24h.map(t => `${t.time}=${t.price}`).join(' '));
      lines.push(`     日线(${trend7dLog.length}点): ` + trend7dLog.map(t => `${t.time}=${t.price}`).join(' '));
    }
    lines.push('');
  }
  if (macroBarometers) {
    lines.push('=== MACRO BAROMETERS (宏观气压计) ===');
    if (macroBarometers.usdcny) lines.push(`USDCNY: ${macroBarometers.usdcny.price} (${macroBarometers.usdcny.change > 0 ? '+' : ''}${(macroBarometers.usdcny.change || 0).toFixed(2)}%)`);
    if (macroBarometers.crudeOil) lines.push(`CL=F: ${macroBarometers.crudeOil.price} (${macroBarometers.crudeOil.change > 0 ? '+' : ''}${(macroBarometers.crudeOil.change || 0).toFixed(2)}%)`);
    lines.push('');
  }

  return {
    textStream: lines.join('\n'),
    raw: { news: dedupEn, chineseNews: dedupCn, reddit: dedupReddit },
  };
}

/* ======================================================================
   顶层入口
   ====================================================================== */

async function fetchAllNews(options = {}) {
  // 重置反脆弱降级跟踪
  _usedCacheFallback = false;

  console.log('[fetch_news] 🚀 开始抓取全球商情数据（v4 终极进化）...\n');

  const enNews = options.useMock ? (console.warn('[fetch_news] ⚠ Mock 模式（英文）'), MOCK_NEWS) : await fetchNewsAPI();
  const cnNews = options.useMock ? (console.warn('[fetch_news] ⚠ Mock 模式（中文）'), MOCK_CHINESE_NEWS.map(a => ({ ...a, lang: 'zh' }))) : await fetchChineseNews();
  const reddit = options.useMock || options.skipReddit ? (options.skipReddit ? [] : MOCK_REDDIT) : await fetchRedditRSS();

  // 定量行情（并行）
  const marketBenchmarks = options.useMock
    ? (console.warn('[fetch_news] ⚠ Mock 模式（行情）'), MOCK_BENCHMARKS)
    : await fetchMarketBenchmarks();

  const macroBarometers = options.useMock
    ? (console.warn('[fetch_news] ⚠ Mock 模式（气压计）'), MOCK_MACRO_BAROMETERS)
    : await fetchMacroBarometers();

  console.log(`[fetch_news] 📊 合并前：英文 ${enNews.length} 条 / 中文 ${cnNews.length} 条 / Reddit ${reddit.length} 条`);
  const merged = mergeResults(enNews, cnNews, reddit, marketBenchmarks, macroBarometers);
  console.log(`[fetch_news] ✅ 合流完成：${merged.raw.news.length + merged.raw.chineseNews.length} 篇新闻 + ${merged.raw.reddit.length} 条社媒，文本流 ${merged.textStream.length} 字符`);

  // 将定量行情附在 merged 对象上，供 main.js 直接使用
  merged.marketBenchmarks = marketBenchmarks;
  merged.macroBarometers = macroBarometers;

  // 反脆弱标记：本次运行是否使用了缓存降级
  merged.isCachedData = _usedCacheFallback;
  if (merged.isCachedData) {
    console.warn('[fetch_news] ⚠ 本次部分数据来自缓存降级 (isCachedData=true)');
  }

  return merged;
}

module.exports = {
  fetchAllNews,
  fetchNewsAPI,
  fetchRedditRSS,
  fetchChineseNews,
  fetchMarketBenchmarks,
  fetchMacroBarometers,
  fetchStockPrices,
  mergeResults,
  MOCK_NEWS,
  MOCK_CHINESE_NEWS,
  MOCK_REDDIT,
  MOCK_BENCHMARKS,
};
