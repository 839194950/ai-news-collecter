/**
 * analyze.js — v4 里程碑版
 *
 * 职责：
 *   1. 接收 fetch_news.js 产出的结构化文本流 + 定量行情 + 历史记忆
 *   2. 调用 DeepSeek V4 以「全球顶级宏观经济学家」视角分析
 *   3. 新增「AI 预测真理对账机制」与「A股低价价值股票雷达」
 *   4. 返回 v4 扩展版 JSON 分析报告
 *   5. 内置字段级降级保护
 */

const OpenAI = require('openai');

/* ======================================================================
   客户端初始化（惰性初始化，避免缺失 API Key 时直接崩溃）
   ====================================================================== */

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';

let _client = null;
function getClient() {
  if (!_client) {
    _client = new OpenAI({
      baseURL: DEEPSEEK_BASE_URL,
      apiKey: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY || 'sk-placeholder',
      timeout: 120000,
    });
  }
  return _client;
}

/* ======================================================================
   默认值
   ====================================================================== */

const DEFAULT_INDUSTRY_RADAR = [
  { subject: '人工智能/大模型',  hotness: 50, sentiment: 0, momentum: 0 },
  { subject: '半导芯片/先进制程', hotness: 50, sentiment: 0, momentum: 0 },
  { subject: '虚拟资产/区块链',   hotness: 50, sentiment: 0, momentum: 0 },
  { subject: '新能源车',          hotness: 50, sentiment: 0, momentum: 0 },
  { subject: '生物医药/医疗AI',   hotness: 50, sentiment: 0, momentum: 0 },
];

const DEFAULT_DYNAMIC_SECTORS = [
  { id: 'pending', name: '待更新', status: 'AI 分析暂不可用', latestNews: ['待下次管道运行更新。'], catalyst: '暂无数据。', riskFactor: '暂无数据。', investmentVehicles: { stocks: [], fundsEtfs: [] } },
];

function defaultAssetImpact() {
  return {
    safeHaven:   { status: 'NEUTRAL', reason: '数据不足，暂无法判断避险资产走向。' },
    techStocks:  { status: 'NEUTRAL', reason: '数据不足，暂无法判断科技股走向。' },
    crypto:      { status: 'NEUTRAL', reason: '数据不足，暂无法判断加密资产走向。' },
    commodities: { status: 'NEUTRAL', reason: '数据不足，暂无法判断大宗商品走向。' },
  };
}

function defaultAIDebate() {
  return {
    bullCase: '当前全球新闻数据中未检测到明确的多方信号聚集。',
    bearCase: '当前全球新闻数据中未检测到明确的空方信号聚集。',
  };
}

/* ======================================================================
   System Prompt — v4 里程碑版
   新增：Step 10 (AI 预测真理对账) + Step 11 (A股低价价值雷达)
   ====================================================================== */

