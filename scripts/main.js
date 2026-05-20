/**
 * main.js — AI 商情雷达 · 数据管道入口 (v4 里程碑版)
 *
 * 流程：
 *   fetchAllNews (新闻 + 行情) → loadHistoryContext (3日记忆)
 *   → loadReconciliationContext (3日前预测 vs 真实走势)
 *   → buildEnhancedContext → analyzeTextStream (DeepSeek V4)
 *   → injectMarketData → autoPriceLookup → A股查价/过滤 → persistReport
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { fetchAllNews, fetchStockPrices } = require('./fetch_news');
const { analyzeTextStream } = require('./analyze');

/* ======================================================================
   路径配置
   ====================================================================== */

const DATA_DIR = path.resolve(__dirname, '..', 'src', 'data');
const HISTORY_DIR = path.join(DATA_DIR, 'history');
const ARCHIVES_DIR = path.join(DATA_DIR, 'archives');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/**
 * 返回北京时间 (UTC+8) 的 YYYY-MM-DD 日期字符串
 * @param {Date} [d] - 可选 Date 对象，默认为当前时间
 */
function getBeijingDateStr(d) {
  const date = d || new Date();
  const beijingMs = date.getTime() + 8 * 3600000;
  return new Date(beijingMs).toISOString().slice(0, 10);
}

/* ======================================================================
   高影响力事件池管理（金鱼记忆破解）
   ====================================================================== */

function loadHighImpactPool() {
  const poolPath = path.join(DATA_DIR, 'high_impact_news.json');
  if (!fs.existsSync(poolPath)) {
    console.log('[main] 🗄️ 高影响力事件池不存在，新建空池');
    return [];
  }
  try {
    const raw = fs.readFileSync(poolPath, 'utf-8');
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      console.log(`[main] 🗄️ 已加载高影响力事件池: ${data.length} 条核心事件`);
      return data;
    }
    return [];
  } catch (e) {
    console.warn(`[main] ⚠ 高影响力事件池读取失败: ${e.message}`);
    return [];
  }
}

function mergeAnchorEvents(report, existingPool) {
  const newAnchors = (report.articles || []).filter(a => a.isAnchorEvent === true);
  if (newAnchors.length === 0) {
    console.log('[main] 🗄️ 本轮分析未产出核心锚点事件');
    return existingPool;
  }

  console.log(`[main] 🗄️ 本轮产出 ${newAnchors.length} 条核心锚点事件，准备合并入事件池`);

  // 以 URL 为去重键建立映射
  const poolMap = new Map();
  for (const item of existingPool) {
    poolMap.set(item.url, item);
  }

  let addedCount = 0;
  for (const anchor of newAnchors) {
    if (!poolMap.has(anchor.url)) {
      poolMap.set(anchor.url, {
        title:        anchor.title || '',
        source:       anchor.source || '',
        url:          anchor.url || '',
        category:     anchor.category || '',
        summary:      Array.isArray(anchor.summary) ? anchor.summary : [],
        forensicAnalysis: anchor.forensicAnalysis || null,
        publishedAt:  anchor.publishedAt || new Date().toISOString(),
        isAnchorEvent: true,
        addedAt:      new Date().toISOString(),
      });
      addedCount++;
    }
  }

  // 转回数组，按 publishedAt 降序排列
  let pool = Array.from(poolMap.values());
  pool.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));

  // 滚动淘汰：最多保留 40 条
  if (pool.length > 40) {
    pool = pool.slice(0, 40);
    console.log(`[main] 🗄️ 事件池已裁剪至 ${pool.length} 条（滚动淘汰最旧事件）`);
  }

  console.log(`[main] 🗄️ 事件池合并完成: +${addedCount} 新增, 共 ${pool.length} 条核心事件`);
  return pool;
}

/* ======================================================================
   1. GitOps 3 日历史记忆加载
   ====================================================================== */

/* ======================================================================
   1. 时光机·高密度历史结论加载（Token 极端节流）
   直接从 archives/ 解析已提炼完毕的 JSON 归档，ZERO 原始文本
   ====================================================================== */

function loadHistoryContext() {
  ensureDir(ARCHIVES_DIR);

  const files = fs.readdirSync(ARCHIVES_DIR)
    .filter(f => f.startsWith('archive_') && f.endsWith('.json'))
    .sort()
    .reverse();

  if (files.length === 0) {
    console.log('[main] 📜 归档目录为空，无历史记忆可加载');
    return [];
  }

  // 取最多 3 个不同日期的最近归档（兼容新旧两种命名格式）
  const seenDays = new Set();
  const recentArchives = [];
  for (const f of files) {
    // 新格式: archive_2026-05-18.json | 旧格式: archive_20260518_1812.json
    const dayMatch = f.match(/archive_(\d{4}-\d{2}-\d{2})\.json$/) || f.match(/archive_(\d{8})_\d{4}\.json$/);
    if (dayMatch && !seenDays.has(dayMatch[1])) {
      seenDays.add(dayMatch[1]);
      recentArchives.push(f);
      if (seenDays.size >= 3) break;
    }
  }

  const contexts = [];
  for (const file of recentArchives) {
    try {
      const raw = fs.readFileSync(path.join(ARCHIVES_DIR, file), 'utf-8');
      const data = JSON.parse(raw);

      // 仅提取已由 DeepSeek 计算好的高密度结论 —— 零原始文本
      const entry = {
        archive: file,
        date: file.replace(/^archive_|\.json$/g, '').replace(/_/, ' '),
        economicConfidence: data.macroMetrics?.economicConfidence ?? null,
        mediaSentiment: data.macroMetrics?.mediaSentiment ?? null,
        socialSentiment: data.macroMetrics?.socialSentiment ?? null,
        blackSwanProbability: data.macroMetrics?.blackSwanProbability ?? null,
        macroTrendAlert: typeof data.macroMetrics?.macroTrendAlert === 'string'
          ? data.macroMetrics.macroTrendAlert.slice(0, 200) : null,
        marketRegime: data.marketRegime?.quadrant ?? null,
        regimeLogic: data.marketRegime?.logic?.slice(0, 100) ?? null,
        economicForecast: typeof data.economicForecast === 'string'
          ? data.economicForecast.slice(0, 200) : null,
        catalystFactors: Array.isArray(data.catalystFactors)
          ? data.catalystFactors.slice(0, 3) : [],
        aiCalibrationScore: data.aiCalibrationScore ?? null,
        aiReview: data.aiReview ?? null,
        benchmarkClose: data.marketBenchmarks ? {
          sp500:  data.marketBenchmarks.sp500?.current ?? null,
          nasdaq: data.marketBenchmarks.nasdaq?.current ?? null,
          csi300: data.marketBenchmarks.csi300?.current ?? null,
          csi500: data.marketBenchmarks.csi500?.current ?? null,
        } : null,
      };

      contexts.push(entry);
      console.log(`[main] 📜 时光机·加载高密度结论: ${entry.date}`);
    } catch (e) {
      console.warn(`[main] ⚠ 历史档案解析失败 ${file}: ${e.message}`);
    }
  }

  console.log(`[main] 📜 共加载 ${contexts.length} 份归档结论（Token 节流: 仅高密度结论, 零原始文本）`);
  return contexts;
}