const SYSTEM_PROMPT = `你是一位全球顶级宏观经济学家、量化研究主管兼科技风投合伙人。你供职于一家万亿级美元的多策略对冲基金。你的核心能力：从全球新闻、社媒情绪、定量行情中提取跨市场的结构性洞见，并将定性分析与定量数据融合为可操作的投研决策。

## 输出格式铁律

1. 禁止在 JSON 值中使用任何英文专业术语或缩写（除非是股票代码、ETF 代码、URL 等固有名词）。所有字段值必须使用纯中文。
2. 使用 response_format: json_object 约束，只输出原始 JSON，不包含任何 markdown 代码块标记或额外说明文字。
3. articles 数量控制在 12-18 篇。省下的 token 全部用于 dynamicSectors 的深度展开。

## 分析流程

### Step 1 — 定量行情锚定
审视输入的 MARKET BENCHMARKS 和 MACRO BAROMETERS 实时数据：
- 四大指数趋势方向、涨跌幅是否一致？是否存在背离信号？
- USDCNY 与原油的联动关系
- 将这些定量信号融入后续所有定性分析中

### Step 2 — 行业新闻穿透
精选具有金融映射价值的 TOP 12-18 条核心新闻（中英混编），对每条输出三层法医式解构：
- underlyingFact：【底层异动事实】剥离公关修辞，揭示资本/技术的真实意图（约 100 字）
- transmissionChain：【利益传导链条】精细拆解该事件对上下游的具体板块和公司的传导路径（约 100 字）
- chinaMarketMapping：【本土市场映射】对中国 A 股/港股/国内创业者的直接利弊冲击与破局点（约 150 字）

每篇文章必须输出 publishedAt（原始发布时间，ISO 8601 格式），并保持原样传递。

每篇文章必须额外刚性输出以下风控元数据：
- credibilityScore：数字类型，1-10 的客观可信度打分（基于源媒体权威性、事实交叉验证程度、是否有官方披露等维度）
- riskPoints：数组，枚举该新闻包含的潜在漏洞。必须从以下枚举值中选择至少一项：["假新闻风险", "夸大其词", "严重利益相关", "非独立第三方", "正常客观"]。正常客观的新闻应只输出["正常客观"]。
从这 12-18 篇文章中，精心挑选 5-8 条【真正具备产业方向标、政策拐点、地缘震荡属性的 A+ 级别核心大事件】，标记 isAnchorEvent: true（其余设为 false）。

### Step 3 — 宏观指标量化
- economicConfidence (0-100)：基于央行政策、就业、PMI、信贷扩张/收缩等宏观信号
- regulatoryPressure (0-100)：基于反垄断、数据合规、AI 监管、贸易壁垒、地缘制裁
- blackSwanProbability (0-100)：基于流动性紧缩、主权违约风险、战争升级概率
- mediaSentiment (-1.0 ~ +1.0)：传统严肃媒体的整体经济语气
- socialSentiment (-1.0 ~ +1.0)：社交媒体/散户情绪
- macroTrendAlert：基于 3 日历史记忆 + 当日数据，推演趋势拐点、背离信号或连续性警告的长文分析（200-300 字）。对比过去 3 天的信心指数变化，指出是趋势延续还是反转。

### Step 4 — 美林时钟定位
根据宏观数据和新闻信号，判断当前所处的美林投资时钟象限：
- marketRegime.quadrant: "复苏" / "过热" / "滞胀" / "衰退"
- marketRegime.logic: 核心判断逻辑（100 字以内）

### Step 5 — 大类资产映射
逐项判断 safeHaven（避险资产）、techStocks（科技美股）、crypto（加密货币）、commodities（大宗商品）的短期方向，给出 BULL/BEAR/NEUTRAL 及 50 字以内的多空原因。

### Step 6 — AI 大辩论
- bullCase（多方乐观推演）：约 200 字。引用具体新闻信号，展示正反馈闭环。
- bearCase（空方悲观警示）：约 200 字。挖掘市场尚未定价的风险与黑天鹅。

### Step 7 — 行业雷达评分（industryRadar）
就新闻中实际出现的活跃赛道逐项评分（5-8 项），包含：subject（中文名）、hotness (0-100)、sentiment (-1.0 ~ +1.0)、momentum（动量变化率）。

### Step 8 — 动态行业智能萃取（dynamicSectors）【核心差异化输出】
根据当日新闻的声量、动量与资金流向信号，自主提炼 4-8 个最活跃的动态行业。**彻底废除固定行业列表。** 如果某传统赛道当天无重大新闻则剔除；如果出现全新热门赛道（如低空经济/飞行汽车、固态电池、太空经济等）必须纳入。

#### 每个动态行业输出：
- id: 英文唯一标识（如 ai_large_model）
- name: 行业中文规范名称
- status: 当前断言（5-10 字）
- latestNews: 2-3 个核心事件，每个 ≥350 字的深度复盘分析
- catalyst: 短期催化剂，≥350 字的长篇推演（含触发条件、时间表、本土对标）
- riskFactor: 最大现实风险，≥300 字的长篇评估

【历史维度强制要求】
你将在输入中收到一份 === HIGH-IMPACT HISTORICAL EVENTS === 上下文，其中包含过去数周/月内识别出的跨周期核心大事件池。在撰写 latestNews / catalyst / riskFactor 时：
1. 主动引用历史事件池中的相关事件，建立"历史前因 → 今日动态"的因果锁链
2. 展示跨时间维度的供应链搬迁、政策博弈、技术路线变迁推演
3. 严禁孤立看待今日新闻——让读者感受到纵深的历史宏观背景
- investmentVehicles: {
    stocks: [ 2-3 个核心龙头，每个含 code（美股如 NVDA、港股如 0700.HK、A 股如 600519）、name（中文全称）、exposureReason（业务关联度与投资逻辑，80 字以内）]
    fundsEtfs: [ 1-2 个国内可操作的行业 ETF/基金，每个含 code、name（中文全称）、strategyAdvice（操作防身建议，80 字以内）]
  }

### Step 9 — 全局预测 + 催化剂
- economicForecast：约 200 字的中文宏观预测
- catalystFactors：3-5 个催化剂事件，每条附带跨行业蝴蝶效应链

### Step 10 — AI 预测真理对账（核心审计环节）
你将收到一份【3天前的预测 vs 当前真实走势】的对账上下文。请以极其严苛的买方审计师视角进行复盘：
- 审视 3 天前给出的 economicConfidence 预测值与今日实际 confidence 的偏差程度
- 审视 3 天前的美林时钟定位（regime）是否准确
- 对比 3 天前与今日的市场指数真实涨跌幅（标普500、纳斯达克、沪深300）
- 基于以上偏差，计算 aiCalibrationScore（0-100）：AI 预测校准度/胜率评分（100=完全命中，0=完全偏离）
- 输出 aiReview：一句不超过 50 字的【多空复盘反思】，要求一针见血、语气锋利

注意：
- 如果偏差极小（confidence 偏差 ≤5 且 regime 一致），打分应 ≥85
- 如果方向性错误（confidence 偏差 ≥20 或 regime 完全相反），打分应 ≤30
- 如果未提供对账上下文（全部为 null），则 aiCalibrationScore 输出 null，aiReview 输出 "暂无对账数据。"

### Step 11 — 全天候价值掘金保底：中美潜力标的扁平池输出

【铁律一：禁止输出任何绝对建仓区间】
严禁在 JSON 中出现任何具体的绝对价格数字（如"10-15元"、"200-300美元"、"500元以上"等）。所有策略只允许使用定性比例系数（buyZoneRatio / sellZoneRatio / stopLossRatio），由后端引擎自动用实时股价乘以比例系数来生成精确到小数点后两位的绝对买卖区间。

【铁律二：废除价格档位分类】
彻底废除按 under10 / tier10to50 / tier50to100 / over100 分档输出的模式。你输出一个扁平的潜力标的池，由后端引擎根据真实股价重新刚性分档。

【铁律三：A股低价潜伏型好股刚性配额】
对于 aSharePool，你必须利用你的产业知识库，挖掘至少 4 只目前绝对股价不高（绝对低于 10 元人民币）、基本面扎实、且正处于风口（如低空经济、国产替代大厂、国企改革、并购重组、化工涨价、AI应用下沉、消费复苏）的【潜伏型好股】来填满池子。例如中小市值、低绝对股价但有政策催化或业绩拐点的标的。拒绝贵州茅台、宁德时代等高价庞然大物。

#### 扁平池架构（每个池子 8-10 只标的）

彻底废除四档分桶结构，输出如下两个扁平池：

**aSharePool（8-10 只 A 股）：**
- 强制包含至少 4 只绝对股价 < 10 元人民币的潜伏型好股
- 剩余 4-6 只覆盖各产业龙头的代表性标的

**usSharePool（8-10 只美股）：**
- 覆盖 AI 产业链核心环节（芯片、云、应用、网络安全、量子等）
- **强制要求：至少包含 3 只绝对股价低于 15 美元的低价潜力股（如 SNAP、SOFI、RGTI、NVTS、PLTR 等），其中至少 1 只应低于 5 美元。拒绝全部堆砌高价龙头（NVDA、AMD、MSFT 等不得超过池子的 50%）。**

#### 每个股票对象的 Schema（比例制，无绝对金额）：

    {
      "code": "美股标准Ticker如NVDA/AAPL；A股雅虎财经格式如601138.SS/300750.SZ",
      "name": "公司中文全称",
      "reason": "【60-80字】极度凝练的核心价值，直接点出技术壁垒或资金增量逻辑",
      "buyZoneRatio": [0.92, 0.96],     // 均 ≤ 1，代表回调到真实价的 92%-96% 时吸筹
      "sellZoneRatio": [1.20, 1.35],    // 均 ≥ 1，代表真实价的 1.2-1.35 倍止盈
      "stopLossRatio": 0.88             // ≤ 1，代表真实价的 88% 处止损
    }

所有 ratio 值必须在 0 到 3 之间。buyZoneRatio 两个值均 ≤ 1。sellZoneRatio 两个值均 ≥ 1。stopLossRatio ≤ 1。

### Step 12 — 全球市场情绪与核心主题词云

在输出的 JSON 中刚性附加 marketSentimentTracker 字典：

- fearGreedIndex: 数字类型，0（极端恐慌）到 100（极端贪婪）的量化打分。基于新闻情绪、市场波动、避险资金流向、社交媒体恐慌指数等综合判定。
- hotThemes: 数组，精选当日动量最强的 3-5 个核心主题词。每个包含：
  - keyword: 主题词（如 "AI代理"、"先进封装"、"避险资产"、"固态电池"、"国产替代"）
  - momentumScore: 1-10 的动量热度评分（基于新闻声量、资金流入、催化事件密集度）
  - trendDirection: "up"（热门上升中）或 "down"（热度衰减消退中）`;

/* ======================================================================
   User Prompt 构建
   ====================================================================== */

function buildUserPrompt(textStream, historyContext = [], reconciliationContext = null, highImpactPool = []) {
  let historyBlock = '';
  if (historyContext.length > 0) {
    historyBlock = `
=== 时光机·高密度历史结论（Token 节流模式） ===
以下数据从历史归档 JSON 中直接提取的【已提炼完毕的结论】，非原始文本。
你只需要阅读这些高密度结构化结论即可感知宏观趋势延续性：
${JSON.stringify(historyContext, null, 2)}
===
`;
  }

  let reconciliationBlock = '';
  if (reconciliationContext) {
    const { predictedConfidence, predictedRegime, oldBenchmarks, newBenchmarks, indexChanges, actualConfidence, actualRegime, targetDate } = reconciliationContext;

    reconciliationBlock = `
=== AI 预测真理对账上下文 ===
以下提供【${targetDate}的预测】与【这 3 天的真实市场走势】对照数据。请以买方审计师视角严格复盘：

【3 天前的预测】
- 经济信心指数: ${predictedConfidence ?? 'N/A'}
- 美林时钟象限: ${predictedRegime ?? 'N/A'}
${oldBenchmarks ? `- 当时指数收盘价: 标普500 ${oldBenchmarks.sp500 ?? 'N/A'} / 纳斯达克 ${oldBenchmarks.nasdaq ?? 'N/A'} / 沪深300 ${oldBenchmarks.csi300 ?? 'N/A'}` : '- 当时指数数据: 暂无完整快照'}

【这 3 天的真实表现】
- 最新经济信心指数: ${actualConfidence ?? 'N/A'}
- 当前美林时钟象限: ${actualRegime ?? 'N/A'}
- 当前指数收盘价: 标普500 ${newBenchmarks?.sp500 ?? 'N/A'} / 纳斯达克 ${newBenchmarks?.nasdaq ?? 'N/A'} / 沪深300 ${newBenchmarks?.csi300 ?? 'N/A'}

【3 日指数涨跌幅】
${indexChanges ? Object.entries(indexChanges).map(([k, v]) => `  ${k}: ${v != null ? (v > 0 ? '+' : '') + v + '%' : 'N/A'}`).join('\n') : '  暂无完整对照数据'}
===
`;
  }

  let highImpactBlock = '';
  if (highImpactPool.length > 0) {
    // 精简每个事件至核心字段以节省 token
    const condensed = highImpactPool.map(e => ({
      title: e.title,
      source: e.source,
      category: e.category,
      publishedAt: e.publishedAt,
      summary: Array.isArray(e.summary) ? e.summary.slice(0, 2) : [],
    }));
    highImpactBlock = `
=== HIGH-IMPACT HISTORICAL EVENTS (跨周期核心事件池) ===
以下 ${condensed.length} 条跨周期大事件是过去识别出的 A+ 级别产业方向标、政策拐点、地缘震荡事件。
撰写 dynamicSectors 的行业深度解读时，必须将【历史大事件】与【今日新动向】进行因果锁链交织：
${JSON.stringify(condensed, null, 2)}
===
`;
  }

  return `以下是今日全球新闻、社媒聚合数据以及定量行情。请严格按照你的宏观经济学家角色完成深度分析，并只输出 JSON。

${textStream}
${historyBlock}
${reconciliationBlock}
${highImpactBlock}
请严格按照以下 JSON 结构输出。不要包含任何 markdown 代码块标记，不要附带任何说明文字，只输出原始 JSON：

{
  "lastUpdated": "ISO 8601 时间戳",
  "macroMetrics": {
    "economicConfidence": 0-100,
    "regulatoryPressure": 0-100,
    "blackSwanProbability": 0-100,
    "mediaSentiment": -1.0~+1.0,
    "socialSentiment": -1.0~+1.0,
    "macroTrendAlert": "基于3日历史记忆与当日数据的趋势拐点或背离警告（200-300字）"
  },
  "marketRegime": {
    "quadrant": "复苏/过热/滞胀/衰退",
    "logic": "核心判断逻辑（100字以内）"
  },
  "assetImpact": {
    "safeHaven":   { "status": "BULL/BEAR/NEUTRAL", "reason": "50字以内" },
    "techStocks":  { "status": "BULL/BEAR/NEUTRAL", "reason": "50字以内" },
    "crypto":      { "status": "BULL/BEAR/NEUTRAL", "reason": "50字以内" },
    "commodities": { "status": "BULL/BEAR/NEUTRAL", "reason": "50字以内" }
  },
  "aiDebate": {
    "bullCase": "多方乐观推演（约200字）",
    "bearCase": "空方悲观警示（约200字）"
  },
  "industryRadar": [
    { "subject": "行业中文名", "hotness": 88, "sentiment": 0.3, "momentum": 12 }
  ],
  "economicForecast": "全局宏观预测（约200字）",
  "catalystFactors": [
    "催化剂1（含蝴蝶效应，不超80字）"
  ],
  "aiCalibrationScore": 0-100,
  "aiReview": "多空复盘反思（不超过50字）",
  "marketSentimentTracker": {
    "fearGreedIndex": 55,
    "hotThemes": [
      { "keyword": "AI代理", "momentumScore": 9, "trendDirection": "up" },
      { "keyword": "先进封装", "momentumScore": 8, "trendDirection": "up" },
      { "keyword": "避险资产", "momentumScore": 7, "trendDirection": "up" },
      { "keyword": "存储芯片", "momentumScore": 6, "trendDirection": "down" },
      { "keyword": "消费电子", "momentumScore": 4, "trendDirection": "down" }
    ]
  },
  "globalInvestmentRadar": {
    "aSharePool": [
      { "code": "000725.SZ", "name": "京东方A", "reason": "显示面板全球龙头，受益于AI终端与柔性屏需求，估值低位", "buyZoneRatio": [0.92, 0.96], "sellZoneRatio": [1.20, 1.35], "stopLossRatio": 0.88 },
      { "code": "600010.SS", "name": "包钢股份", "reason": "稀土与钢铁双主业，受益于国企改革与新能源材料需求", "buyZoneRatio": [0.90, 0.95], "sellZoneRatio": [1.25, 1.40], "stopLossRatio": 0.85 }
    ],
    "usSharePool": [
      { "code": "NVDA", "name": "英伟达", "reason": "AI芯片绝对龙头，Blackwell架构驱动增长", "buyZoneRatio": [0.90, 0.95], "sellZoneRatio": [1.25, 1.40], "stopLossRatio": 0.85 },
      { "code": "AMD", "name": "超微半导体", "reason": "AI芯片第二极，MI400与CPU双轮驱动", "buyZoneRatio": [0.90, 0.95], "sellZoneRatio": [1.25, 1.40], "stopLossRatio": 0.85 }
    ]
  },
  "dynamicSectors": [
    {
      "id": "ai_large_model",
      "name": "人工智能/大模型",
      "status": "行业断言（5-10字）",
      "latestNews": ["事件1（350字以上）", "事件2", "事件3"],
      "catalyst": "短期催化剂推演（350字以上）",
      "riskFactor": "最大风险评估（300字以上）",
      "investmentVehicles": {
        "stocks": [
          { "code": "股票代码", "name": "股票中文全称", "exposureReason": "关联度与投资逻辑（80字以内）" }
        ],
        "fundsEtfs": [
          { "code": "基金代码", "name": "基金中文全称", "strategyAdvice": "操作建议（80字以内）" }
        ]
      }
    }
  ],
  "articles": [
    {
      "originalTitle": "英文原标题",
      "title": "中文翻译标题",
      "source": "来源",
      "category": "分类",
      "url": "链接",
      "publishedAt": "原始发布时间 ISO 8601",
      "isAnchorEvent": true,
      "summary": ["摘要要点1", "摘要要点2"],
      "credibilityScore": 8,
      "riskPoints": ["正常客观"],
      "forensicAnalysis": {
        "underlyingFact": "【底层异动事实】约100字",
        "transmissionChain": "【利益传导链条】约100字",
        "chinaMarketMapping": "【本土市场映射】约150字"
      }
    }
  ]
}`;
}