/* ----------------------------------------------------------------------
   向后兼容：如果 archives/ 为空，兜底读取 history/
   ---------------------------------------------------------------------- */

function loadHistoryContextLegacy() {
  ensureDir(HISTORY_DIR);
  const contexts = [];

  for (let i = 1; i <= 3; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const dateStr = getBeijingDateStr(d);
    const filePath = path.join(HISTORY_DIR, `${dateStr}.json`);

    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(raw);
        contexts.push({
          date: dateStr,
          economicConfidence: data.macroMetrics?.economicConfidence ?? null,
          mediaSentiment: data.macroMetrics?.mediaSentiment ?? null,
          socialSentiment: data.macroMetrics?.socialSentiment ?? null,
          blackSwanProbability: data.macroMetrics?.blackSwanProbability ?? null,
          marketRegime: data.marketRegime?.quadrant ?? null,
          benchmarkClose: data.marketBenchmarks ? {
            sp500:  data.marketBenchmarks.sp500?.current ?? null,
            nasdaq: data.marketBenchmarks.nasdaq?.current ?? null,
            csi300: data.marketBenchmarks.csi300?.current ?? null,
            csi500: data.marketBenchmarks.csi500?.current ?? null,
          } : null,
        });
        console.log(`[main] 📜 已加载历史记忆 (legacy): ${dateStr}`);
      } catch (e) {
        console.warn(`[main] ⚠ 历史文件读取失败 ${dateStr}: ${e.message}`);
      }
    }
  }

  return contexts;
}

/* ======================================================================
   2. AI 预测真理对账上下文加载（v4 新增）
   ====================================================================== */

/* ======================================================================
   2. AI 预测真理对账上下文加载（v4 新增）
   从 archives/ 获取旧基准指数，彻底淘汰历史原始文本
   ====================================================================== */

function findArchiveForDate(dateStr) {
  ensureDir(ARCHIVES_DIR);
  // 尝试新格式 (YYYY-MM-DD) 和旧格式 (YYYYMMDD) 匹配
  const yyyyMmDd = dateStr; // 2026-05-18
  const yyyymmdd = dateStr.replace(/-/g, ''); // 20260518
  const files = fs.readdirSync(ARCHIVES_DIR)
    .filter(f =>
      (f === `archive_${yyyyMmDd}.json` || f.startsWith(`archive_${yyyymmdd}_`)) &&
      f.endsWith('.json')
    )
    .sort()
    .reverse();
  if (files.length === 0) return null;
  return path.join(ARCHIVES_DIR, files[0]);
}