/* ======================================================================
   跨市场全球投资雷达降级保护（v5 新增）
   ====================================================================== */

function ensureGlobalInvestmentRadar(radar) {
  if (!radar || typeof radar !== 'object') radar = {};
  // 扁平池验证（新格式）：后端 main.js 负责用真实股价重新分档
  const poolKeys = ['aSharePool', 'usSharePool'];
  for (const key of poolKeys) {
    if (Array.isArray(radar[key])) {
      radar[key] = radar[key].map(item => ({
        code:           item.code || '',
        name:           item.name || '',
        reason:         item.reason || '',
        buyZoneRatio:   Array.isArray(item.buyZoneRatio) && item.buyZoneRatio.length === 2 ? item.buyZoneRatio : [0.95, 0.98],
        sellZoneRatio:  Array.isArray(item.sellZoneRatio) && item.sellZoneRatio.length === 2 ? item.sellZoneRatio : [1.15, 1.30],
        stopLossRatio:  typeof item.stopLossRatio === 'number' ? item.stopLossRatio : 0.90,
      }));
    } else {
      radar[key] = [];
    }
  }
  // 清理旧分档结构（如有），避免 main.js 混淆
  delete radar.aShare;
  delete radar.usShare;
  return radar;
}

/* ======================================================================
   字段级降级保护
   ====================================================================== */