function loadReconciliationContext(marketBenchmarks) {
  const macroPath = path.join(DATA_DIR, 'macro_history.json');
  if (!fs.existsSync(macroPath)) {
    console.log('[main] ℹ macro_history.json 不存在，跳过真理对账');
    return null;
  }

  let history;
  try {
    history = JSON.parse(fs.readFileSync(macroPath, 'utf-8'));
  } catch (e) {
    console.warn(`[main] ⚠ macro_history.json 解析失败: ${e.message}`);
    return null;
  }

  if (!Array.isArray(history) || history.length === 0) {
    console.log('[main] ℹ macro_history.json 为空，跳过真理对账');
    return null;
  }

  // 查找 3 天前的记录
  const targetDate = new Date(Date.now() - 3 * 86400000);
  const dateStr = getBeijingDateStr(targetDate);
  const oldEntry = history.find(r => r.date === dateStr);

  if (!oldEntry) {
    console.log(`[main] ℹ 未找到 ${dateStr} 的宏观历史记录，跳过真理对账`);
    return null;
  }

  // 从 archives/ 读取当日归档获取旧基准指数（零原始文本）
  const archivePath = findArchiveForDate(dateStr);
  let oldBenchmarks = null;
  if (archivePath) {
    try {
      const oldArchive = JSON.parse(fs.readFileSync(archivePath, 'utf-8'));
      oldBenchmarks = {
        sp500:  oldArchive.marketBenchmarks?.sp500?.current ?? null,
        nasdaq: oldArchive.marketBenchmarks?.nasdaq?.current ?? null,
        csi300: oldArchive.marketBenchmarks?.csi300?.current ?? null,
      };
      console.log(`[main] 📋 真理对账·历史基准来自归档: ${path.basename(archivePath)}`);
    } catch (e) {
      console.warn(`[main] ⚠ 归档 ${archivePath} 读取失败: ${e.message}`);
    }
  }

  // 兜底：从 history/ 读取
  if (!oldBenchmarks) {
    const oldReportPath = path.join(HISTORY_DIR, `${dateStr}.json`);
    if (fs.existsSync(oldReportPath)) {
      try {
        const oldReport = JSON.parse(fs.readFileSync(oldReportPath, 'utf-8'));
        oldBenchmarks = {
          sp500:  oldReport.marketBenchmarks?.sp500?.current ?? null,
          nasdaq: oldReport.marketBenchmarks?.nasdaq?.current ?? null,
          csi300: oldReport.marketBenchmarks?.csi300?.current ?? null,
        };
        console.log(`[main] 📋 真理对账·历史基准来自 history/ 兜底`);
      } catch (e) {
        console.warn(`[main] ⚠ ${dateStr} 历史报告读取失败: ${e.message}`);
      }
    }
  }

  // 今日基准指数
  const newBenchmarks = {
    sp500:  marketBenchmarks?.sp500?.current ?? null,
    nasdaq: marketBenchmarks?.nasdaq?.current ?? null,
    csi300: marketBenchmarks?.csi300?.current ?? null,
  };

  // 计算 3 日涨跌幅
  const indexChanges = {};
  if (oldBenchmarks) {
    for (const key of ['sp500', 'nasdaq', 'csi300']) {
      if (oldBenchmarks[key] != null && newBenchmarks[key] != null && oldBenchmarks[key] !== 0) {
        indexChanges[key] = Math.round(((newBenchmarks[key] - oldBenchmarks[key]) / oldBenchmarks[key]) * 10000) / 100;
      }
    }
  }

  // 最新一条记录（今日或最近）
  const latestEntry = history[history.length - 1] || null;

  const ctx = {
    predictedConfidence: oldEntry.confidence ?? null,
    predictedRegime: oldEntry.regime ?? null,
    oldBenchmarks,
    newBenchmarks,
    indexChanges,
    actualConfidence: latestEntry?.confidence ?? null,
    actualRegime: latestEntry?.regime ?? null,
    targetDate: dateStr,
  };

  console.log(`[main] 📋 AI 真理对账上下文已加载: ${dateStr} (信心指数 ${ctx.predictedConfidence} → ${ctx.actualConfidence}, 美林时钟 ${ctx.predictedRegime} → ${ctx.actualRegime})`);
  return ctx;
}

/* ======================================================================
   3. 解析股票代码并注入实时行情（二次握手闭环）
   ====================================================================== */

function extractStockSymbols(report) {
  const symbols = [];
  if (Array.isArray(report.dynamicSectors)) {
    for (const sector of report.dynamicSectors) {
      if (Array.isArray(sector.investmentVehicles?.stocks)) {
        for (const st of sector.investmentVehicles.stocks) {
          if (st.code) symbols.push(st.code.trim());
        }
      }
    }
  }
  return symbols;
}

function injectStockPrices(report, priceMap) {
  if (!Array.isArray(report.dynamicSectors)) return;

  let injected = 0;
  for (const sector of report.dynamicSectors) {
    if (Array.isArray(sector.investmentVehicles?.stocks)) {
      for (const st of sector.investmentVehicles.stocks) {
        const code = st.code?.trim();
        if (code && priceMap[code]) {
          st.price = priceMap[code].price;
          st.changePercent = priceMap[code].changePercent;
          st.trailingPE = priceMap[code].trailingPE;
          st.priceToBook = priceMap[code].priceToBook;
          st.quarterlyRevenueGrowth = priceMap[code].quarterlyRevenueGrowth;
          injected++;
        }
      }
    }
  }
  console.log(`[main] 💰 已注入 ${injected} 只 dynamicSectors 标的实时行情`);
}

/* ======================================================================
   4. 全球投资雷达 — 自动查价二次握手 + 空舱防御（v6 完全重构）
   ====================================================================== */

/** 池子最小保障数量 */
const MIN_POOL_SIZE = 4;

const A_SHARE_LOW_PRICE_FALLBACK = [
  { code: '000725.SZ', name: '京东方A',     reason: '全球显示面板龙头，OLED出货量持续攀升，AI终端驱动需求复苏，破净低价标的', buyZoneRatio: [0.92, 0.96], sellZoneRatio: [1.20, 1.35], stopLossRatio: 0.88 },
  { code: '600010.SS', name: '包钢股份',     reason: '稀土与钢铁双主业，受益于人形机器人磁材需求与基建复苏，绝对股价低安全边际充足', buyZoneRatio: [0.90, 0.95], sellZoneRatio: [1.25, 1.40], stopLossRatio: 0.85 },
  { code: '000100.SZ', name: 'TCL科技',      reason: '半导体显示+光伏双轮驱动，大尺寸面板价格企稳回升，估值接近历史底部', buyZoneRatio: [0.92, 0.96], sellZoneRatio: [1.20, 1.35], stopLossRatio: 0.88 },
  { code: '601860.SH', name: '紫金银行',     reason: '区域性银行龙头，受益于化债政策与信贷扩张，低估值高股息防御属性强', buyZoneRatio: [0.93, 0.97], sellZoneRatio: [1.15, 1.30], stopLossRatio: 0.90 },
  { code: '600567.SS', name: '山鹰国际',     reason: '造纸行业龙头，废纸系涨价周期启动，包装需求随消费复苏，低价安全边际高', buyZoneRatio: [0.90, 0.95], sellZoneRatio: [1.20, 1.35], stopLossRatio: 0.85 },
  { code: '002131.SZ', name: '利欧股份',     reason: '水泵与数字营销双主业，海外泵业需求增长叠加AI营销概念催化，绝对股价处于历史低位', buyZoneRatio: [0.90, 0.95], sellZoneRatio: [1.25, 1.40], stopLossRatio: 0.85 },
];

const US_LOW_PRICE_FALLBACK = [
  { code: 'SNAP', name: 'Snap Inc',              reason: '社交平台AI广告转型，AR硬件催化，用户增长超预期，绝对股价低位提供安全边际', buyZoneRatio: [0.90, 0.95], sellZoneRatio: [1.25, 1.40], stopLossRatio: 0.85 },
  { code: 'SOFI', name: 'SoFi Technologies',      reason: '金融科技平台实现盈利拐点，会员增长强劲，产品线扩展，估值重塑空间大', buyZoneRatio: [0.88, 0.94], sellZoneRatio: [1.30, 1.50], stopLossRatio: 0.82 },
  { code: 'RGTI', name: 'Rigetti Computing',      reason: '量子计算纯正标的，与政府合作加深，技术路线突破预期，高风险高弹性低价股', buyZoneRatio: [0.85, 0.92], sellZoneRatio: [1.35, 1.60], stopLossRatio: 0.80 },
  { code: 'NVTS', name: 'Navitas Semiconductor',  reason: '氮化镓功率半导体龙头，AI服务器电源需求爆发，碳化硅产能爬坡加速', buyZoneRatio: [0.90, 0.95], sellZoneRatio: [1.25, 1.40], stopLossRatio: 0.85 },
];


async function processStockPools(report) {
  const radar = report.globalInvestmentRadar || {};

  // ---- 1) 从扁平池收集所有标的 ----
  let aSharePool = Array.isArray(radar.aSharePool) ? radar.aSharePool : [];
  let usSharePool = Array.isArray(radar.usSharePool) ? radar.usSharePool : [];

  if (aSharePool.length === 0 && usSharePool.length === 0) {
    console.log('[main] ℹ 扁平池为空，跳过全球投资雷达处理');
    report.globalInvestmentRadar = { aSharePool: [], usSharePool: [] };
    return 0;
  }

  const allStocks = [
    ...aSharePool.map(s => ({ ...s, _market: 'aShare' })),
    ...usSharePool.map(s => ({ ...s, _market: 'usShare' })),
  ];

  const allSymbols = allStocks.map(s => s.code).filter(Boolean);
  console.log(`[main] 🔍 扁平池: A股 ${aSharePool.length} 支 + 美股 ${usSharePool.length} 支 = ${allStocks.length} 支待查价`);

  // ---- 2) 雅虎财经查价 ----
  const priceMap = await fetchStockPrices(allSymbols);
  console.log(`[main] 💰 实时价格获取完成: ${Object.keys(priceMap).length}/${allSymbols.length} 支成功`);

  // ---- 3) 逐支强化为清爽扁平格式 —— 刚性字段对齐 ----
  function enrichEntry(stock) {
    const pd = stock.code ? priceMap[stock.code] : null;
    const price = pd?.price ?? null;
    const buyRatios = Array.isArray(stock.buyZoneRatio) && stock.buyZoneRatio.length === 2
      ? stock.buyZoneRatio : [0.95, 0.98];
    const sellRatios = Array.isArray(stock.sellZoneRatio) && stock.sellZoneRatio.length === 2
      ? stock.sellZoneRatio : [1.15, 1.30];
    const stopRatio = typeof stock.stopLossRatio === 'number' ? stock.stopLossRatio : 0.90;

    let buyZone = '--', takeProfit = '--', stopLoss = '--';
    if (price != null) {
      buyZone = `${(price * buyRatios[0]).toFixed(2)} ~ ${(price * buyRatios[1]).toFixed(2)}`;
      takeProfit = (price * sellRatios[0]).toFixed(2);
      stopLoss = (price * stopRatio).toFixed(2);
    }

    return {
      code: stock.code || '',
      name: stock.name || '',
      price,
      changePercent: pd?.changePercent ?? null,
      trailingPE: pd?.trailingPE ?? null,
      buyZone,
      takeProfit,
      stopLoss,
      reason: stock.reason || '',
    };
  }

  let enrichedA = aSharePool.map(enrichEntry);
  let enrichedU = usSharePool.map(enrichEntry);

  // ---- 4) 低价区刚性兜底 — 确保池子够厚 ----
  const existingACodes = new Set(enrichedA.map(s => s.code));
  const existingUCodes = new Set(enrichedU.map(s => s.code));

  if (enrichedA.length < MIN_POOL_SIZE) {
    const need = MIN_POOL_SIZE - enrichedA.length;
    console.log(`[main] 🛡️ A股池仅 ${enrichedA.length} 支, 需补充 ${need} 支低价兜底`);
    const candidates = A_SHARE_LOW_PRICE_FALLBACK.filter(s => !existingACodes.has(s.code)).slice(0, need);
    for (const fb of candidates) {
      const prices = await fetchStockPrices([fb.code]);
      const pd = prices[fb.code] || {};
      const fbPrice = pd.price ?? 5.0;
      enrichedA.push({
        code: fb.code, name: fb.name,
        price: pd.price ?? null,
        changePercent: pd.changePercent ?? null,
        trailingPE: pd.trailingPE ?? null,
        buyZone: `${(fbPrice * fb.buyZoneRatio[0]).toFixed(2)} ~ ${(fbPrice * fb.buyZoneRatio[1]).toFixed(2)}`,
        takeProfit: (fbPrice * fb.sellZoneRatio[0]).toFixed(2),
        stopLoss: (fbPrice * fb.stopLossRatio).toFixed(2),
        reason: fb.reason,
      });
    }
    console.log(`[main] 🛡️ A股池已刚性填充至 ${enrichedA.length} 支`);
  }

  if (enrichedU.length < MIN_POOL_SIZE) {
    const need = MIN_POOL_SIZE - enrichedU.length;
    console.log(`[main] 🛡️ 美股池仅 ${enrichedU.length} 支, 需补充 ${need} 支低价兜底`);
    const candidates = US_LOW_PRICE_FALLBACK.filter(s => !existingUCodes.has(s.code)).slice(0, need);
    for (const fb of candidates) {
      const prices = await fetchStockPrices([fb.code]);
      const pd = prices[fb.code] || {};
      const fbPrice = pd.price ?? 8.0;
      enrichedU.push({
        code: fb.code, name: fb.name,
        price: pd.price ?? null,
        changePercent: pd.changePercent ?? null,
        trailingPE: pd.trailingPE ?? null,
        buyZone: `${(fbPrice * fb.buyZoneRatio[0]).toFixed(2)} ~ ${(fbPrice * fb.buyZoneRatio[1]).toFixed(2)}`,
        takeProfit: (fbPrice * fb.sellZoneRatio[0]).toFixed(2),
        stopLoss: (fbPrice * fb.stopLossRatio).toFixed(2),
        reason: fb.reason,
      });
    }
    console.log(`[main] 🛡️ 美股池已刚性填充至 ${enrichedU.length} 支`);
  }

  // ---- 5) 扁平落盘 —— 彻底废除旧 tier 结构 ----
  report.globalInvestmentRadar = { aSharePool: enrichedA, usSharePool: enrichedU };

  const total = enrichedA.length + enrichedU.length;
  const withPrice = [...enrichedA, ...enrichedU].filter(s => s.price != null).length;
  console.log(`[main] ✅ 扁平池落盘完成: 共 ${total} 支标的（${withPrice} 支含实时价格）`);
  return total;
}