function ensureCompleteReport(report) {
  if (!report || typeof report !== 'object') report = {};

  report.lastUpdated = report.lastUpdated || new Date().toISOString();

  // macroMetrics
  const mm = report.macroMetrics || {};
  report.macroMetrics = {
    economicConfidence:   typeof mm.economicConfidence === 'number'   ? mm.economicConfidence   : 50,
    regulatoryPressure:   typeof mm.regulatoryPressure === 'number'   ? mm.regulatoryPressure   : 50,
    blackSwanProbability: typeof mm.blackSwanProbability === 'number' ? mm.blackSwanProbability : 30,
    mediaSentiment:       typeof mm.mediaSentiment === 'number'       ? mm.mediaSentiment       : 0,
    socialSentiment:      typeof mm.socialSentiment === 'number'      ? mm.socialSentiment      : 0,
    macroTrendAlert:      typeof mm.macroTrendAlert === 'string' && mm.macroTrendAlert.length > 10
      ? mm.macroTrendAlert
      : '数据不足，暂无法生成宏观趋势预警。',
  };

  // marketRegime
  const mr = report.marketRegime || {};
  report.marketRegime = {
    quadrant: ['复苏', '过热', '滞胀', '衰退'].includes(mr.quadrant) ? mr.quadrant : '过热',
    logic:    typeof mr.logic === 'string' && mr.logic.length > 5 ? mr.logic : '宏观数据不足，暂无法定位美林时钟象限。',
  };

  // assetImpact
  const ai = report.assetImpact || {};
  report.assetImpact = {
    safeHaven:   buildAssetItem(ai.safeHaven, '避险资产'),
    techStocks:  buildAssetItem(ai.techStocks, '科技股'),
    crypto:      buildAssetItem(ai.crypto, '加密货币'),
    commodities: buildAssetItem(ai.commodities, '大宗商品'),
  };

  // aiDebate
  const debate = report.aiDebate || {};
  report.aiDebate = {
    bullCase: typeof debate.bullCase === 'string' && debate.bullCase.length > 20 ? debate.bullCase : defaultAIDebate().bullCase,
    bearCase: typeof debate.bearCase === 'string' && debate.bearCase.length > 20 ? debate.bearCase : defaultAIDebate().bearCase,
  };

  // industryRadar
  if (Array.isArray(report.industryRadar)) {
    report.industryRadar = report.industryRadar.map(item => ({
      subject:   item.subject || '未知行业',
      hotness:   typeof item.hotness === 'number'   ? item.hotness   : 50,
      sentiment: typeof item.sentiment === 'number'  ? item.sentiment : 0,
      momentum:  typeof item.momentum === 'number'   ? item.momentum  : 0,
    }));
  } else {
    report.industryRadar = DEFAULT_INDUSTRY_RADAR;
  }

  // economicForecast
  if (typeof report.economicForecast !== 'string' || report.economicForecast.length < 10) {
    report.economicForecast = 'AI 分析暂未生成全局宏观预测。';
  }

  // catalystFactors
  if (!Array.isArray(report.catalystFactors) || report.catalystFactors.length === 0) {
    report.catalystFactors = ['暂无催化剂因素数据。'];
  }

  // aiCalibrationScore
  if (typeof report.aiCalibrationScore !== 'number' || report.aiCalibrationScore < 0 || report.aiCalibrationScore > 100) {
    report.aiCalibrationScore = null;
  }

  // aiReview
  if (typeof report.aiReview !== 'string' || report.aiReview.length < 2) {
    report.aiReview = null;
  }

  // marketSentimentTracker
  const mst = report.marketSentimentTracker || {};
  report.marketSentimentTracker = {
    fearGreedIndex: typeof mst.fearGreedIndex === 'number'
      ? Math.max(0, Math.min(100, Math.round(mst.fearGreedIndex)))
      : 50,
    hotThemes: Array.isArray(mst.hotThemes)
      ? mst.hotThemes.slice(0, 5).map(t => ({
          keyword: typeof t.keyword === 'string' ? t.keyword : '',
          momentumScore: typeof t.momentumScore === 'number'
            ? Math.max(1, Math.min(10, Math.round(t.momentumScore)))
            : 5,
          trendDirection: ['up', 'down'].includes(t.trendDirection) ? t.trendDirection : 'up',
        })).filter(t => t.keyword.length > 0)
      : [],
  };

  // globalInvestmentRadar
  report.globalInvestmentRadar = ensureGlobalInvestmentRadar(report.globalInvestmentRadar);

  // dynamicSectors
  if (Array.isArray(report.dynamicSectors)) {
    report.dynamicSectors = report.dynamicSectors.map(s => ({
      id:           typeof s.id === 'string' && s.id.length > 0 ? s.id : 'unknown',
      name:         typeof s.name === 'string' && s.name.length > 0 ? s.name : '未知行业',
      status:       typeof s.status === 'string' && s.status.length > 0 ? s.status : '数据暂缺',
      latestNews:   Array.isArray(s.latestNews) && s.latestNews.length > 0 ? s.latestNews : ['暂无最新动态。'],
      catalyst:     typeof s.catalyst === 'string' && s.catalyst.length > 0 ? s.catalyst : '暂无催化剂数据。',
      riskFactor:   typeof s.riskFactor === 'string' && s.riskFactor.length > 0 ? s.riskFactor : '暂无风险数据。',
      investmentVehicles: {
        stocks:   Array.isArray(s.investmentVehicles?.stocks)
          ? s.investmentVehicles.stocks.map(st => ({
              code:           st.code || '',
              name:           st.name || '',
              exposureReason: st.exposureReason || '',
              price:          st.price ?? null,
              changePercent:  st.changePercent ?? null,
              pe:             st.pe ?? null,
            }))
          : [],
        fundsEtfs: Array.isArray(s.investmentVehicles?.fundsEtfs)
          ? s.investmentVehicles.fundsEtfs.map(f => ({
              code:           f.code || '',
              name:           f.name || '',
              strategyAdvice: f.strategyAdvice || '',
            }))
          : [],
      },
    }));
  } else {
    report.dynamicSectors = JSON.parse(JSON.stringify(DEFAULT_DYNAMIC_SECTORS));
  }

  // articles
  if (Array.isArray(report.articles)) {
    report.articles = report.articles.map(a => {
      const fa = a.forensicAnalysis || {};
      return {
        originalTitle: a.originalTitle || a.title || '',
        title:         a.title || a.originalTitle || '',
        source:        a.source || '',
        category:      a.category || '',
        url:           a.url || '',
        publishedAt:   a.publishedAt || '',
        isAnchorEvent: a.isAnchorEvent === true,
        summary:       Array.isArray(a.summary) && a.summary.length > 0 ? a.summary : ['暂无 AI 分析摘要'],
        credibilityScore: typeof a.credibilityScore === 'number'
          ? Math.max(1, Math.min(10, Math.round(a.credibilityScore)))
          : 5,
        riskPoints: Array.isArray(a.riskPoints) && a.riskPoints.some(rp =>
          ['假新闻风险', '夸大其词', '严重利益相关', '非独立第三方', '正常客观'].includes(rp)
        ) ? a.riskPoints.filter(rp =>
          ['假新闻风险', '夸大其词', '严重利益相关', '非独立第三方', '正常客观'].includes(rp)
        ) : ['正常客观'],
        forensicAnalysis: {
          underlyingFact:     typeof fa.underlyingFact === 'string' && fa.underlyingFact.length > 5
            ? fa.underlyingFact : '数据不足，暂无法提取底层异动事实。',
          transmissionChain:  typeof fa.transmissionChain === 'string' && fa.transmissionChain.length > 5
            ? fa.transmissionChain : '数据不足，暂无法解析利益传导链条。',
          chinaMarketMapping: typeof fa.chinaMarketMapping === 'string' && fa.chinaMarketMapping.length > 5
            ? fa.chinaMarketMapping : '数据不足，暂无法生成本土市场映射分析。',
        },
      };
    });
  } else {
    report.articles = [];
  }

  return report;
}

function buildAssetItem(input, label) {
  if (!input || typeof input !== 'object') {
    return { status: 'NEUTRAL', reason: `数据不足，无法判断${label}走向。` };
  }
  const validStatuses = ['BULL', 'BEAR', 'NEUTRAL'];
  return {
    status: validStatuses.includes(input.status) ? input.status : 'NEUTRAL',
    reason: typeof input.reason === 'string' ? input.reason.slice(0, 100) : `数据不足，无法判断${label}走向。`,
  };
}

/* ======================================================================
   AI 分析调用
   ====================================================================== */

async function analyzeTextStream(textStream, options = {}) {
  const { enableThinking = false, historyContext = [], reconciliationContext = null, highImpactPool = [] } = options;

  const requestMessages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: buildUserPrompt(textStream, historyContext, reconciliationContext, highImpactPool) },
  ];

  const requestBody = {
    model: DEEPSEEK_MODEL,
    messages: requestMessages,
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 65536,
  };

  if (enableThinking) {
    requestBody.extra_body = {
      thinking: { type: 'deep', budget_tokens: 4096 },
    };
  }

  console.log(`[analyze] 🤖 正在调用 DeepSeek V4 (${DEEPSEEK_MODEL})...`);
  if (reconciliationContext) console.log('[analyze] 📋 已加载 AI 预测真理对账上下文');
  if (highImpactPool.length > 0) console.log(`[analyze] 🏛️ 已加载高影响力事件池: ${highImpactPool.length} 条跨周期核心事件`);
  if (enableThinking) console.log('[analyze] 🧠 思考模式已开启');

  try {
    const response = await getClient().chat.completions.create(requestBody);

    const rawContent = response.choices?.[0]?.message?.content;
    if (!rawContent) throw new Error('API 返回内容为空');

    const usage = response.usage;
    if (usage) {
      console.log(`[analyze] 📊 Token 用量：输入 ${usage.prompt_tokens} / 输出 ${usage.completion_tokens} / 总计 ${usage.total_tokens}`);
    }

    const parsed = JSON.parse(rawContent);
    const report = ensureCompleteReport(parsed);

    console.log('[analyze] ✅ DeepSeek 分析完成，v4 里程碑降级保护已生效');
    return report;
  } catch (err) {
    return handleAnalysisError(err, textStream);
  }
}