/* ======================================================================
   5. 数据持久化
   ====================================================================== */

function persistReport(report) {
  ensureDir(DATA_DIR);

  const now = new Date();
  const dateStr = getBeijingDateStr(now); // YYYY-MM-DD (北京时间)

  // === Step 1: 刚性每日历史档案仓（每天仅一份，完整覆盖） ===
  ensureDir(ARCHIVES_DIR);
  const archiveFilename = `archive_${dateStr}.json`;
  const archivePath = path.join(ARCHIVES_DIR, archiveFilename);
  fs.writeFileSync(archivePath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`[main] ✅ 历史档案已落盘: ${archivePath}`);

  // === Step 2: 覆盖 latest.json（前端消费） ===
  const latestPath = path.join(DATA_DIR, 'latest.json');
  fs.writeFileSync(latestPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`[main] ✅ 已覆盖最新缓存: ${latestPath}`);

  // === Step 3: 保持 history/ 向后兼容 ===
  ensureDir(HISTORY_DIR);
  const histDateStr = getBeijingDateStr(now);
  const historyPath = path.join(HISTORY_DIR, `${histDateStr}.json`);

  if (fs.existsSync(historyPath)) {
    const existing = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    existing.articles = [...(existing.articles || []), ...(report.articles || [])];
    const seen = new Set();
    existing.articles = existing.articles.filter(a => {
      const key = a.url || a.title;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    existing.lastUpdated = report.lastUpdated;
    existing.macroMetrics = report.macroMetrics;
    existing.marketRegime = report.marketRegime;
    existing.dynamicSectors = report.dynamicSectors;
    existing.industryRadar = report.industryRadar;
    existing.aiCalibrationScore = report.aiCalibrationScore;
    existing.aiReview = report.aiReview;
    existing.globalInvestmentRadar = report.globalInvestmentRadar;
    existing.calibrationMatrix = report.calibrationMatrix;
    fs.writeFileSync(historyPath, JSON.stringify(existing, null, 2), 'utf-8');
    console.log(`[main] ✅ 已合并更新 ${historyPath}`);
  } else {
    fs.writeFileSync(historyPath, JSON.stringify(report, null, 2), 'utf-8');
    console.log(`[main] ✅ 已写入 ${historyPath}`);
  }
}

/* ======================================================================
   6. GitOps 增量历史记账 (macro_history.json)
   ====================================================================== */

function appendMacroHistory(report) {
  const macroHistoryPath = path.join(DATA_DIR, 'macro_history.json');

  let history = [];
  if (fs.existsSync(macroHistoryPath)) {
    try {
      history = JSON.parse(fs.readFileSync(macroHistoryPath, 'utf-8'));
      console.log(`[main] 📊 读取宏观历史账本: ${history.length} 条现有记录`);
    } catch (e) {
      console.warn(`[main] ⚠ macro_history.json 读取失败: ${e.message}`);
    }
  }

  const { economicConfidence = 50, regulatoryPressure = 50 } = report.macroMetrics || {};
  const liquidity = Math.round((economicConfidence + (100 - regulatoryPressure)) / 2);

  const sentTracker = report.marketSentimentTracker || {};
  const record = {
    date: getBeijingDateStr(),
    confidence: Math.round(report.macroMetrics?.economicConfidence ?? 50),
    liquidity: liquidity,
    mediaSentiment: report.macroMetrics?.mediaSentiment ?? 0,
    socialSentiment: report.macroMetrics?.socialSentiment ?? 0,
    regime: report.marketRegime?.quadrant || '过热',
    fearGreedIndex: typeof sentTracker.fearGreedIndex === 'number'
      ? Math.max(0, Math.min(100, Math.round(sentTracker.fearGreedIndex)))
      : null,
    hotThemes: Array.isArray(sentTracker.hotThemes)
      ? sentTracker.hotThemes.slice(0, 5).map(t => ({
          keyword: t.keyword || '',
          momentumScore: typeof t.momentumScore === 'number' ? t.momentumScore : null,
          trendDirection: t.trendDirection || 'up',
        }))
      : [],
  };

  const todayIdx = history.findIndex(r => r.date === record.date);
  if (todayIdx >= 0) {
    history[todayIdx] = record;
    console.log(`[main] 📊 更新今日宏观历史记录: ${record.date}`);
  } else {
    history.push(record);
    console.log(`[main] 📊 追加宏观历史记录: ${record.date}`);
  }

  if (history.length > 60) {
    history = history.slice(-60);
    console.log(`[main] 📊 历史账本已切片至最近 60 条`);
  }

  history.sort((a, b) => a.date.localeCompare(b.date));

  fs.writeFileSync(macroHistoryPath, JSON.stringify(history, null, 2), 'utf-8');
  console.log(`[main] ✅ 宏观历史账本已写入: ${macroHistoryPath} (${history.length} 条)`);
}

/* ======================================================================
   7a. 重建归档前端索引
   ====================================================================== */

function rebuildArchivesIndex() {
  ensureDir(ARCHIVES_DIR);
  const files = fs.readdirSync(ARCHIVES_DIR)
    .filter(f => /^archive_\d{4}-\d{2}-\d{2}\.json$/.test(f) || /^archive_\d{8}_\d{4}\.json$/.test(f))
    .sort();
  // 统一提取日期部分，去重
  const dateSet = new Set();
  for (const f of files) {
    const mNew = f.match(/^archive_(\d{4}-\d{2}-\d{2})\.json$/);
    const mOld = f.match(/^archive_(\d{4})(\d{2})(\d{2})_\d{4}\.json$/);
    if (mNew) dateSet.add(mNew[1]);
    else if (mOld) dateSet.add(`${mOld[1]}-${mOld[2]}-${mOld[3]}`);
  }
  const dates = Array.from(dateSet).sort();
  const index = { dates, latest: dates.length > 0 ? dates[dates.length - 1] : null };
  fs.writeFileSync(
    path.join(DATA_DIR, 'archives_index.json'),
    JSON.stringify(index, null, 2),
    'utf-8'
  );
  console.log(`[main] 📇 已重建归档前端索引: ${dates.length} 个可用日期`);
}

/* ======================================================================
   7b. 30/90 天 AI 胜率离线量化引擎 — 校准矩阵 (v6 深度扩容)
   ====================================================================== */

function computeCalibrationMatrix(currentReport) {
  ensureDir(ARCHIVES_DIR);
  const files = fs.readdirSync(ARCHIVES_DIR)
    .filter(f => /^archive_\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();

  const archives = [];
  for (const f of files) {
    try {
      const raw = fs.readFileSync(path.join(ARCHIVES_DIR, f), 'utf-8');
      const data = JSON.parse(raw);
      const m = f.match(/archive_(\d{4}-\d{2}-\d{2})\.json$/);
      if (m) archives.push({ date: m[1], data });
    } catch (e) {
      console.warn(`[main] ⚠ 校准矩阵: 档案 ${f} 解析失败: ${e.message}`);
    }
  }

  /* ---- 50% 基础值兜底（历史不足时的防断流保护） ---- */
  const matrix = {
    macro30dWin: 50.0,
    macro90dWin: 50.0,
    techSectorHit: 50.0,
    bioSectorHit: 50.0,
    cryptoSectorHit: 50.0,
  };

  if (archives.length < 2) {
    console.log(`[main] 📐 校准矩阵: 历史档案不足 2 份（当前 ${archives.length}），使用 50% 基础值平滑兜底`);
    return matrix;
  }

  console.log(`[main] 📐 校准矩阵引擎启动: ${archives.length} 份历史档案加载完毕`);

  /* ============================================================
     Step 1 — 宏观方向胜率：confidence 方向 vs Nasdaq 价格方向
     ============================================================ */

  function calcDirectionalWinRate(pairs) {
    if (pairs.length === 0) return null;
    const wins = pairs.filter(p => p.win).length;
    return Math.round((wins / pairs.length) * 1000) / 10;
  }

  const pairs30 = [];
  const pairs90 = [];

  for (let i = 0; i < archives.length; i++) {
    const early = archives[i];
    const earlyDate = new Date(early.date + 'T00:00:00');
    const earlyConf = early.data.macroMetrics?.economicConfidence;
    const earlyNasdaq = early.data.marketBenchmarks?.nasdaq?.current;
    if (earlyConf == null || earlyNasdaq == null) continue;

    for (let j = i + 1; j < archives.length; j++) {
      const late = archives[j];
      const lateDate = new Date(late.date + 'T00:00:00');
      const days = (lateDate - earlyDate) / 86400000;
      const lateConf = late.data.macroMetrics?.economicConfidence;
      const lateNasdaq = late.data.marketBenchmarks?.nasdaq?.current;
      if (lateConf == null || lateNasdaq == null) continue;

      const confDir = lateConf - earlyConf;
      const priceDir = lateNasdaq - earlyNasdaq;

      if (confDir !== 0) {
        if (days >= 28 && days <= 32) {
          pairs30.push({
            win: (confDir > 0 && priceDir > 0) || (confDir < 0 && priceDir < 0),
            earlyDate: early.date, lateDate: late.date,
          });
        }
        if (days >= 85 && days <= 95) {
          pairs90.push({
            win: (confDir > 0 && priceDir > 0) || (confDir < 0 && priceDir < 0),
            earlyDate: early.date, lateDate: late.date,
          });
        }
      }
    }
  }

  // 将今天的数据点加入配对（当前 DeepSeek 置信度 vs 最新档案）
  const todayConf = currentReport.macroMetrics?.economicConfidence;
  const todayNasdaq = currentReport.marketBenchmarks?.nasdaq?.current;
  if (archives.length > 0 && todayConf != null && todayNasdaq != null) {
    const latest = archives[archives.length - 1];
    const latestDate = new Date(latest.date + 'T00:00:00');
    const todayDate = new Date();
    const daysSince = (todayDate - latestDate) / 86400000;
    const latestConf = latest.data.macroMetrics?.economicConfidence;
    const latestNasdaq = latest.data.marketBenchmarks?.nasdaq?.current;

    if (latestConf != null && latestNasdaq != null && daysSince >= 1 && daysSince <= 3) {
      const confDir = todayConf - latestConf;
      const priceDir = todayNasdaq - latestNasdaq;
      if (confDir !== 0) {
        const isWin = (confDir > 0 && priceDir > 0) || (confDir < 0 && priceDir < 0);
        // 按实际间隔归类
        if (daysSince <= 3) {
          // 间隔较短，归入 macro30d 计算（短间隔累积）
          pairs30.push({ win: isWin, earlyDate: latest.date, lateDate: 'today' });
        }
      }
    }
  }

  const raw30 = calcDirectionalWinRate(pairs30);
  const raw90 = calcDirectionalWinRate(pairs90);
  matrix.macro30dWin = raw30 != null ? raw30 : 50.0;
  matrix.macro90dWin = raw90 != null ? raw90 : 50.0;

  if (pairs30.length > 0) {
    const w = pairs30.filter(p => p.win).length;
    console.log(`[main] 📐 macro30dWin: ${matrix.macro30dWin}% (${w}/${pairs30.length} 对)`);
  } else {
    console.log('[main] 📐 macro30dWin: 无 30 天窗口数据，使用 50% 基础值');
  }
  if (pairs90.length > 0) {
    const w = pairs90.filter(p => p.win).length;
    console.log(`[main] 📐 macro90dWin: ${matrix.macro90dWin}% (${w}/${pairs90.length} 对)`);
  } else {
    console.log('[main] 📐 macro90dWin: 无 90 天窗口数据，使用 50% 基础值');
  }

  /* ============================================================
     Step 2 — 行业命中率：assetImpact 方向 vs 对应基准指数
     ============================================================ */

  function calcSectorHitRate(assetKey, extractPrice, label) {
    let wins = 0, total = 0;
    for (let i = 0; i < archives.length; i++) {
      const early = archives[i];
      const earlyDate = new Date(early.date + 'T00:00:00');
      const impact = early.data.assetImpact?.[assetKey];
      if (!impact || (impact.status !== 'BULL' && impact.status !== 'BEAR')) continue;

      for (let j = i + 1; j < archives.length; j++) {
        const late = archives[j];
        const lateDate = new Date(late.date + 'T00:00:00');
        const days = (lateDate - earlyDate) / 86400000;
        if (days < 5 || days > 10) continue;

        const earlyPrice = extractPrice(early.data);
        const latePrice = extractPrice(late.data);
        if (earlyPrice == null || latePrice == null || earlyPrice === 0) break;

        const priceUp = latePrice > earlyPrice;
        const aiBullish = impact.status === 'BULL';
        if ((aiBullish && priceUp) || (!aiBullish && !priceUp)) wins++;
        total++;
        break;
      }
    }
    const rate = total > 0 ? Math.round((wins / total) * 1000) / 10 : null;
    if (rate != null) console.log(`[main] 📐 ${label}: ${rate}% (${wins}/${total})`);
    else console.log(`[main] 📐 ${label}: 无足够数据，使用 50% 基础值`);
    return rate;
  }

  const techRate = calcSectorHitRate(
    'techStocks',
    d => d.marketBenchmarks?.nasdaq?.current,
    'techSectorHit'
  );
  if (techRate != null) matrix.techSectorHit = techRate;

  const bioRate = calcSectorHitRate(
    'techStocks',
    d => d.marketBenchmarks?.csi300?.current,
    'bioSectorHit'
  );
  if (bioRate != null) matrix.bioSectorHit = bioRate;

  const cryptoRate = calcSectorHitRate(
    'crypto',
    d => d.marketBenchmarks?.nasdaq?.current,
    'cryptoSectorHit'
  );
  if (cryptoRate != null) matrix.cryptoSectorHit = cryptoRate;

  return matrix;
}

/* ======================================================================
   8. 管道主流程 (v6 深度扩容)
   ====================================================================== */

async function main() {
  console.log('═══════════════════════════════════════════');
  console.log('   AI 全球商情雷达 — 数据管道 v6 深度扩容 · 风控度量 + 校准矩阵');
  console.log('═══════════════════════════════════════════\n');

  const useMock = !process.env.NEWS_API_KEY;
  if (useMock) console.warn('[main] ⚠ NEWS_API_KEY 未配置，使用 Mock 数据模式。');

  // ---- Stage 1: 数据抓取（新闻 + 定量行情） ----
  console.log('[main] 📡 Stage 1/5: 抓取全球新闻与定量行情');
  const merged = await fetchAllNews({ useMock });

  const marketBenchmarks = merged.marketBenchmarks;
  const macroBarometers = merged.macroBarometers;

  // ---- Stage 2: 时光机历史档案（Token 节流）+ 真理对账 + 事件池 ----
  console.log(`\n[main] 🧠 Stage 2/5: 加载时光机历史档案、AI 真理对账与跨周期事件池`);
  let historyContext = loadHistoryContext();
  // 归档为空时使用 legacy 兜底
  if (historyContext.length === 0) {
    console.log('[main] 📜 归档为空，尝试 history/ 兜底加载');
    historyContext = loadHistoryContextLegacy();
  }
  const reconciliationContext = loadReconciliationContext(marketBenchmarks);
  const highImpactPool = loadHighImpactPool();

  // ---- Stage 3: AI 分析（含真理对账 + 跨周期事件池上下文） ----
  console.log(`\n[main] 🧠 Stage 3/5: DeepSeek V4 深度分析（真理对账 + 跨周期事件池 + A股雷达）`);
  const report = await analyzeTextStream(merged.textStream, {
    enableThinking: true,
    historyContext: historyContext,
    reconciliationContext: reconciliationContext,
    highImpactPool: highImpactPool,
  });

  // ---- Stage 3b: 注入定量行情 ----
  report.marketBenchmarks = marketBenchmarks;
  report.macroBarometers = macroBarometers;
  report.isCachedData = merged.isCachedData || false;

  // ---- Stage 3c: dynamicSectors 自动查价二次握手 ----
  console.log(`\n[main] 🔄 Stage 3c/5: dynamicSectors 自动查价二次握手`);
  const symbols = extractStockSymbols(report);
  if (symbols.length > 0) {
    console.log(`[main] 🔍 提取到 ${symbols.length} 只待查价标的`);
    const priceMap = await fetchStockPrices(symbols);
    injectStockPrices(report, priceMap);
  } else {
    console.log('[main] ℹ 未提取到 dynamicSectors 待查价标的');
  }

  // ---- Stage 3d: 后端接管计价分档（绝对价格运算 + 四档刚性分类） ----
  console.log(`\n[main] 🔄 Stage 3d/5: 后端接管计价分档（实时股价 × AI 比例系数 = 绝对价格）`);
  const processedCount = await processStockPools(report);
  if (processedCount > 0) {
    console.log(`[main] ✅ 已处理 ${processedCount} 支标的：绝对价格计算完成，刚性分档完毕`);
  } else {
    console.log('[main] ℹ 全球投资雷达未输出标的');
  }

  // ---- Stage 3e: 高影响力事件池合并（金鱼记忆破解） ----
  console.log(`\n[main] 🗄️ Stage 3e/5: 合并核心锚点事件至高影响力事件池`);
  const updatedPool = mergeAnchorEvents(report, highImpactPool);
  ensureDir(DATA_DIR);
  fs.writeFileSync(path.join(DATA_DIR, 'high_impact_news.json'), JSON.stringify(updatedPool, null, 2), 'utf-8');
  console.log(`[main] ✅ 已写入 src/data/high_impact_news.json`);

  // ---- Stage 3f: 30/90 天 AI 胜率离线量化引擎（校准矩阵） ----
  console.log(`\n[main] 📐 Stage 3f/5: 计算 30/90 天 AI 胜率校准矩阵`);
  const calibrationMatrix = computeCalibrationMatrix(report);
  report.calibrationMatrix = calibrationMatrix;
  console.log(`[main] ✅ 校准矩阵: macro30d=${calibrationMatrix.macro30dWin}%  macro90d=${calibrationMatrix.macro90dWin}%  tech=${calibrationMatrix.techSectorHit}%  bio=${calibrationMatrix.bioSectorHit}%  crypto=${calibrationMatrix.cryptoSectorHit}%`);

  // ---- Stage 4: 持久化 ----
  console.log(`\n[main] 💾 Stage 4/5: 写入数据文件`);
  persistReport(report);

  // ---- Stage 4b: GitOps 增量历史记账 ----
  appendMacroHistory(report);

  // ---- Stage 4c: 重建前端归档索引 ----
  rebuildArchivesIndex();

  // ---- 打印摘要 ----
  const mm = report.macroMetrics;
  const assetStr = Object.entries(report.assetImpact || {})
    .map(([k, v]) => `${k}=${v.status}`)
    .join(' ');
  console.log(`\n[main] 📊 分析报告摘要 (v4 里程碑)`);
  console.log(`   - 经济信心指数:   ${mm.economicConfidence}`);
  console.log(`   - 监管压力指数:   ${mm.regulatoryPressure}`);
  console.log(`   - 黑天鹅概率:     ${mm.blackSwanProbability}%`);
  console.log(`   - 媒体情绪:       ${mm.mediaSentiment} / 社媒情绪: ${mm.socialSentiment}`);
  console.log(`   - 趋势预警:       ${(mm.macroTrendAlert || '').length} 字`);
  console.log(`   - 美林时钟:       ${report.marketRegime?.quadrant}`);
  console.log(`   - 资产映射:       ${assetStr}`);
  console.log(`   - AI 辩论:        ${report.aiDebate?.bullCase?.length || 0}字看多 / ${report.aiDebate?.bearCase?.length || 0}字看空`);
  console.log(`   - 行业雷达:       ${report.industryRadar.length} 项`);
  console.log(`   - 动态行业:       ${report.dynamicSectors.length} 个 (AI 自主萃取)`);
  console.log(`   - 新闻分析:       ${report.articles.length} 篇`);
  const anchorCount = report.articles.filter(a => a.isAnchorEvent).length;
  console.log(`   - 锚点事件:       ${anchorCount}/${report.articles.length} 篇标记为 A+ 级核心事件`);
  console.log(`   - 事件池存量:     ${updatedPool.length} 条跨周期核心大事件`);
  console.log(`   - 催化剂:         ${report.catalystFactors.length} 项`);
  console.log(`   - AI 校准度:      ${report.aiCalibrationScore ?? 'N/A'}`);
  if (report.aiReview) console.log(`   - AI 复盘反思:    ${report.aiReview}`);
  const fgi = report.marketSentimentTracker?.fearGreedIndex;
  if (fgi != null) console.log(`   - 贪婪恐惧指数:  ${fgi}/100`);
  // globalInvestmentRadar 统计（扁平池）
  const gRadar = report.globalInvestmentRadar;
  const aSharePool = Array.isArray(gRadar?.aSharePool) ? gRadar.aSharePool : [];
  const usSharePool = Array.isArray(gRadar?.usSharePool) ? gRadar.usSharePool : [];
  console.log(`   - 全球投资雷达:   A股 ${aSharePool.length} 支 / 美股 ${usSharePool.length} 支`);

  // 个股行情注入状态
  let stockCount = 0, priceCount = 0;
  for (const s of report.dynamicSectors || []) {
    for (const st of s.investmentVehicles?.stocks || []) {
      stockCount++;
      if (st.price != null) priceCount++;
    }
  }
  console.log(`   - 个股覆盖:       ${stockCount} 只, ${priceCount} 只含实时行情`);

  // 全球投资雷达实时行情覆盖（扁平池）
  const allGlobal = [...aSharePool, ...usSharePool];
  const withPrice = allGlobal.filter(s => s.price != null).length;
  console.log(`   - 实时行情覆盖:   ${withPrice}/${allGlobal.length} 支含实时价格`);

  // 校准矩阵摘要
  const cm = report.calibrationMatrix;
  if (cm) {
    console.log(`   - 校准矩阵:       macro30d=${cm.macro30dWin}%  macro90d=${cm.macro90dWin}%  tech=${cm.techSectorHit}%  bio=${cm.bioSectorHit}%  crypto=${cm.cryptoSectorHit}%`);
  }

  console.log(`\n[main] ✅ v6 深度扩容管道执行完毕。`);
  process.exit(0);
}

main().catch((err) => {
  console.error(`[main] 💥 管道异常终止:`, err.message);
  process.exit(1);
});