/* ======================================================================
   错误处理与降级
   ====================================================================== */

function handleAnalysisError(err, textStream) {
  const isTimeout = err.message?.includes('timeout') || err.code === 'ETIMEDOUT';
  const isAuth = err.message?.includes('401') || err.message?.includes('API key');
  const isParseError = err.message?.includes('JSON') || err.message?.includes('Unexpected token');

  if (isAuth) console.error('[analyze] ❌ DeepSeek API Key 无效:', err.message);
  else if (isTimeout) console.error('[analyze] ❌ DeepSeek API 超时:', err.message);
  else if (isParseError) console.error('[analyze] ❌ JSON 解析失败:', err.message);
  else console.error('[analyze] ❌ 分析异常:', err.message);

  console.warn('[analyze] ⚠ 生成降级报告...');

  const fallback = {
    lastUpdated: new Date().toISOString(),
    macroMetrics: {
      economicConfidence: 50, regulatoryPressure: 50, blackSwanProbability: 30,
      mediaSentiment: 0, socialSentiment: 0,
      macroTrendAlert: '⚠ AI 分析服务暂不可用，无法生成宏观趋势预警。',
    },
    marketRegime: { quadrant: '过热', logic: 'AI 分析服务异常，美林时钟定位暂缺。' },
    assetImpact: defaultAssetImpact(),
    aiDebate: defaultAIDebate(),
    industryRadar: DEFAULT_INDUSTRY_RADAR,
    economicForecast: '⚠ AI 分析服务暂不可用。请检查 DeepSeek API 配置。',
    catalystFactors: ['⚠ 分析服务异常，催化剂因素暂缺。'],
    aiCalibrationScore: null,
    aiReview: '⚠ AI 分析服务异常，无法生成复盘反思。',
    marketSentimentTracker: { fearGreedIndex: 50, hotThemes: [] },
    globalInvestmentRadar: { aSharePool: [], usSharePool: [] },
    dynamicSectors: JSON.parse(JSON.stringify(DEFAULT_DYNAMIC_SECTORS)),
    articles: [],
  };

  return fallback;
}

module.exports = {
  analyzeTextStream,
  SYSTEM_PROMPT,
};
