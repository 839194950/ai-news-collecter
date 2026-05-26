"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, CartesianGrid,
  BarChart, Bar, Cell, ScatterChart, Scatter,
} from "recharts";
import { Lock, TrendingUp, AlertTriangle, ExternalLink, ChevronDown, ChevronUp, Brain, Sparkles, Hourglass } from "lucide-react";
import Link from "next/link";
import NavHeader from "../components/NavHeader";

/* ======================================================================
   类型定义
   ====================================================================== */

interface MacroHistoryRecord {
  date: string;
  confidence: number;
  liquidity: number;
  mediaSentiment: number;
  socialSentiment: number;
  regime: string;
}

/* ======================================================================
   v2 默认 Mock 数据（latest.json 加载失败时自动降级到此）
   ====================================================================== */
const DEFAULT_DATA = {
  lastUpdated: "2026-05-17 19:00:00",
  macroMetrics: {
    economicConfidence: 78,
    regulatoryPressure: 45,
    blackSwanProbability: 25,
    mediaSentiment: 0.65,
    socialSentiment: -0.15,
  },
  assetImpact: {
    safeHaven:   { status: "NEUTRAL", reason: "短期避险情绪温和，资金向风险资产迁移趋势明显。" },
    techStocks:  { status: "BULL",    reason: "推理模型爆发推动算力需求，科技资本开支超预期。" },
    crypto:      { status: "BULL",    reason: "合规化提速，传统机构资金入场通道逐步打开。" },
    commodities: { status: "BEAR",    reason: "需求放缓预期叠加增产压力，大宗商品承压。" },
  },
  aiDebate: {
    bullCase: "全球正处于由开源推理模型驱动的「算力超级周期」初期。AI 硬件供应链瓶颈正在缓解，大规模资本开支将在未来 12-18 个月内转化为实际营收。各国 AI 监管态度正从「遏制」转向「规范引导」，为行业提供清晰合规路径。资金从防御资产向科技成长股迁移，预示新一轮结构性牛市。",
    bearCase: "市场忽视的关键风险：AI 模型边际收益递减而训练成本指数上升。若下一波模型未能实现质变，当前的资本开支热潮可能演变为泡沫。全球数据合规法案集中落地将压缩应用层利润率，地缘政治摩擦可能切断关键算力供应链。一次重大 AI 安全事件或触发全球监管急刹车。",
  },
  industryRadar: [
    { subject: "人工智能/大模型", hotness: 95, sentiment: 0.80, momentum: 12 },
    { subject: "半导芯片/先进制程", hotness: 88, sentiment: 0.60, momentum: 8 },
    { subject: "虚拟资产/区块链", hotness: 70, sentiment: 0.35, momentum: -5 },
    { subject: "新能源车", hotness: 65, sentiment: 0.75, momentum: 3 },
    { subject: "生物医药/医疗AI", hotness: 55, sentiment: 0.50, momentum: -2 },
  ],
  economicForecast: "随着全新推理模型在开源与商业领域的双向爆发，AI 硬件供应链的卡脖子现象预计在下季度得到全面缓解。宏观资金正加速向「硬科技」与「高算力底层」靠拢，整体大盘呈现出由技术突破驱动的局部牛市特征。然而，全球数据合规法案的收紧，将对应用层软件带来短期内的洗牌压力。",
  catalystFactors: [
    "开源推理算法演进 → 催化算力成本腰斩 → 压迫传统云巨头的中间件利润空间",
    "跨境数据法案正式落地 → 大厂合规成本激增 → 倒逼本地化边缘 AI 硬件迎来爆发",
  ],
  aiCalibrationScore: null,
  aiReview: null,
  globalInvestmentRadar: {
    aShare: { under10: [], tier10to50: [], tier50to100: [], over100: [] },
    usShare: { under10: [], tier10to50: [], tier50to100: [], over100: [] },
  },
  macroDivergence: {
    detected: true,
    message: "价格与舆情发生背离",
    detail: "传统媒体情绪持续回暖（0.65），社媒散户情绪低位徘徊（-0.15），价量背离形态预示短期市场波动可能加剧。AI 监测到纳斯达克期货与避险资产同步走强的异常相关性。",
  },
  dynamicSectors: [
    {
      id: "ai_model", name: "AI 大模型",
      status: "应用爆发前夜，算力过热",
      latestNews: [
        "OpenAI 与马耳他政府合作，为所有公民提供免费 ChatGPT Plus 一年",
        "Anthropic 以 15 亿美元和解作者版权诉讼",
        "Roundhill Memory ETF 吸引 2 亿美元零售资金，创纪录",
      ],
      catalyst: "OpenAI 银行集成推动 AI 金融应用落地",
      riskFactor: "arXiv 打击 AI 生成论文引发学术监管收紧",
      investmentVehicles: {
        stocks: [
          { code: "NVDA", name: "英伟达", exposureReason: "全球 AI 算力核心供应商，GPU 数据中心芯片市占率超 80%，直接受益于大模型训练与推理需求爆发。" },
          { code: "0700.HK", name: "腾讯控股", exposureReason: "国内大模型混元主力玩家，微信生态接入 AI 应用场景最广，社交+AI 变现潜力最大。" },
          { code: "BABA", name: "阿里巴巴", exposureReason: "通义千问大模型持续迭代，阿里云 AI 收入增速超 100%，企业级 AI 解决方案领先。" },
        ],
        fundsEtfs: [
          { code: "159998", name: "天弘中证计算机主题ETF", strategyAdvice: "计算机板块与 AI 大模型高度关联，可作为底仓配置，建议逢低定投而非追高。当前板块估值处于历史中位数，若遇回调 10% 以上可加仓。" },
          { code: "513050", name: "易方达中证海外互联ETF", strategyAdvice: "重仓腾讯、阿里等港股 AI 龙头，适合看好中国 AI 应用落地的长期投资者。注意汇率波动和地缘政策风险，建议分批建仓。" },
        ],
      },
    },
    {
      id: "semiconductor", name: "半导芯片",
      status: "地缘风险加剧，产能转移",
      latestNews: [
        "台积电日本子公司一季度首次盈利",
        "Tata Electronics 与 ASML 合作在印度建厂",
        "特朗普称台湾为谈判筹码，140 亿美元军售悬而未决",
      ],
      catalyst: "印度半导体制造落地加速",
      riskFactor: "台湾地缘政治不确定性威胁全球芯片供应链",
      investmentVehicles: {
        stocks: [
          { code: "TSM", name: "台积电", exposureReason: "全球芯片代工绝对龙头，3nm/2nm 制程领先全球，AI 芯片订单饱满，定价权最强。" },
          { code: "ASML", name: "ASML控股", exposureReason: "全球唯一 EUV 光刻机供应商，先进制程扩产刚需，订单排至 2028 年，竞争壁垒极高。" },
        ],
        fundsEtfs: [
          { code: "512480", name: "国联安中证半导体ETF", strategyAdvice: "国内半导体行业代表性 ETF，涵盖设计、制造、封测全产业链。短期受地缘情绪扰动，但国产替代长期逻辑不变，建议采用定投策略摊平成本。" },
        ],
      },
    },
    {
      id: "digital_assets", name: "数字资产",
      status: "监管曙光初现，资金分化",
      latestNews: [
        "比特币 ETF 流出 10 亿美元",
        "企业以太坊储备达 160 亿美元",
        "CLARITY 法案获参议院银行委员会两党支持",
      ],
      catalyst: "CLARITY 法案通过将明确监管框架",
      riskFactor: "KelpDAO 黑客事件暴露 DeFi 操作风险",
      investmentVehicles: {
        stocks: [
          { code: "COIN", name: "Coinbase", exposureReason: "美国最大合规加密交易所，比特币现货 ETF 托管商，监管清晰化后机构资金入场首选通道。" },
          { code: "MSTR", name: "MicroStrategy", exposureReason: "全球最大的上市公司比特币持有者，比特币价格弹性标的，BTC 上涨时杠杆效应显著。" },
        ],
        fundsEtfs: [
          { code: "GBTC", name: "灰度比特币信托", strategyAdvice: "传统投资者间接持有比特币的合规通道，折溢价率波动较大。适合看好比特币长期趋势但不想直接持有加密资产的投资者，建议在折价时买入。" },
        ],
      },
    },
    {
      id: "smart_mobility", name: "智慧出行",
      status: "传统车企退缩，特斯拉提价",
      latestNews: [
        "特斯拉美国 Model Y 两年来首次涨价",
        "斯巴鲁推迟自研电动车至 2028 年后",
        "洛杉矶酒店最低工资 30 美元冲击旅游业",
      ],
      catalyst: "特斯拉涨价可能反映需求韧性",
      riskFactor: "传统车企电动化放缓，充电基建不足",
      investmentVehicles: {
        stocks: [
          { code: "TSLA", name: "特斯拉", exposureReason: "全球新能源车龙头，FSD 自动驾驶技术领先，涨价反映定价权。储能业务第二增长曲线清晰。" },
          { code: "1211.HK", name: "比亚迪", exposureReason: "国内新能源车销量冠军，垂直一体化供应链成本优势明显，海外扩张加速，DM-i 混动技术差异化竞争力强。" },
        ],
        fundsEtfs: [
          { code: "515030", name: "华夏中证新能源汽车ETF", strategyAdvice: "覆盖国内新能源车全产业链龙头。行业价格战加剧可能导致利润率承压，建议关注销量数据拐点后再加大配置。" },
        ],
      },
    },
    {
      id: "biotech", name: "生物医药",
      status: "监管动荡，信心受挫",
      latestNews: [
        "FDA 代理药物中心主任被解雇",
        "美国借贷中心数据泄露影响 12.3 万人",
        "Apeel Sciences 遭 MAHA 网红攻击倒闭",
      ],
      catalyst: "RFK 盟友被解雇可能引发 FDA 政策转向",
      riskFactor: "政治干预 FDA 决策，生物科技审批不确定性增加",
      investmentVehicles: {
        stocks: [
          { code: "UNH", name: "联合健康", exposureReason: "美国最大医疗保险公司，受益于 AI 在医保理赔和健康管理中的效率提升，防御属性强。" },
          { code: "LLY", name: "礼来", exposureReason: "全球市值最高药企，GLP-1 减肥药持续供不应求，AI 辅助药物研发管线丰富。" },
        ],
        fundsEtfs: [
          { code: "512010", name: "易方达沪深300医药卫生ETF", strategyAdvice: "国内医药板块代表性 ETF。当前医药板块估值处于历史低位，集采影响逐步出清，创新药出海逻辑清晰。建议作为长期底仓配置，占比不超过总仓位的 15%。" },
        ],
      },
    },
  ],
  marketBenchmarks: {
    sp500:  { name: '标普 500',  current: 5210.3, change: 0.45, trend24h: [{time:'09:30',price:5180.2},{time:'10:30',price:5170.8},{time:'11:30',price:5160.5},{time:'12:30',price:5190.1},{time:'13:30',price:5200.7},{time:'14:30',price:5210.3}], trend7d: [{time:'05-12',price:5150.2},{time:'05-13',price:5170.8},{time:'05-14',price:5160.5},{time:'05-15',price:5190.1},{time:'05-16',price:5200.7},{time:'05-18',price:5210.3}] },
    nasdaq: { name: '纳斯达克',  current: 16340.5, change: -0.12, trend24h: [{time:'09:30',price:16360.1},{time:'10:30',price:16310.4},{time:'11:30',price:16290.8},{time:'12:30',price:16320.2},{time:'13:30',price:16335.6},{time:'14:30',price:16340.5}], trend7d: [{time:'05-12',price:16280.1},{time:'05-13',price:16310.4},{time:'05-14',price:16290.8},{time:'05-15',price:16320.2},{time:'05-16',price:16335.6},{time:'05-18',price:16340.5}] },
    csi300: { name: '沪深 300',  current: 3650.2, change: 1.25, trend24h: [{time:'09:30',price:3605.8},{time:'09:35',price:3612.3},{time:'09:40',price:3620.6},{time:'09:45',price:3630.1},{time:'09:50',price:3642.5},{time:'09:55',price:3650.2}], trend7d: [{time:'05-12',price:3610.5},{time:'05-13',price:3620.8},{time:'05-14',price:3635.2},{time:'05-15',price:3642.0},{time:'05-16',price:3648.5},{time:'05-18',price:3650.2}] },
    csi500: { name: '中证 500',  current: 5420.8, change: -0.45, trend24h: [{time:'09:30',price:5430.5},{time:'09:35',price:5425.2},{time:'09:38',price:5418.9},{time:'09:42',price:5410.3},{time:'09:48',price:5415.7},{time:'09:52',price:5420.8}], trend7d: [{time:'05-12',price:5445.0},{time:'05-13',price:5438.5},{time:'05-14',price:5425.2},{time:'05-15',price:5418.0},{time:'05-16',price:5415.7},{time:'05-18',price:5420.8}] },
    chinaA50: { name: '富时中国 A50 指数', current: 12350.0, change: 0.85, trend24h: [{time:'09:00',price:12280.5},{time:'09:30',price:12300.2},{time:'10:00',price:12310.8},{time:'10:30',price:12330.4},{time:'11:00',price:12345.6},{time:'11:30',price:12350.0}], trend7d: [{time:'05-12',price:12280.5},{time:'05-13',price:12300.2},{time:'05-14',price:12310.8},{time:'05-15',price:12330.4},{time:'05-16',price:12345.6},{time:'05-18',price:12350.0}] },
    kwetf:    { name: '中概股ETF (KWEB)', current: 32.45, change: -0.32, trend24h: [{time:'09:30',price:32.55},{time:'10:30',price:32.42},{time:'11:30',price:32.30},{time:'12:30',price:32.38},{time:'13:30',price:32.42},{time:'14:30',price:32.45}], trend7d: [{time:'05-12',price:32.55},{time:'05-13',price:32.42},{time:'05-14',price:32.30},{time:'05-15',price:32.38},{time:'05-16',price:32.42},{time:'05-18',price:32.45}] },
  },
  marketRegime: { quadrant: "过热", logic: "AI驱动经济增长强劲，但通胀压力上升，央行政策趋紧，市场估值偏高，符合过热特征。" },
  macroBarometers: {
    crudeOil: {
      name: "原油期货 (CL=F)",
      current: 76.42,
      price: 76.42,
      change: -1.23,
      trend24h: [
        { time: "09:30", price: 77.00 },
        { time: "09:45", price: 76.80 },
        { time: "10:00", price: 76.50 },
        { time: "10:15", price: 76.30 },
        { time: "10:30", price: 76.42 },
      ],
      trend7d: [
        { time: "05-12", price: 77.50 },
        { time: "05-13", price: 76.80 },
        { time: "05-14", price: 76.10 },
        { time: "05-15", price: 76.60 },
        { time: "05-18", price: 76.42 },
      ],
    },
    usdcny: {
      name: "美元 / 离岸人民币 (USDCNY)",
      current: 7.24,
      price: 7.24,
      change: 0.15,
      trend24h: [
        { time: "09:30", price: 7.22 },
        { time: "09:45", price: 7.23 },
        { time: "10:00", price: 7.24 },
        { time: "10:15", price: 7.23 },
        { time: "10:30", price: 7.24 },
      ],
      trend7d: [
        { time: "05-12", price: 7.20 },
        { time: "05-13", price: 7.22 },
        { time: "05-14", price: 7.21 },
        { time: "05-15", price: 7.23 },
        { time: "05-18", price: 7.24 },
      ],
    },
  },
  articles: [
    {
      originalTitle: "Global chipmakers accelerate 2nm fab布局 in North America, supply chain tilts toward AI compute",
      title: "全球半导体巨头加速北美 2nm 工厂布局，供应链全面向算力中心倾斜",
      source: "Bloomberg + Reddit 热门",
      category: "半导芯片",
      url: "https://example.com",
      forensicAnalysis: {
        underlyingFact: "台积电、三星、英特尔三家同步将 2nm 量产时间表前移，表面是为满足 AI 算力需求，实质是争夺下一代制程的全球话语权——谁先实现 2nm 规模量产，谁就将锁定未来五年全球高端芯片代工定价权。",
        transmissionChain: "上游 ASML High-NA EUV 光刻机订单已经排至 2028 年，设备商优先受益；中游晶圆厂资本开支激增将挤压中小设计公司的流片产能配额；下游 AI 芯片设计公司（英伟达、AMD、博通）将因制程迭代获得性能代际跳升，但台积电涨价将侵蚀其毛利率约 2-3 个百分点。",
        chinaMarketMapping: "中国本土 2nm 制程仍落后两代以上，中芯国际 N+3 工艺仅等效于 5nm。此轮制程竞赛将加剧国产芯片设计公司的流片成本劣势，倒逼中国在 Chiplet 异构集成和先进封装赛道加速换道超车。长电科技、通富微电等封测龙头将承接更多国产算力芯片的先进封装需求。",
      },
    },
    {
      originalTitle: "Next-gen decentralized privacy routing protocol passes, Web3 infrastructure faces compliance fine-tuning",
      title: "新一代去中心化隐私路由协议提案通过，虚拟资产基础设施迎合规微调",
      source: "TechCrunch + Crypto subReddit",
      category: "虚拟资产",
      url: "https://example.com",
      forensicAnalysis: {
        underlyingFact: "社区全票通过最新的隐私增强层协议，表面是技术升级，实质是链上基础设施为应对 FATF 最新反洗钱指引所做的防御性合规改造——在不牺牲去中心化核心原则的前提下嵌入可编程合规模块。",
        transmissionChain: "上游隐私计算赛道将获直接利好，ZK-Proof 和全同态加密项目将获得更多集成订单；中游 DeFi 协议需支付额外合规审计费用约 50-100 万美元/年，小型协议将面临出清压力；下游合规化使得传统机构（贝莱德、富达）的 ETF 托管通道更加顺畅。",
        chinaMarketMapping: "香港证监会已于 Q1 发布 STO 通证化框架，此协议升级为香港持牌交易所接入全球 DeFi 流动性提供了合规可行性。对于内地创业者而言，合规隐私技术的需求将在香港 Web3 沙盒中催生新的 B2B 合规技术服务商机会。",
      },
    },
  ],
};

/* ======================================================================
   静态数据常量（历史趋势——优先使用 macro_history.json，无数据时降级）
   ====================================================================== */

const DEFAULT_HISTORY_TREND = [
  { date: "05-11", confidence: 62 },
  { date: "05-12", confidence: 65 },
  { date: "05-13", confidence: 61 },
  { date: "05-14", confidence: 70 },
  { date: "05-15", confidence: 74 },
  { date: "05-16", confidence: 75 },
  { date: "05-17", confidence: 78 },
];

const DEFAULT_SENTIMENT_HISTORY = [
  { date: "05-11", media: 0.45, social: -0.20 },
  { date: "05-12", media: 0.50, social: -0.15 },
  { date: "05-13", media: 0.55, social: -0.10 },
  { date: "05-14", media: 0.60, social: -0.05 },
  { date: "05-15", media: 0.62, social: -0.12 },
  { date: "05-16", media: 0.58, social: -0.18 },
  { date: "05-17", media: 0.65, social: -0.15 },
];

/* 美林投资时钟 4 象限（active 由 data.marketRegime 动态驱动） */
const CLOCK_QUADRANTS = [
  { label: "复苏", desc: "经济增长加快，权益类资产占优" },
  { label: "过热", desc: "通胀压力上升，大宗商品占优" },
  { label: "滞胀", desc: "经济停滞伴通胀，现金为王" },
  { label: "衰退", desc: "经济收缩，债券类资产占优" },
] as const;

/* ======================================================================
   标签页配置
   ====================================================================== */
const TABS = [
  { id: 0, label: "全球雷达总览", sub: "宏观概览" },
  { id: 1, label: "AI 辩证思维", sub: "多空辩论" },
  { id: 2, label: "行业情报流", sub: "情报聚合" },
] as const;

/* ======================================================================
   文字映射表
   ====================================================================== */
const ASSET_LABELS: Record<string, string> = {
  safeHaven: "避险资产",
  techStocks: "科技美股",
  crypto: "加密货币",
  commodities: "大宗商品",
};

/* ---- 相对时间戳格式化 ---- */
function getRelativeTime(publishTimeStr: string): string {
  if (!publishTimeStr) return '';
  const now = Date.now();
  const pub = new Date(publishTimeStr).getTime();
  if (isNaN(pub)) return publishTimeStr;
  const diffMs = now - pub;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const pubDate = new Date(publishTimeStr);
  const nowDate = new Date();
  const isToday = pubDate.getDate() === nowDate.getDate() && pubDate.getMonth() === nowDate.getMonth() && pubDate.getFullYear() === nowDate.getFullYear();
  if (isToday) {
    return `今天 ${String(pubDate.getHours()).padStart(2,'0')}:${String(pubDate.getMinutes()).padStart(2,'0')}`;
  }
  const yesterdayDate = new Date(nowDate.getTime() - 86400000);
  const isYesterday = yesterdayDate.getDate() === pubDate.getDate() && yesterdayDate.getMonth() === pubDate.getMonth() && yesterdayDate.getFullYear() === pubDate.getFullYear();
  if (isYesterday) {
    return `昨天 ${String(pubDate.getHours()).padStart(2,'0')}:${String(pubDate.getMinutes()).padStart(2,'0')}`;
  }
  const month = pubDate.getMonth() + 1;
  const day = pubDate.getDate();
  return `${month}月${day}日 ${String(pubDate.getHours()).padStart(2,'0')}:${String(pubDate.getMinutes()).padStart(2,'0')}`;
}

/* ======================================================================
   辅助渲染组件（定义在 Home 外部，避免水合性能问题）
   ====================================================================== */

/* 多空状态标签（BULL / BEAR / NEUTRAL） */
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; style: string }> = {
    BULL:    { label: "利好", style: "bg-red-50 text-red-600 border-red-100" },
    BEAR:    { label: "利空", style: "bg-emerald-50 text-emerald-600 border-emerald-100" },
    NEUTRAL: { label: "中性", style: "bg-slate-50 text-slate-500 border-slate-200" },
  };
  const entry = map[status] || map.NEUTRAL;
  const icon = status === "BULL" ? "▲" : status === "BEAR" ? "▼" : "—";
  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold border ${entry.style}`}>
      {icon} {entry.label}
    </span>
  );
}

/* 行业动量变化标签 */
function MomentumBadge({ momentum }: { momentum: number }) {
  if (momentum > 0) {
    return <span className="inline-flex items-center gap-0.5 text-red-500 text-sm font-semibold">↑ +{momentum}</span>;
  }
  if (momentum < 0) {
    return <span className="inline-flex items-center gap-0.5 text-emerald-600 text-sm font-semibold">↓ {momentum}</span>;
  }
  return <span className="text-slate-400 text-sm">→ 0</span>;
}

/* 行业断言状态标签（长中文文本，中性样式） */
function SectorBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200 truncate max-w-[180px]">
      {label}
    </span>
  );
}

/* ---- 历史档案数据归一化转换器 ---
   确保所有历史 JSON 格式均被强制映射为 forensicAnalysis 三段论结构，
   彻底消灭 Null 崩溃与纯文本降级。 ---- */
function normalizeArticleData(article: any): any {
  // 已有完整三段论 → 直接放行
  if (
    article.forensicAnalysis?.underlyingFact &&
    article.forensicAnalysis?.transmissionChain &&
    article.forensicAnalysis?.chinaMarketMapping
  ) {
    return article;
  }

  // 兼容旧版 analysis 对象映射
  if (article.analysis && typeof article.analysis === 'object') {
    return {
      ...article,
      forensicAnalysis: {
        underlyingFact: article.analysis.underlyingFact || article.analysis.fact || article.analysis[0] || '暂无底层异动数据。',
        transmissionChain: article.analysis.transmissionChain || article.analysis.chain || article.analysis[1] || '暂无传导链条数据。',
        chinaMarketMapping: article.analysis.chinaMarketMapping || article.analysis.mapping || article.analysis[2] || '暂无本土映射数据。',
      },
    };
  }

  // 纯文本 summary 数组 → 硬性重组三段论
  if (Array.isArray(article.summary) && article.summary.length > 0) {
    const s = article.summary as string[];
    // 检测占位性错误文本（如"数据获取异常""暂无 AI 分析摘要"）
    const hasPlaceholder = s.some(t => /数据获取异常|暂无.*分析摘要/.test(t));
    if (hasPlaceholder) {
      return {
        ...article,
        forensicAnalysis: {
          underlyingFact: s.length >= 1 && !/数据获取异常|暂无.*分析摘要/.test(s[0])
            ? s[0] : '该日新闻尚未经 AI 深度解构，暂无三段论分析。',
          transmissionChain: s.length >= 2 && !/数据获取异常|暂无.*分析摘要/.test(s[1])
            ? s[1] : '历史快照仅收录简讯标题，未包含完整的利益传导链条推演。',
          chinaMarketMapping: s.length >= 3 && !/数据获取异常|暂无.*分析摘要/.test(s[2])
            ? s[2] : '请选择其他已有 AI 细粒度标注的日期，查看完整的本土市场映射分析。',
        },
      };
    }
    return {
      ...article,
      forensicAnalysis: {
        underlyingFact: s[0] || '暂无底层异动数据。',
        transmissionChain: s[1] || s[0] || '暂无传导链条数据。',
        chinaMarketMapping: s[2] || s[s.length - 1] || '暂无本土映射数据。',
      },
    };
  }

  // 纯文本 content 兜底
  if (typeof article.content === 'string' && article.content.trim()) {
    const text = article.content.trim();
    return {
      ...article,
      forensicAnalysis: {
        underlyingFact: text.slice(0, Math.min(text.length, 200)),
        transmissionChain: '原始数据为纯文本格式，AI 未执行三段论解构。',
        chinaMarketMapping: '原始数据为纯文本格式，AI 未执行三段论解构。',
      },
    };
  }

  // 终极兜底
  return {
    ...article,
    forensicAnalysis: {
      underlyingFact: '该条目暂无详细新闻内容。',
      transmissionChain: '该条目暂无详细新闻内容。',
      chinaMarketMapping: '该条目暂无详细新闻内容。',
    },
  };
}

/* ---- 通用新闻卡片组件（实时快讯 + 核心主线档案共用） ---- */
function NewsCard({
  article,
  isExpanded,
  onToggle,
}: {
  article: any;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      className="bg-white border border-neutral-200/40 rounded-2xl transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)] cursor-pointer overflow-hidden"
      onClick={onToggle}
    >
      <div className="p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1">
            <span className="px-2.5 py-0.5 bg-slate-50 border border-slate-100 rounded text-xs font-medium text-slate-500">
              {article.category || article.category}
            </span>
            <span className="text-xs text-slate-500 font-normal">{article.source}</span>
            {article.publishedAt && (
              <span className="text-xs text-neutral-400 font-normal">· {getRelativeTime(article.publishedAt)}</span>
            )}
          </div>
          <h3 className="text-base font-medium text-slate-800 tracking-tight pr-6">{article.title}</h3>
        </div>
        <div className="flex items-center justify-end text-slate-400 shrink-0">
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>
      {isExpanded && (
        <div className="px-4 sm:px-6 pb-6 pt-3 border-t border-slate-50 bg-slate-50/30 space-y-4 animate-fadeIn">
          {article.forensicAnalysis ? (
            <div className="space-y-4">
              <div className="bg-white border border-slate-100 rounded-xl p-4">
                <h4 className="text-sm font-bold text-slate-800 mb-2">【底层异动事实】</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  {article.forensicAnalysis.underlyingFact}
                </p>
              </div>
              <div className="bg-white border border-slate-100 rounded-xl p-4">
                <h4 className="text-sm font-bold text-slate-800 mb-2">【利益传导链条】</h4>
                <p className="text-sm text-slate-600 leading-relaxed font-normal">
                  {article.forensicAnalysis.transmissionChain}
                </p>
              </div>
              <div className="bg-white border border-amber-50 rounded-xl p-4 bg-amber-50/30">
                <h4 className="text-sm font-bold text-amber-800 mb-2">【本土市场映射】</h4>
                <p className="text-sm text-amber-700/80 leading-relaxed font-normal">
                  {article.forensicAnalysis.chinaMarketMapping}
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {(article.summary || []).map((bullet: string, bIdx: number) => (
                <p key={bIdx} className="text-sm text-slate-600 leading-relaxed font-normal">{bullet}</p>
              ))}
            </div>
          )}
          <div className="pt-2">
            <a
              href={article.url}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center space-x-1 text-xs text-slate-500 hover:text-slate-700 transition-colors"
            >
              <span>查看海外媒体英文原文</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

/* 全球六大核心大盘基准迷你走势矩阵 + 常驻宏观仪表盘 */
/* 极致高密分时图 (Intraday Tick Charts) — 红涨绿跌，0%显灰 */
function MarketBenchmarksCards({
  benchmarks,
  chartsReady,
  chartView,
}: {
  benchmarks: typeof DEFAULT_DATA.marketBenchmarks;
  chartsReady: boolean;
  chartView: string;
}) {
  const items = [
    benchmarks.sp500, benchmarks.nasdaq, benchmarks.csi300, benchmarks.csi500,
    benchmarks.chinaA50, benchmarks.kwetf,
  ].filter(Boolean);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-4">
      {items.map((item, idx) => {
        if (!item) return null;
        const chartData = chartView === '7d'
          ? ((item as any).trend7d || []) as { time: string; price: number }[]
          : ((item as any).trend24h || []) as { time: string; price: number }[];
        /* 分时动态对账管道：优先取 change，若为 0 则从趋势线首尾价格计算涨跌幅 */
        let displayChange = (item as any).change ?? 0;
        if ((!displayChange || displayChange === 0) && chartData.length > 1) {
          const firstPrice = chartData[0].price;
          const lastPrice = chartData[chartData.length - 1].price;
          if (firstPrice > 0) displayChange = ((lastPrice - firstPrice) / firstPrice) * 100;
        }
        const isUp = displayChange > 0;
        const isDown = displayChange < 0;
        const isFlat = displayChange === 0;
        const color = isUp ? '#ef4444' : (isDown ? '#10b981' : '#94a3b8');
        const gradId = `benchmark-fill-${idx}`;

        return (
          <div
            key={idx}
            className="bg-white border border-neutral-200/40 rounded-2xl p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]"
          >
            <span className="text-xs text-slate-500 tracking-wide mb-1">{item.name}</span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl font-semibold text-slate-900">
                {item.current.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              </span>
              <span className={`text-sm font-medium ${isUp ? 'text-red-500' : (isDown ? 'text-emerald-600' : 'text-slate-500')}`}>
                {isUp ? '▲' : (isDown ? '▼' : (isFlat ? '—' : '—'))} {isFlat ? '0.00' : `${Math.abs(displayChange).toFixed(2)}%`}
              </span>
            </div>
            <div className="mt-1.5 w-full h-10">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {/* 关闭一切网格线与坐标轴文字 */}
                    <XAxis dataKey="time" hide={chartView !== '7d'} tickLine={false} axisLine={false} stroke="#cbd5e1" fontSize={9} tickMargin={2} interval="preserveStartEnd" />
                    <YAxis hide={true} domain={['dataMin - 5', 'dataMax + 5']} />
                    <Tooltip
                      content={({ payload }) => {
                        const d = payload?.[0]?.payload as { time?: string; price?: number } | undefined;
                        if (d?.time != null && d?.price != null) {
                          return (
                            <div className="bg-white/90 backdrop-blur-sm border border-neutral-200/60 rounded-xl px-3 py-2 text-xs shadow-lg">
                              <div className="text-slate-400 font-medium">{d.time}</div>
                              <div className="text-slate-800 font-bold mt-0.5 tabular-nums">
                                {d.price.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="price"
                      stroke={color}
                      strokeWidth={1.5}
                      fill={`url(#${gradId})`}
                      dot={false}
                      connectNulls={true}
                      activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* 常驻宏观仪表盘：USDCNY 汇率 + 原油期货（双轨防御版 + 迷你分时图） */
function MacroBarometersRow({
  barometers,
  chartsReady,
  chartView,
}: {
  barometers: typeof DEFAULT_DATA.macroBarometers;
  chartsReady: boolean;
  chartView: string;
}) {
  const items = [barometers.usdcny, barometers.crudeOil].filter(Boolean);
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
      {items.map((item, idx) => {
        try {
          if (!item) return null;
          const i = item as any;
          /* 极端刚性空值隔离：无趋势数据直接跳过渲染 */
          if (!i.trend24h && !i.trend7d) return null;
          /* 防御性多周期价格对账 */
          const currentPrice =
            chartView === '7d'
              ? i.current ?? i.trend7d?.[i.trend7d.length - 1]?.price ?? 0
              : i.trend24h?.[i.trend24h.length - 1]?.price ?? i.current ?? 0;
          const name = i.name ?? '';
          const prefix = name.includes('USDCNY') || name.includes('离岸') ? '¥' : '$';
          const chartData = chartView === '7d'
            ? (i.trend7d || []) as { time: string; price: number }[]
            : (i.trend24h || []) as { time: string; price: number }[];
          /* 分时动态对账管道：优先取 change，若为 0 则从趋势线首尾价格计算涨跌幅 */
          let displayChange = i.change ?? 0;
          if ((!displayChange || displayChange === 0) && chartData.length > 1) {
            const firstPrice = chartData[0].price;
            const lastPrice = chartData[chartData.length - 1].price;
            if (firstPrice > 0) displayChange = ((lastPrice - firstPrice) / firstPrice) * 100;
          }
          const isUp = displayChange > 0;
          const isDown = displayChange < 0;
          const color = isUp ? '#ef4444' : (isDown ? '#10b981' : '#94a3b8');
          const gradId = `macro-fill-${idx}`;
          return (
          <div
            key={idx}
            className="bg-white border border-neutral-200/40 rounded-2xl p-5 flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs text-slate-500 tracking-wide">{name}</span>
              <div className="text-xs text-slate-400">{chartView === '7d' ? '7D 趋势' : '24H 分时'}</div>
            </div>
            <div className="flex items-baseline gap-2.5">
              <span className="text-2xl font-semibold text-slate-900">
                {prefix}{currentPrice.toFixed(2)}
              </span>
              <span className={`text-sm font-medium ${isUp ? 'text-red-500' : (isDown ? 'text-emerald-600' : 'text-slate-500')}`}>
                {isUp ? '▲' : (isDown ? '▼' : '—')} {Math.abs(displayChange).toFixed(2)}%
              </span>
            </div>
            <div className="mt-2 w-full h-10">
              {chartsReady && (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity={0.12} />
                        <stop offset="100%" stopColor={color} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide tickLine={false} axisLine={false} />
                    <YAxis hide domain={['dataMin - 1', 'dataMax + 1']} />
                    <Tooltip
                      content={({ payload }) => {
                        const d = payload?.[0]?.payload as { time?: string; price?: number } | undefined;
                        if (d?.time != null && d?.price != null) {
                          return (
                            <div className="bg-white/90 backdrop-blur-sm border border-neutral-200/60 rounded-xl px-3 py-2 text-xs shadow-lg">
                              <div className="text-slate-400 font-medium">{d.time}</div>
                              <div className="text-slate-800 font-bold mt-0.5 tabular-nums">{d.price.toFixed(2)}</div>
                            </div>
                          );
                        }
                        return null;
                      }}
                      cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 3' }}
                    />
                    <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill={`url(#${gradId})`} dot={false} connectNulls activeDot={{ r: 4, fill: color, stroke: '#fff', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        );
      } catch { return null; }
      })}
    </div>
  );
}

/* 美林投资时钟 2×2 象限展示（active 由 data.marketRegime 动态驱动） */
function MerrillLynchClockDisplay({ quadrant: activeLabel }: { quadrant: string }) {
  return (
    <div>
      <span className="text-sm font-semibold text-slate-500 tracking-wider uppercase">美林投资时钟</span>
      <div className="grid grid-cols-2 gap-3 mt-4">
        {CLOCK_QUADRANTS.map((q) => (
          <div
            key={q.label}
            className={`rounded-xl p-4 border transition-all ${
              q.label === activeLabel
                ? "bg-slate-50 border-slate-300 shadow-sm"
                : "bg-neutral-50/30 border-neutral-200/20"
            }`}
          >
            <div className={`text-sm font-semibold ${q.label === activeLabel ? "text-slate-800" : "text-slate-500"}`}>{q.label}</div>
            <div className="text-xs text-slate-500 mt-1 leading-relaxed">{q.desc}</div>
          </div>
        ))}
      </div>
      {(() => {
        const active = CLOCK_QUADRANTS.find(q => q.label === activeLabel);
        return active ? (
          <p className="text-xs text-slate-400 mt-3">
            当前锚定：<span className="font-medium text-slate-600">{active.label}</span> — {active.desc}
          </p>
        ) : null;
      })()}
    </div>
  );
}

/* 系统流动性压力评分 */
function LiquidityStressGauge({ score }: { score: number }) {
  const widthPercent = ((score + 100) / 200) * 100;
  return (
    <div className="mt-5 pt-5 border-t border-neutral-100">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-slate-500">系统流动性压力评分</span>
        <span className={`text-2xl font-bold ${score > 0 ? "text-emerald-600" : "text-slate-800"}`}>
          {score > 0 ? "+" : ""}{score}
        </span>
      </div>
      <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all bg-slate-800"
          style={{ width: `${Math.max(0, Math.min(100, widthPercent))}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-slate-400 mt-1.5">
        <span>-100 极度紧张</span>
        <span>0 中性</span>
        <span>+100 极度充裕</span>
      </div>
    </div>
  );
}

/* 宏观资产映射矩阵 — 无边框 Apple 风格表格 */
function AssetImpactTable({ assets }: { assets: Record<string, { status: string; reason: string }> }) {
  const entries = Object.entries(assets);
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr className="text-xs text-slate-400 uppercase tracking-wider">
          <th className="pb-4 font-medium text-left w-[120px]">资产类别</th>
          <th className="pb-4 font-medium text-left w-[80px]">信号</th>
          <th className="pb-4 font-medium text-left">推演逻辑</th>
        </tr>
      </thead>
      <tbody>
        {entries.map(([key, asset], idx) => (
          <tr key={key} className={idx < entries.length - 1 ? "border-t border-neutral-100" : ""}>
            <td className="py-4 text-sm font-medium text-slate-700">{ASSET_LABELS[key] || key}</td>
            <td className="py-4"><StatusBadge status={asset.status} /></td>
            <td className="py-4 text-sm text-slate-600 leading-relaxed">{asset.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/* 宏观异动背离警示（条件渲染，由上层守卫 detected） */
function MacroDivergenceAlert({ message, detail }: { message: string; detail: string }) {
  return (
    <div className="bg-amber-50/80 border border-amber-200/40 rounded-2xl p-5 flex items-start gap-4">
      <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
      <div>
        <div className="text-sm font-semibold text-amber-800">{message}</div>
        <p className="text-sm text-amber-700/80 leading-relaxed mt-1">{detail}</p>
      </div>
    </div>
  );
}

/* 行业入口便当盒卡片 —— Bento-style entry point with momentum heatmap */
function SectorEntryCard({
  title,
  sector,
  href,
  momentum,
}: {
  title: string;
  sector: { status: string; latestNews: string[] };
  href: string;
  momentum?: number;
}) {
  const heatStyle = momentum != null && momentum !== 0
    ? momentum > 0
      ? { background: `linear-gradient(135deg, rgba(239,68,68,${Math.min(momentum / 120, 0.055)}), rgba(255,255,255,0.95))` }
      : { background: `linear-gradient(135deg, rgba(16,185,129,${Math.min(Math.abs(momentum) / 120, 0.055)}), rgba(255,255,255,0.95))` }
    : {};
  return (
    <Link
      href={href}
      className="block border border-neutral-200/40 rounded-xl sm:rounded-2xl p-3 sm:p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]"
      style={heatStyle}
    >
      <div className="flex items-center justify-between gap-2 sm:gap-3">
        <span className="text-sm sm:text-base font-semibold text-slate-800 truncate">{title}</span>
        <SectorBadge label={sector.status} />
      </div>
      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed line-clamp-2 mt-1 sm:mt-3">
        {sector.latestNews[0]}
      </p>
    </Link>
  );
}

/* ---- v7 投研胜率真理纪实面板（Apple 降噪 + 动能积攒沙漏） ---- */
function CalibrationMatrixChart({ matrix, archiveCount }: { matrix?: Record<string, number> | null; archiveCount: number }) {
  const isDev = typeof window !== 'undefined' && process.env.NODE_ENV === 'development';

  // —— 开发环境模拟回测数据 ——
  const MOCK_CALIBRATION = [
    { name: '宏观\n30日', key: 'mock_macro30d', full: '宏观预测30日胜率', value: 85 },
    { name: '宏观\n90日', key: 'mock_macro90d', full: '宏观预测90日胜率', value: 72 },
    { name: '科技\n板块', key: 'mock_tech', full: '科技板块命中率', value: 82 },
    { name: '生物\n板块', key: 'mock_bio', full: '生物板块命中率', value: 45 },
    { name: '加密\n板块', key: 'mock_crypto', full: '加密板块命中率', value: 68 },
  ];

  const hasRealData = matrix && Object.keys(matrix).length > 0;
  const items = isDev && !hasRealData
    ? MOCK_CALIBRATION
    : hasRealData
      ? [
          { name: '宏观\n30日', key: 'macro30dWin', full: '宏观预测30日胜率' },
          { name: '宏观\n90日', key: 'macro90dWin', full: '宏观预测90日胜率' },
          { name: '科技\n板块', key: 'techSectorHit', full: '科技板块命中率' },
          { name: '生物\n板块', key: 'bioSectorHit', full: '生物板块命中率' },
          { name: '加密\n板块', key: 'cryptoSectorHit', full: '加密板块命中率' },
        ].map(d => ({ ...d, value: Math.round(matrix![d.key] ?? 50) }))
      : [];

  if (items.length === 0) return null;

  const colorMap = (v: number) =>
    v >= 80 ? '#ef4444' : v >= 60 ? '#d97706' : '#64748b';

  return (
    <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
      {/* Title */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-sm font-semibold text-slate-500 tracking-wider uppercase">
          AI 预测中长期胜率量化仪表盘 <span className="text-slate-300 font-normal">Calibration Matrix</span>
        </span>
        <span className="text-xs text-slate-400">数据随每日归档案自动滚动更新</span>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch gap-5 sm:gap-8">
        {/* —— Chart —— */}
        <div className="flex-1 h-64 relative">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={items} margin={{ top: 10, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid stroke="#F1F5F9" strokeDasharray="4 4" vertical={false} />
              <XAxis dataKey="name" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} interval={0} />
              <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} tickFormatter={(v: number) => `${v}%`} />
              <Tooltip
                content={({ payload }) => {
                  const d = payload?.[0]?.payload as typeof items[0] | undefined;
                  if (!d) return null;
                  return (
                    <div className="bg-white/90 backdrop-blur-sm border border-neutral-200/60 rounded-xl px-4 py-3 text-xs shadow-lg">
                      <div className="text-slate-500 mb-1">{d.full}</div>
                      <div className={`text-lg font-bold ${d.value >= 80 ? 'text-red-500' : d.value >= 60 ? 'text-amber-600' : 'text-slate-500'}`}>
                        {d.value}%
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={48}>
                {items.map((d) => (
                  <Cell key={d.key} fill={colorMap(d.value)} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* —— 沙漏常驻保护：动能积攒舱 —— */}
          {archiveCount < 30 && (
            <div className="absolute inset-0 backdrop-blur-[2px] bg-white/60 rounded-2xl flex items-center justify-center z-10">
              <div className="max-w-[220px] text-center space-y-3.5 px-4">
                <div className="w-10 h-10 mx-auto rounded-full bg-amber-50 border border-amber-200/50 flex items-center justify-center">
                  <Hourglass className="w-5 h-5 text-amber-500" />
                </div>
                <p className="text-sm text-slate-600/90 leading-relaxed font-medium">
                  AI 胜率量化矩阵<br/>正在注入动能
                </p>
                <p className="text-xs text-slate-400/90 leading-relaxed">
                  当前已安全对账记卷 <strong className="text-amber-600 font-semibold">{archiveCount}</strong> 天。量化回测需积攒 30 日实体卷宗方可自动激活。
                </p>
                <div className="w-full h-1.5 bg-neutral-200/60 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-400/70 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.min(100, (archiveCount / 30) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-400/80">敬请期待 AI 真实胜率纪实揭晓</p>
              </div>
            </div>
          )}
        </div>

        {/* —— Legend —— */}
        <div className="shrink-0 flex flex-row sm:flex-col items-center sm:items-start gap-4 sm:gap-3 sm:justify-center text-xs">
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-red-400/80" /><span className="text-slate-600">≥80% 机构红</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-amber-500/80" /><span className="text-slate-600">60–79% 琥珀黄</span></div>
          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-sm bg-slate-400/80" /><span className="text-slate-600">&lt;60% 极客灰</span></div>
          <div className="text-slate-400 pt-3 border-t border-slate-100 mt-1">
            数据需 30+ 日档案积累方有效<br/>
            <span className="text-amber-600 font-medium">{archiveCount}/30</span> 天已归档
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---- v7 行业关联度热力矩阵（Apple 暖白奢华美学 + AI 投研指引） ---- */
function IndustryHeatmap({ radar }: { radar: Array<{ subject: string; hotness: number; sentiment: number; momentum: number }> }) {
  const shortName = (s: string) => s.replace(/[\//].*$/, '').slice(0, 6);
  const names = radar.map(r => shortName(r.subject));
  const pairs = radar.flatMap((a, i) =>
    radar.slice(i + 1).map((b, j) => ({
      aIdx: i,
      bIdx: i + 1 + j,
      aName: shortName(a.subject),
      bName: shortName(b.subject),
      correlation: Math.round((1 - Math.abs(a.hotness - b.hotness) / 100) * 100),
      hotnessAvg: Math.round((a.hotness + b.hotness) / 2),
    }))
  );

  const getCellStyle = (corr: number | null, isDiag: boolean) => {
    if (isDiag) return 'bg-transparent border border-dashed border-neutral-200 text-neutral-300';
    if (corr == null) return 'bg-neutral-50 text-neutral-300';
    if (corr >= 85) return 'bg-amber-100/70 border border-amber-200/40 text-amber-700 shadow-[0_1px_3px_rgba(251,191,36,0.08)]';
    if (corr >= 70) return 'bg-amber-50/70 border border-amber-100/40 text-amber-600';
    if (corr >= 50) return 'bg-neutral-100/80 text-neutral-500';
    if (corr >= 30) return 'bg-neutral-50/60 text-neutral-400';
    return 'bg-white text-neutral-300 border border-neutral-100/60';
  };

  // —— AI 破译：流动性共振点 ——
  const sortedPairs = [...pairs].sort((a, b) => b.correlation - a.correlation);
  const topPair = sortedPairs[0];

  // —— AI 破译：防御性孤岛 ——
  const sectorAvgCorr = radar.map((_, idx) => {
    const related = pairs.filter(p => p.aIdx === idx || p.bIdx === idx);
    const avg = related.length > 0 ? related.reduce((s, p) => s + p.correlation, 0) / related.length : 0;
    return { idx, avg, name: shortName(radar[idx].subject), fullName: radar[idx].subject };
  });
  sectorAvgCorr.sort((a, b) => a.avg - b.avg);
  const isolated = sectorAvgCorr.filter(s => s.avg < 30);

  return (
    <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
      {/* Title */}
      <div className="text-sm font-semibold text-slate-500 tracking-wider uppercase mb-2">
        行业流动性关联热力图 <span className="text-slate-300 font-normal">Liquidity Correlation Matrix</span>
      </div>
      <p className="text-xs text-slate-400 mb-6 leading-relaxed">
        基于行业热度差异推导的流动性传导相关性。色温越暖、数字越高，代表资金联动越紧密。
      </p>

      {/* Matrix */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px]" style={{ borderCollapse: 'separate', borderSpacing: '10px' }}>
          <thead>
            <tr>
              <th className="text-xs text-slate-400 font-medium text-left w-12" />
              {names.map((n, i) => (
                <th key={i} className="text-xs text-slate-500 font-medium text-center pb-1 whitespace-nowrap">{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((rowName, rowIdx) => (
              <tr key={rowIdx}>
                <td className="text-xs text-slate-500 font-medium whitespace-nowrap text-right pr-1">{rowName}</td>
                {names.map((_, colIdx) => {
                  const isDiag = rowIdx === colIdx;
                  const pair = pairs.find(
                    p => (p.aIdx === rowIdx && p.bIdx === colIdx) || (p.aIdx === colIdx && p.bIdx === rowIdx)
                  );
                  const corr = isDiag ? null : (pair?.correlation ?? null);
                  const cellStyle = getCellStyle(corr, isDiag);
                  return (
                    <td key={colIdx} className="text-center">
                      <div
                        className={`w-11 h-11 flex items-center justify-center text-[11px] font-medium rounded-xl mx-auto transition-all duration-200 ${cellStyle}`}
                        title={isDiag ? `${rowName}（自相关）` : corr != null ? `${rowName} ↔ ${names[colIdx]}：${corr}%` : '-'}
                      >
                        {isDiag ? '—' : corr != null ? `${corr}` : '-'}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="flex items-center flex-wrap gap-4 mt-6 pt-4 border-t border-neutral-100 text-xs text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-amber-100/70 border border-amber-200/40" /> 强关联 (≥70%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-neutral-100/80" /> 中关联 (50–69%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-neutral-50/60" /> 弱关联 (&lt;50%)</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-md bg-transparent border border-dashed border-neutral-200" /> 自相关</span>
      </div>

      {/* —— AI 流动性级联破译 —— */}
      {(topPair || isolated.length > 0) && (
        <div className="mt-6 pt-5 border-t border-neutral-100 space-y-4">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-amber-500" />
            <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">AI 流动性级联破译</span>
          </div>
          <div className="space-y-3">
            {topPair && topPair.correlation >= 60 && (
              <div className="bg-gradient-to-br from-amber-50/60 to-white border border-amber-200/30 rounded-2xl p-5 shadow-[0_1px_4px_rgba(251,191,36,0.06)]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                  <span className="text-[11px] font-semibold text-amber-700 tracking-wider uppercase">聪明资金共振点</span>
                </div>
                <p className="text-sm text-amber-900/80 leading-relaxed">
                  当前 <strong>{topPair.aName}</strong> 与 <strong>{topPair.bName}</strong> 行业相关性高达 <strong>{topPair.correlation}%</strong>，说明日内增量资金正在顺着产业链发生刚性传导，建议密切关注交叉共振概念。
                </p>
              </div>
            )}
            {isolated.length > 0 && isolated.slice(0, 2).map(s => (
              <div key={s.idx} className="bg-gradient-to-br from-blue-50/50 to-white border border-blue-200/30 rounded-2xl p-5 shadow-[0_1px_4px_rgba(59,130,246,0.06)]">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[11px] font-semibold text-blue-700 tracking-wider uppercase">防御性孤岛</span>
                </div>
                <p className="text-sm text-blue-900/80 leading-relaxed">
                  <strong>{s.fullName}</strong> 目前与其他板块相关性均值仅 <strong>{s.avg.toFixed(0)}%</strong>，呈现完全独立的走势，地缘风险飙升时具备绝佳的避险对冲属性。
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---- v6 蝴蝶效应级联传导树 ---- */
function ButterflyCascadeTree({ factors }: { factors: string[] }) {
  if (!factors || factors.length === 0) return null;

  // 将催化剂因子拆解为节点链
  const chains = factors.map(f =>
    f.split('→').map(s => s.trim()).filter(Boolean)
  );

  return (
    <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
      <div className="text-sm font-semibold text-slate-500 tracking-wider uppercase mb-6">
        利益传导级联网络树 <span className="text-slate-300 font-normal">Butterfly Effect Cascade</span>
      </div>
      <div className="space-y-6">
        {chains.map((chain, ci) => (
          <div key={ci} className="relative">
            {/* 链条序号 */}
            <div className="flex items-center gap-2 mb-3">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center">
                {ci + 1}
              </span>
              <div className="h-px flex-1 bg-gradient-to-r from-slate-200 to-transparent" />
            </div>
            {/* 节点流 - 无生硬线条，用间距与渐变箭头替代 */}
            <div className="flex flex-wrap items-center gap-1.5">
              {chain.map((node, ni) => (
                <React.Fragment key={ni}>
                  {ni > 0 && (
                    <span className="text-slate-300 text-xs font-light mx-0.5">→</span>
                  )}
                  <span
                    className={`inline-block px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                      ni === 0
                        ? 'bg-amber-50 border-amber-200/60 text-amber-700'   // 源头
                        : ni === chain.length - 1
                          ? 'bg-red-50 border-red-200/60 text-red-600'      // 终点
                          : 'bg-slate-50 border-slate-200/60 text-slate-600'  // 中继
                    }`}
                  >
                    {node}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4 mt-5 pt-4 border-t border-slate-100 text-[11px] text-slate-400">
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 初始催化因子</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-400" /> 中继传导</span>
        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> 末端影响</span>
      </div>
    </div>
  );
}

/* ---- v6 行业情报多维过滤器 ---- */
function FilterBar({
  timeRange,
  setTimeRange,
  allTags,
  selectedTags,
  setSelectedTags,
  riskMode,
  setRiskMode,
}: {
  timeRange: string;
  setTimeRange: (v: string) => void;
  allTags: string[];
  selectedTags: string[];
  setSelectedTags: (v: string[]) => void;
  riskMode: string;
  setRiskMode: (v: string) => void;
}) {
  const timeOptions = [
    { value: 'today', label: '今日快讯' },
    { value: '3d', label: '近3日' },
    { value: '7d', label: '近7日' },
  ];

  const toggleTag = (tag: string) => {
    setSelectedTags(
      selectedTags.includes(tag)
        ? selectedTags.filter(t => t !== tag)
        : [...selectedTags, tag]
    );
  };

  return (
    <div className="bg-white border border-neutral-200/40 rounded-2xl p-5 space-y-4">
      {/* 组件 A：时间范围 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase w-14">时间</span>
        <div className="bg-neutral-100/80 rounded-xl p-0.5 inline-flex">
          {timeOptions.map(opt => (
            <button
              key={opt.value}
              onClick={() => setTimeRange(opt.value)}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                timeRange === opt.value
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 组件 B：资产行业标签 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase w-14">行业</span>
        <div className="flex flex-wrap gap-1.5">
          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => toggleTag(tag)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                selectedTags.length === 0 || selectedTags.includes(tag)
                  ? 'bg-slate-50 border-slate-200/60 text-slate-700'
                  : 'bg-transparent border-transparent text-slate-300 hover:text-slate-500'
              }`}
            >
              {tag}
            </button>
          ))}
          {selectedTags.length > 0 && (
            <button
              onClick={() => setSelectedTags([])}
              className="px-2 py-1.5 text-xs text-slate-400 hover:text-slate-600 transition-colors"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* 组件 C：风险偏好胶囊槽 */}
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase w-14">风偏</span>
        <div className="bg-neutral-100/80 rounded-xl p-0.5 inline-flex">
          <button
            onClick={() => setRiskMode('aggressive')}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              riskMode === 'aggressive'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            激进
          </button>
          <button
            onClick={() => setRiskMode('conservative')}
            className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
              riskMode === 'conservative'
                ? 'bg-white text-slate-950 shadow-xs'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            保守
          </button>
        </div>
        {riskMode === 'conservative' && (
          <span className="text-[11px] text-amber-600 bg-amber-50 px-2 py-1 rounded-lg">
            过滤 credibilityScore &lt; 6 及风险标注项
          </span>
        )}
      </div>
    </div>
  );
}

/* ---- AI 真理回测表盘（v4 新增） ---- */
function AICalibrationScoreCard({
  aiCalibrationScore,
  aiReview,
}: {
  aiCalibrationScore?: number | null;
  aiReview?: string | null;
}) {
  if (aiCalibrationScore == null && !aiReview) return null;

  return (
    <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
      <div className="text-sm font-semibold text-slate-500 tracking-wider uppercase mb-5">
        AI 预测真实校准度 <span className="text-slate-300 font-normal">Self-Calibration</span>
      </div>
      <div className="flex flex-col sm:flex-row sm:items-start gap-6">
        <div className="shrink-0 text-center sm:text-left">
          <div
            className="text-7xl sm:text-8xl font-bold bg-gradient-to-br from-slate-800 via-slate-600 to-slate-400 bg-clip-text text-transparent tracking-tight leading-none"
          >
            {aiCalibrationScore != null ? aiCalibrationScore : 'N/A'}
          </div>
          {aiCalibrationScore != null && (
            <span className="text-sm font-medium text-slate-400 mt-1 block">/ 100 校准度评分</span>
          )}
        </div>
        <div className="flex-1 border-t sm:border-t-0 sm:border-l border-neutral-100 sm:pl-8 pt-4 sm:pt-0">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">多空复盘反思</div>
          <p className="text-slate-600 font-normal leading-relaxed text-base">
            {aiReview || '暂无对账复盘数据。'}
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---- 五档操盘军师决策文案 ---- */
function getTradingGuidance(index: number): { icon: string; body: string } {
  if (index <= 20) return {
    icon: "⚠️",
    body: "市场陷入全面非理性恐慌。短线资金不计成本割肉。这往往是买方机构的“黄金左侧伏击圈”。仓位轻者建议停止恐慌，开始启动 7.0 选股舱分批伏击低估高成长标的。"
  };
  if (index <= 40) return {
    icon: "🔍",
    body: "市场信心退潮，多头呈现日内观望（当前状态）。日内资金向核心避险资产和部分高动量主线抱团。短线操盘切忌盲目追高，建议维持中等偏保守仓位，在四档掘金资产中寻找跌出性价比的行业龙头。"
  };
  if (index <= 60) return {
    icon: "⚖️",
    body: "盘面多空交织，方向选择处于拉锯期。增量资金动能不明，建议静默对账，密切关注行业流动性热力图的交叉共振节点，不盲目满仓。"
  };
  if (index <= 80) return {
    icon: "🚀",
    body: "情绪全面回暖，散户与热钱进场抢筹。建议逐步逢高减仓获利了结，止盈位已触发的标的果断分批锁死利润，切忌在人声鼎沸处满仓追涨。"
  };
  return {
    icon: "🚨",
    body: "筹码极度过热，全网情绪指标拉满！随时可能引发高位多头踩踏暴击。买方机构已全面转入防守避险模式，建议死守止损线，拒绝一切新开仓追高诱惑！"
  };
}

/* ---- 恐惧贪婪指数 + 热门主题词云（一体化情绪与热度动量舱） ---- */
function FearGreedGauge({ value, themes }: {
  value: number;
  themes: Array<{ keyword: string; momentumScore: number; trendDirection: string }>;
}) {
  const clamped = Math.max(0, Math.min(100, value));

  /* 五档情绪决策账本 */
  const TIERS = [
    { min: 0,  max: 20, label: "极度恐惧", textColor: "text-red-600",   bgColor: "bg-red-50",   barColor: "bg-red-500",   meaning: "全网割肉暴跌，左侧黄金伏击点" },
    { min: 21, max: 40, label: "恐惧",      textColor: "text-amber-600", bgColor: "bg-amber-50", barColor: "bg-amber-500", meaning: "市场信心不足，资金退潮观望" },
    { min: 41, max: 60, label: "中性",      textColor: "text-slate-600", bgColor: "bg-slate-50", barColor: "bg-slate-500", meaning: "多空交织拉锯，方向不明，建议静默对账" },
    { min: 61, max: 80, label: "贪婪",      textColor: "text-emerald-600",bgColor: "bg-emerald-50",barColor: "bg-emerald-500",meaning: "情绪全面回暖，资金进场抢筹" },
    { min: 81, max: 100,label: "极度贪婪",  textColor: "text-cyan-600",  bgColor: "bg-cyan-50",  barColor: "bg-cyan-500",  meaning: "散户疑狂追高，筹码极度过热，触发高位红色警报" },
  ];

  const activeTier = TIERS.find(t => clamped >= t.min && clamped <= t.max) || TIERS[1];
  const guidance = getTradingGuidance(clamped);

  return (
    <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ---- 左侧：恐惧贪婪仪表盘 + 操盘决策指引 ---- */}
        <div className="flex flex-col justify-center">
          <div className="text-sm font-semibold text-slate-500 tracking-wider uppercase mb-2">{'恐惧贪婪指数'}</div>
          <p className="text-xs text-slate-400 mb-6">Fear & Greed Index</p>

          <div className="flex items-baseline gap-1">
            <span className="font-extrabold text-5xl tracking-tight text-slate-900 tabular-nums">{clamped}</span>
            <span className="text-sm text-slate-400 font-medium">/ 100</span>
          </div>

          <div className="mt-4">
            <span className={`inline-block text-xs font-semibold px-3 py-1 rounded-full ${activeTier.textColor} ${activeTier.bgColor}`}>
              {activeTier.label}
            </span>
          </div>

          {/* 五档量化度量槽（呼吸灯） */}
          <div className="flex items-center gap-2 mt-6 max-w-[260px]">
            {TIERS.map((tier, i) => {
              const isActive = clamped >= tier.min && clamped <= tier.max;
              return (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-full transition-all duration-500 ${isActive ? tier.barColor : 'bg-neutral-100'}`}
                />
              );
            })}
          </div>

          {/* ---- AI 操盘决策指引 ---- */}
          <div className="mt-6 bg-slate-50/80 border border-slate-200/50 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-base">{guidance.icon}</span>
              <span className="text-xs font-bold text-slate-500 tracking-wider uppercase">AI 操盘决策指引</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">
              {guidance.body}
            </p>
          </div>
        </div>

        {/* ---- 右侧：热度动量能量条 ---- */}
        <div className="flex flex-col justify-center">
          <div className="text-sm font-semibold text-slate-500 tracking-wider uppercase mb-2">{'当日异动主题'}</div>
          <p className="text-xs text-slate-400 mb-5">Hot Themes · 动量资金流向</p>

          <div className="flex flex-row sm:flex-col gap-3 overflow-x-auto sm:overflow-x-visible pb-1 sm:pb-0 scrollbar-none">
            {themes && themes.length > 0 ? (
              themes.map((theme, idx) => {
                const isUp = theme.trendDirection === "up";
                const isDown = theme.trendDirection === "down";
                const pct = Math.max(0, Math.min(100, (theme.momentumScore ?? 0) * 10));
                const barColor = isUp ? "bg-rose-500" : isDown ? "bg-emerald-500" : "bg-slate-400";
                const textColor = isUp ? "text-rose-600" : isDown ? "text-emerald-600" : "text-slate-400";
                const arrow = isUp ? "↑" : isDown ? "↓" : "→";
                return (
                  <div
                    key={theme.keyword + idx}
                    className="shrink-0 w-44 sm:w-auto flex flex-col gap-1.5 bg-neutral-50/90 border border-neutral-100/60 hover:bg-neutral-100/80 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 transition-all duration-200"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                        <span className="text-sm font-semibold text-slate-800 truncate">{theme.keyword}</span>
                        <span className={`text-xs font-bold shrink-0 ${textColor}`}>{arrow}</span>
                      </div>
                      <span className={`text-xs font-bold tabular-nums shrink-0 ${textColor}`}>{theme.momentumScore}/10</span>
                    </div>
                    {/* 动量能量条 */}
                    <div className="w-full h-1 sm:h-1.5 bg-neutral-200/60 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="text-xs text-slate-400">{'暂无主题数据'}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================================================================
   页面主体
   ====================================================================== */
export default function Home() {
  /* -------- 状态 -------- */
  const [isMounted, setIsMounted] = useState(false);
  const [chartsReady, setChartsReady] = useState(false);
  const [password, setPassword] = useState("");
  const [isLocked, setIsLocked] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState(0);
  const [expandedArticle, setExpandedArticle] = useState<string | null>(null);
  const [data, setData] = useState(DEFAULT_DATA);
  const [subTab, setSubTab] = useState('flash');
  const [highImpactNews, setHighImpactNews] = useState<any[]>([]);
  const [chartView, setChartView] = useState('24h');

  // 宏观历史时光机
  const [macroHistory, setMacroHistory] = useState<MacroHistoryRecord[]>([]);
  const [historyView, setHistoryView] = useState<'7d' | '60d'>('7d');
  const [selectedDate, setSelectedDate] = useState<string>('');

  // 核心主线档案·历史日历
  const [selectedArchiveDate, setSelectedArchiveDate] = useState<string>('');
  const [archiveArticles, setArchiveArticles] = useState<any[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archiveDateList, setArchiveDateList] = useState<string[]>([]);
  const [archiveCount, setArchiveCount] = useState(0);

  // 蝴蝶效应沙盘
  const [hypothesis, setHypothesis] = useState('');
  const [simulateResult, setSimulateResult] = useState<string | null>(null);
  const [simulateLoading, setSimulateLoading] = useState(false);
  const [simulateError, setSimulateError] = useState<string | null>(null);

  // v6 多维过滤状态
  const [timeRange, setTimeRange] = useState('today');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [riskMode, setRiskMode] = useState('aggressive');

  /* -------- 水合保护 + 数据加载 + SW 版本对账 -------- */
  useEffect(() => {
    setIsMounted(true);
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.onupdatefound = () => {
          const installingWorker = registration.installing;
          if (installingWorker) {
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                window.location.reload();
              }
            };
          }
        };
      });
    }
    (async () => {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const localData = await res.json();
          if (localData && localData.macroMetrics) {
            setData({...DEFAULT_DATA, ...localData});
          }
        }
      } catch {
        // 运行时 fetch 失败时静默降级
      }
    })();
    try {
      const impactNews = require("../data/high_impact_news.json");
      if (Array.isArray(impactNews)) setHighImpactNews(impactNews);
    } catch {}
    try {
      const historyData = require("../data/macro_history.json");
      if (Array.isArray(historyData) && historyData.length > 0) {
        setMacroHistory(historyData);
        const dates = [...new Set(historyData.map((r: MacroHistoryRecord) => r.date))].sort();
        if (dates.length > 0) {
          setSelectedDate(dates[dates.length - 1]);
        }
      }
    } catch {
      // macro_history.json 尚不存在时静默降级
    }
    // 从服务端刚性扫描 history/ 目录，获取真实历史档案日期列表
    (async () => {
      try {
        const res = await fetch('/api/archive-list');
        const dates: string[] = await res.json();
        if (Array.isArray(dates) && dates.length > 0) {
          setArchiveDateList(dates);
          const targetDate = dates[0]; // 已倒序，取最新一份
          setSelectedArchiveDate(targetDate);
          fetchArchiveData(targetDate);
        }
      } catch {
        // /api/archive-list 不可用时静默降级
      }
    })();
    // 获取档案积攒数量
    (async () => {
      try {
        const res = await fetch('/api/archive-count');
        const json = await res.json();
        if (typeof json.count === 'number') setArchiveCount(json.count);
      } catch { /* 静默降级 */ }
    })();
    const savedAuth = localStorage.getItem("radar_auth_passed");
    if (savedAuth === "true") {
      setIsLocked(false);
    }
    requestAnimationFrame(() => setChartsReady(true));
  }, []);

  /* -------- 版本检测自动刷新（GitOps 新数据推送感知）-------- */
  const versionRef = useRef(data.lastUpdated);
  useEffect(() => {
    if (!isMounted) return;
    versionRef.current = data.lastUpdated;
    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/data");
        if (!res.ok) return;
        const fresh = await res.json();
        if (fresh.lastUpdated && fresh.lastUpdated !== versionRef.current) {
          console.log("[版本检测] 检测到新数据，自动刷新...");
          versionRef.current = fresh.lastUpdated;
          window.location.reload();
        }
      } catch {
        // 轮询失败静默
      }
    }, 120000); // 每 2 分钟检查一次
    return () => clearInterval(interval);
  }, [isMounted]);

  /* -------- 时光机日期选择派生数据 -------- */
  const availableDates = [...new Set(macroHistory.map(r => r.date))].sort((a, b) => b.localeCompare(a));
  const selectedRecord = selectedDate
    ? macroHistory.find(r => r.date === selectedDate)
    : null;
  const filteredMacroHistory = selectedDate && selectedRecord
    ? macroHistory.filter(r => r.date <= selectedDate)
    : macroHistory;

  /* -------- 图表数据准备 -------- */

  // 近 7 日信心走势（优先使用 macro_history，不足时降级静态数据）
  const historyTrend = filteredMacroHistory.length > 0
    ? filteredMacroHistory.slice(-7).map(r => ({ date: r.date.slice(5), confidence: r.confidence }))
    : DEFAULT_HISTORY_TREND;

  // 近 7 日舆情走势
  const sentimentHistory = filteredMacroHistory.length > 0
    ? filteredMacroHistory.slice(-7).map(r => ({ date: r.date.slice(5), media: r.mediaSentiment, social: r.socialSentiment }))
    : DEFAULT_SENTIMENT_HISTORY;

  // 60 日宏观历史长线数据
  const macroChartData60d = filteredMacroHistory.length > 0
    ? filteredMacroHistory.map(r => ({ date: r.date.slice(5), confidence: r.confidence, liquidity: r.liquidity }))
    : [];

  const sentimentChartData60d = filteredMacroHistory.length > 0
    ? filteredMacroHistory.map(r => ({ date: r.date.slice(5), media: r.mediaSentiment, social: r.socialSentiment }))
    : [];

  /* -------- 环比变化计算 -------- */
  const displayConfidence = selectedRecord?.confidence ?? data.macroMetrics?.economicConfidence ?? 50;
  const prevConfidence = historyTrend.length >= 2
    ? historyTrend[historyTrend.length - 2].confidence
    : displayConfidence;
  const confidenceChange = displayConfidence - prevConfidence;

  /* -------- 密码解锁 -------- */
  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    const correct = process.env.NEXT_PUBLIC_SITE_PASSWORD || "9999";
    if (password === correct) {
      localStorage.setItem("radar_auth_passed", "true");
      setIsLocked(false);
      setErrorMsg("");
    } else {
      setErrorMsg("口令有误，请重新输入。");
    }
  };

  /* -------- 蝴蝶效应沙盘推演 -------- */
  const handleSimulate = async () => {
    if (!hypothesis.trim()) return;
    setSimulateLoading(true);
    setSimulateResult(null);
    setSimulateError(null);
    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hypothesis: hypothesis.trim() }),
      });
      const body = await res.json();
      if (res.ok) {
        setSimulateResult(body.simulation);
      } else {
        setSimulateError(body.error || '推演服务暂不可用');
      }
    } catch {
      setSimulateError('网络异常，请检查连接后重试');
    } finally {
      setSimulateLoading(false);
    }
  };

  /* -------- 蝴蝶效应按键回车触发 -------- */
  const handleSimulateKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !simulateLoading) {
      handleSimulate();
    }
  };

  /* -------- 核心主线档案·历史数据加载 -------- */
  const fetchArchiveData = async (date: string) => {
    if (!date) return;
    setIsLoadingArchive(true);
    setArchiveError(null);
    setExpandedArticle(null);
    try {
      const res = await fetch(`/api/archive/${date}`);
      if (!res.ok) {
        if (res.status === 404) {
          setArchiveError('该日档案尚未同步或已归档');
        } else {
          setArchiveError('加载历史档案失败');
        }
        setArchiveArticles([]);
        return;
      }
      const body = await res.json();
      const rawArticles = body.articles || [];
      // 通过归一化转换器强行将历史旧格式映射为三段论结构
      const normalized = Array.isArray(rawArticles) ? rawArticles.map(normalizeArticleData) : [];
      setArchiveArticles(normalized);
    } catch {
      setArchiveError('网络异常，无法调取历史卷宗');
      setArchiveArticles([]);
    } finally {
      setIsLoadingArchive(false);
    }
  };

  /* -------- v6 过滤派生数据 -------- */
  const allTags = [...new Set((data.articles ?? []).map((a: any) => a.category).filter(Boolean))] as string[];
  const filterByDate = (articles: any[]) => {
    const now = Date.now();
    const ranges: Record<string, number> = { today: 172800000, '3d': 259200000, '7d': 604800000 };
    const maxAge = ranges[timeRange] || 86400000;
    return articles.filter(a => {
      if (!a.publishedAt) return true;
      return now - new Date(a.publishedAt).getTime() < maxAge;
    });
  };
  const filterByTags = (articles: any[]) => {
    if (selectedTags.length === 0) return articles;
    return articles.filter(a => selectedTags.includes(a.category));
  };
  const filterByRisk = (articles: any[]) => {
    if (riskMode === 'aggressive') return articles;
    return articles.filter((a: any) => {
      const cred = a.credibilityScore;
      const risks = a.riskPoints;
      if (typeof cred === 'number' && cred < 6) return false;
      if (Array.isArray(risks) && (risks.includes('假新闻风险') || risks.includes('严重利益相关'))) return false;
      return true;
    });
  };
  const filteredArticles = filterByRisk(filterByTags(filterByDate(data.articles ?? [])));

  if (!isMounted || !data) {
    return <div suppressHydrationWarning={true}></div>;
  }

  /* ============ 锁定界面 ============ */
  if (isLocked) {
    return (
      <div className="fixed inset-0 bg-[#FBFBFA] flex flex-col items-center justify-center p-6 z-50 select-none">
        <div className="w-full max-w-sm bg-white border border-neutral-200/40 rounded-3xl p-8 text-center">
          <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Lock className="w-5 h-5 text-slate-400" />
          </div>
          <h1 className="text-xl font-medium text-slate-900 tracking-tight mb-2">商情雷达终端已锁定</h1>
          <p className="text-sm text-slate-500 mb-8 leading-relaxed">请输入全栈环境变量配置的访问口令</p>
          <form onSubmit={handleUnlock} className="space-y-4">
            <input
              type="password"
              placeholder="输入访问口令..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-center text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all text-slate-800"
            />
            {errorMsg && <p className="text-xs text-red-400 font-medium">{errorMsg}</p>}
            <button
              type="submit"
              className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-medium transition-all shadow-sm"
            >
              解锁商情站
            </button>
          </form>
        </div>
      </div>
    );
  }

  /* ============ 主界面 ============ */
  const mm = data.macroMetrics ?? { economicConfidence: 50, regulatoryPressure: 50, mediaSentiment: 0, socialSentiment: 0, blackSwanProbability: 0 };
  const dynamicSectors = data.dynamicSectors ?? [];
  const sortedByMomentum = [...(data.industryRadar ?? [])].sort((a, b) => b.momentum - a.momentum);
  const momentumMap = new Map((data.industryRadar ?? []).map((r) => [r.subject, r.momentum]));

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-slate-800 selection:bg-slate-100 font-sans antialiased pb-24" suppressHydrationWarning>
      {/* ---- 全局导航头 ---- */}
      <NavHeader lastUpdated={data.lastUpdated} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-5 sm:mt-10 space-y-5 sm:space-y-8">

        {/* ======== 全球六大核心大盘基准（常驻）+ 周期切换 ======== */}
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-sm font-semibold text-slate-500 tracking-wider uppercase">
            全球六大核心大盘基准
          </h2>
          <div className="bg-neutral-100/80 rounded-xl p-0.5 inline-flex">
            <button
              onClick={() => setChartView('24h')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                chartView === '24h'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              24H 分时
            </button>
            <button
              onClick={() => setChartView('7d')}
              className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                chartView === '7d'
                  ? 'bg-white text-slate-950 shadow-xs'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              7D 趋势
            </button>
          </div>
        </div>
        <MarketBenchmarksCards
          benchmarks={data.marketBenchmarks || DEFAULT_DATA.marketBenchmarks}
          chartsReady={chartsReady}
          chartView={chartView}
        />

        {/* ======== 常驻宏观仪表盘：USDCNY 汇率 + 原油期货 ======= */}
        <MacroBarometersRow
          barometers={data.macroBarometers && Object.keys(data.macroBarometers).length > 0 ? data.macroBarometers : DEFAULT_DATA.macroBarometers}
          chartsReady={chartsReady}
          chartView={chartView}
        />

        {/* ======== 一体化胶囊标签页（iOS 风格 Segmented Control）======= */}
        <div className="w-full overflow-x-auto scrollbar-none">
          <div className="inline-flex bg-neutral-200/40 backdrop-blur-sm rounded-2xl p-1.5 whitespace-nowrap">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setActiveTab(t.id)}
                className={`px-4 sm:px-6 py-2.5 rounded-xl text-sm sm:text-base transition-all ${
                  activeTab === t.id
                    ? "bg-white text-slate-950 font-medium shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {t.label}
                <span className="text-slate-400 text-sm hidden sm:inline"> {t.sub}</span>
              </button>
            ))}
          </div>
        </div>

        {/* ================================================================
            Tab 1：全球雷达总览
            ================================================================ */}
        {activeTab === 0 && (
          <div className="space-y-5 sm:space-y-8">

            {/* —— 1a. 核心图表区：信心指数 + 美林时钟 —— */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-8">
              {/* 左：宏观信心指数面积图 / 60D 时光机 */}
              <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8 flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold text-slate-500 tracking-wider uppercase">宏观经济指标</span>
                      {availableDates.length > 0 && (
                        <div className="relative">
                          <select
                            value={selectedDate || availableDates[0]}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="appearance-none bg-neutral-50 border border-neutral-200/60 rounded-xl px-3 py-1.5 pr-8 text-sm text-slate-700 outline-none cursor-pointer transition-all hover:bg-neutral-100"
                          >
                            {availableDates.map(date => (
                              <option key={date} value={date}>{date}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      )}
                    </div>
                    <div className="flex items-baseline gap-4">
                      <span className="text-4xl sm:text-5xl font-bold text-slate-900 tracking-tight">{displayConfidence}</span>
                      <div>
                        <span className="text-base font-medium text-slate-500">/ 100 宏观信心指数</span>
                        <div className="text-sm text-red-500 font-medium mt-0.5">
                          <TrendingUp className="w-3.5 h-3.5 inline -mt-0.5 mr-0.5" />
                          {confidenceChange > 0 ? "+" : ""}{confidenceChange.toFixed(0)} 较昨日
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* 历史视图切换 */}
                  {macroHistory.length >= 2 && (
                    <div className="flex bg-slate-50 border border-slate-100 rounded-lg p-0.5 text-xs">
                      <button
                        onClick={() => setHistoryView('7d')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                          historyView === '7d' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        近 7 日
                      </button>
                      <button
                        onClick={() => setHistoryView('60d')}
                        className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                          historyView === '60d' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        60 日历史
                      </button>
                    </div>
                  )}
                </div>

                {/* 近 7 日信心走势 */}
                {historyView === '7d' && (
                  <div className="flex-1 w-full">
                    {chartsReady && (
                      <div className="min-h-[200px] sm:min-h-0">
                      <ResponsiveContainer width="100%" aspect={16 / 3.5} minWidth={0}>
                        <AreaChart data={historyTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorConfidence" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0f172a" stopOpacity={0.03} />
                              <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#F1F5F9" strokeDasharray="4 4" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              background: "#fff",
                              border: "1px solid #f1f5f9",
                              borderRadius: "12px",
                              fontSize: "13px",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                            }}
                          />
                          <Area
                            name="信心指数"
                            type="monotone"
                            dataKey="confidence"
                            stroke="#334155"
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#colorConfidence)"
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                    )}
                  </div>
                )}

                {/* 60 日宏观历史长线趋势图 */}
                {historyView === '60d' && (
                  <div className="flex-1 w-full">
                    {chartsReady && macroChartData60d.length > 0 && (
                      <div className="min-h-[200px] sm:min-h-0">
                      <ResponsiveContainer width="100%" aspect={16 / 3.5} minWidth={0}>
                        <LineChart data={macroChartData60d} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="color60dConfidence" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#0f172a" stopOpacity={0.06} />
                              <stop offset="95%" stopColor="#0f172a" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="#F1F5F9" strokeDasharray="4 4" />
                          <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} minTickGap={20} />
                          <YAxis domain={[0, 100]} tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                          <Tooltip
                            contentStyle={{
                              background: "#fff",
                              border: "1px solid #f1f5f9",
                              borderRadius: "12px",
                              fontSize: "13px",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                            }}
                          />
                          <Legend
                            wrapperStyle={{ fontSize: "12px", color: "#94a3b8", paddingTop: "4px" }}
                          />
                          <Area
                            name="宏观信心"
                            type="monotone"
                            dataKey="confidence"
                            stroke="#334155"
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#color60dConfidence)"
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                          <Line
                            name="流动性评分"
                            type="monotone"
                            dataKey="liquidity"
                            stroke="#d97706"
                            strokeWidth={1.5}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 0 }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                    )}
                    {macroChartData60d.length === 0 && (
                      <div className="flex items-center justify-center h-32 text-sm text-slate-400">
                        暂无 60 日历史数据，请确保 pipeline 已至少运行两次。
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* 右：美林投资时钟 + 流动性压力 */}
              <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8 flex flex-col">
                <MerrillLynchClockDisplay quadrant={selectedRecord?.regime || data.marketRegime?.quadrant || "过热"} />
                <LiquidityStressGauge score={selectedRecord?.liquidity ?? (() => {
                  const mm = data.macroMetrics ?? { economicConfidence: 50, regulatoryPressure: 50, blackSwanProbability: 0 };
                  return Math.round(Math.max(-100, Math.min(100, mm.economicConfidence - 50 - mm.regulatoryPressure * 0.4 - mm.blackSwanProbability * 0.2)));
                })()} />
              </div>
            </div>

            {/* —— 1b. 情绪与热度动量舱 —— */}
            <FearGreedGauge
              value={(data as any).marketSentimentTracker?.fearGreedIndex ?? 50}
              themes={(data as any).marketSentimentTracker?.hotThemes ?? []}
            />

            {/* —— 1c. 舆情背离双线图 —— */}
            <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8">
              <div className="flex items-center justify-between mb-5">
                <span className="text-sm font-semibold text-slate-500 tracking-wider uppercase">
                  舆情背离指数
                </span>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-slate-700 rounded-full" /> 传统媒体情绪
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2.5 h-0.5 bg-amber-500 rounded-full" /> 社媒散户情绪
                  </span>
                </div>
              </div>
              <p className="text-sm text-slate-500 mb-5 leading-relaxed">
                媒体理性叙事与散户情绪的量化背离。差值扩大往往预示短期波动或趋势反转。
              </p>
              <div className="w-full">
                {chartsReady && (
                  <div className="min-h-[200px] sm:min-h-0">
                  <ResponsiveContainer width="100%" aspect={16 / 3.5} minWidth={0}>
                    <LineChart data={sentimentHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#F1F5F9" strokeDasharray="4 4" />
                      <XAxis dataKey="date" tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                      <YAxis domain={[-0.5, 1.0]} tickLine={false} axisLine={false} stroke="#94a3b8" fontSize={11} />
                      <Tooltip
                        contentStyle={{
                          background: "#fff",
                          border: "1px solid #f1f5f9",
                          borderRadius: "12px",
                          fontSize: "13px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                        }}
                      />
                      <Line
                        name="传统媒体"
                        type="monotone"
                        dataKey="media"
                        stroke="#334155"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                      <Line
                        name="社媒散户"
                        type="monotone"
                        dataKey="social"
                        stroke="#d97706"
                        strokeWidth={1.5}
                        dot={false}
                        activeDot={{ r: 4, strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* —— 1f. AI 真理回测表盘（v4 里程碑） —— */}
            <AICalibrationScoreCard
              aiCalibrationScore={(data as any).aiCalibrationScore}
              aiReview={(data as any).aiReview}
            />

            {/* —— 1g. v6 AI 预测中长期胜率量化仪表盘 —— */}
            <CalibrationMatrixChart matrix={(data as any).calibrationMatrix} archiveCount={archiveCount} />

            {/* —— 1d. 宏观资产映射矩阵（无边框 Apple 风格表格） —— */}
            <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8">
              <span className="text-sm font-semibold text-slate-500 tracking-wider uppercase">宏观资产映射矩阵</span>
              <div className="mt-6">
                <AssetImpactTable assets={data.assetImpact ?? {}} />
              </div>
            </div>

            {/* —— 1e. 底部指标卡：监管压力 + 市场情绪（移动端: 全宽进度条 + 大数值） —— */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-8">
              <div className="bg-neutral-50/50 border border-neutral-200/40 rounded-2xl p-4 sm:p-7 flex items-start sm:items-center space-x-4 sm:space-x-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
                <div className="p-3 sm:p-4 bg-amber-50 text-amber-600 rounded-xl shrink-0"><AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-slate-500">全球政策监管压力等级</div>
                  <div className="text-3xl sm:text-2xl font-bold text-slate-800 mt-1">
                    {mm.regulatoryPressure} <span className="text-base text-slate-500 font-normal">/ 100</span>
                  </div>
                  <div className="mt-2 sm:mt-3 w-full h-2 sm:h-1.5 bg-neutral-200/60 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-400/80 rounded-full transition-all" style={{ width: `${mm.regulatoryPressure}%` }} />
                  </div>
                </div>
              </div>
              <div className="bg-neutral-50/50 border border-neutral-200/40 rounded-2xl p-4 sm:p-7 flex items-start sm:items-center space-x-4 sm:space-x-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
                <div className="p-3 sm:p-4 bg-slate-50 text-slate-600 rounded-xl shrink-0"><TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" /></div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs sm:text-sm font-medium text-slate-500">大盘多空情绪合成</div>
                  <div className="text-base sm:text-2xl font-bold text-slate-800 mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span>{mm.mediaSentiment > 0 ? "+" : ""}{mm.mediaSentiment} <span className="text-xs sm:text-base text-slate-400 font-normal">媒体</span></span>
                    <span className="text-slate-300 hidden sm:inline">/</span>
                    <span>{mm.socialSentiment > 0 ? "+" : ""}{mm.socialSentiment} <span className="text-xs sm:text-base text-slate-400 font-normal">社媒</span></span>
                  </div>
                  {/* 双轨情绪进度条：媒体 vs 社媒 */}
                  <div className="mt-2 sm:mt-3 space-y-1.5">
                    <div className="w-full h-1.5 sm:h-1 bg-neutral-200/60 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-600/70 rounded-full transition-all" style={{ width: `${((mm.mediaSentiment + 1) / 2) * 100}%` }} />
                    </div>
                    <div className="w-full h-1.5 sm:h-1 bg-neutral-200/60 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500/70 rounded-full transition-all" style={{ width: `${((mm.socialSentiment + 1) / 2) * 100}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            Tab 2：AI 辩证思维
            ================================================================ */}
        {activeTab === 1 && (
          <div className="space-y-5 sm:space-y-8">
            {/* —— 2a. 宏观异动背离警示（条件渲染） —— */}
            {data.macroDivergence?.detected && data.macroDivergence && (
              <MacroDivergenceAlert message={data.macroDivergence.message} detail={data.macroDivergence.detail} />
            )}

            {/* —— 2b. 多空双轨辩证 —— */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-8">
              {/* 多方乐观推演 */}
              <div className="bg-white border border-neutral-200/40 rounded-3xl p-10 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
                <div className="absolute top-0 left-0 w-1 h-full bg-emerald-400/40" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-emerald-50 border border-emerald-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">多方乐观推演</h3>
                    <p className="text-xs text-slate-500 tracking-widest uppercase">多方推演</p>
                  </div>
                </div>
                <p className="text-slate-600 text-base leading-loose tracking-wide font-normal text-justify">
                  {(data.aiDebate ?? { bullCase: "", bearCase: "" }).bullCase}
                </p>
              </div>

              {/* 空方悲观警示 */}
              <div className="bg-white border border-neutral-200/40 rounded-3xl p-10 relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-400/40" />
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-8 h-8 bg-red-50 border border-red-100 rounded-lg flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">空方悲观警示</h3>
                    <p className="text-xs text-slate-500 tracking-widest uppercase">空方警示</p>
                  </div>
                </div>
                <p className="text-slate-600 text-base leading-loose tracking-wide font-normal text-justify">
                  {(data.aiDebate ?? { bullCase: "", bearCase: "" }).bearCase}
                </p>
              </div>
            </div>

            {/* —— 2c. 黑天鹅概率进度条 —— */}
            <div className="bg-neutral-50/50 border border-neutral-200/40 rounded-2xl p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <Brain className="w-5 h-5 text-slate-400" />
                  <span className="text-sm font-medium text-slate-500">今日全球黑天鹅触发概率</span>
                </div>
                <span
                  className={`text-3xl font-bold ${
                    mm.blackSwanProbability >= 60 ? "text-red-500" :
                    mm.blackSwanProbability >= 30 ? "text-amber-500" : "text-emerald-500"
                  }`}
                >
                  {mm.blackSwanProbability}%
                </span>
              </div>
              <div className="w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ease-out ${
                    mm.blackSwanProbability >= 60 ? "bg-red-400" :
                    mm.blackSwanProbability >= 30 ? "bg-amber-400" : "bg-emerald-400"
                  }`}
                  style={{ width: `${mm.blackSwanProbability}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-3">
                {mm.blackSwanProbability >= 60
                  ? "⚠ 高警戒：市场面临显著尾部风险，建议对冲仓位"
                  : mm.blackSwanProbability >= 30
                  ? "中等警戒：关注地缘政治与流动性拐点信号"
                  : "低警戒：尾部风险可控，系统性冲击概率较低"}
              </p>
            </div>

            {/* —— v6 行业关联度热力矩阵 —— */}
            <IndustryHeatmap radar={data.industryRadar ?? []} />

            {/* —— v6 蝴蝶效应级联传导树 —— */}
            <ButterflyCascadeTree factors={data.catalystFactors ?? []} />

            {/* —— 2d. 宏观黑天鹅沙盘模拟舱 —— */}
            <div className="bg-white border border-neutral-200/40 rounded-3xl p-5 sm:p-8 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
              <div className="flex items-center gap-3 mb-1">
                <Sparkles className="w-5 h-5 text-slate-400" />
                <h2 className="text-base font-semibold text-slate-800">宏观黑天鹅沙盘模拟舱</h2>
              </div>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed ml-8">
                输入任意宏观假设事件，AI 将基于真实市场数据推演因果链对美债、科技股、A 股的直接冲击
              </p>

              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="输入任意宏观假设事件（如：地缘冲突突发恶化 / 某半导体巨头财报爆雷）..."
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  onKeyDown={handleSimulateKeyDown}
                  className="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all text-slate-800 placeholder:text-slate-400"
                />
                <button
                  onClick={handleSimulate}
                  disabled={simulateLoading || !hypothesis.trim()}
                  className="px-6 py-3 bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2 shrink-0"
                >
                  {simulateLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="text-white/80">推演中...</span>
                    </>
                  ) : (
                    '启动推演'
                  )}
                </button>
              </div>

              {/* 推演结果展示 */}
              {simulateLoading && (
                <div className="mt-6 p-5 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="animate-pulse space-y-3">
                    <div className="h-4 bg-slate-200 rounded w-full" />
                    <div className="h-4 bg-slate-200 rounded w-5/6" />
                    <div className="h-4 bg-slate-200 rounded w-4/6" />
                  </div>
                </div>
              )}

              {simulateResult && !simulateLoading && (
                <div className="mt-6 p-6 bg-slate-50 border border-slate-100 rounded-xl">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">DeepSeek V4 蝴蝶效应推演</span>
                  </div>
                  <p className="text-slate-700 text-base leading-loose tracking-wide font-normal">
                    {simulateResult}
                  </p>
                </div>
              )}

              {simulateError && !simulateLoading && (
                <div className="mt-6 p-5 bg-red-50 border border-red-100 rounded-xl">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-semibold text-red-500 tracking-wider uppercase">推验异常</span>
                  </div>
                  <p className="text-sm text-red-600">{simulateError}</p>
                </div>
              )}
            </div>

            {/* —— 2e. 宏观趋势推演 + 催化剂 —— */}
            <div className="bg-white border border-neutral-200/40 rounded-3xl p-10 space-y-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
              <div>
                <h2 className="text-xl font-medium text-slate-800 tracking-tight">AI 宏观趋势推演与大盘断言</h2>
                <div className="w-10 h-0.5 bg-slate-800 mt-3" />
              </div>
              <p className="text-slate-600 text-base leading-8 tracking-wide font-normal text-justify">
                {data.economicForecast ?? ""}
              </p>
              <div className="border-t border-slate-100 pt-6 space-y-4">
                <div className="text-sm font-semibold text-slate-500 uppercase tracking-wider">跨行业联动蝴蝶效应</div>
                <ul className="space-y-3">
                  {(data.catalystFactors ?? []).map((factor, index) => (
                    <li key={index} className="flex items-start text-sm text-slate-600 leading-relaxed">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mt-1.5 mr-2 shrink-0" />
                      {factor}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================
            Tab 3：行业情报流
            ================================================================ */}
        {activeTab === 2 && (
          <div className="space-y-5 sm:space-y-8">

            {/* —— 3a. 行业深度解读（dynamicSectors 动态卡片矩阵） —— */}
            {dynamicSectors && dynamicSectors.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-lg font-semibold tracking-tight text-slate-800">行业深度解读</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 divide-y sm:divide-y-0 divide-neutral-100 [&>*]:pb-3 sm:[&>*]:pb-0">
                  {dynamicSectors.map((sector) => (
                    <SectorEntryCard
                      key={sector.id}
                      title={sector.name}
                      sector={sector}
                      href={`/sector/${sector.id}`}
                      momentum={momentumMap.get(sector.name)}
                    />
                  ))}
                </div>
              </div>
            )}

{/* —— v6 多维全状态交叉过滤器 —— */}
            <FilterBar
              timeRange={timeRange}
              setTimeRange={setTimeRange}
              allTags={allTags}
              selectedTags={selectedTags}
              setSelectedTags={setSelectedTags}
              riskMode={riskMode}
              setRiskMode={setRiskMode}
            />

{/* —— 3b. 全球情报瀑布流 + 行业动量侧边栏 —— */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 sm:gap-8">
              {/* 新闻瀑布流（占 3 列） */}
              <div className="lg:col-span-3 space-y-5">
                <div className="flex items-center justify-between pl-2">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-800">全球泛行业关键情报流</h2>
                  <span className="text-sm text-slate-500">点击卡片查看完整深度研报</span>
                </div>
                {/* 二级内嵌胶囊控制槽 + 档案日历日期切换（右侧平滑淡入淡出） */}
                <div className="flex items-center justify-between">
                  <div className="bg-neutral-100/80 rounded-xl p-0.5 inline-flex self-start">
                    <button
                      onClick={() => { setSubTab('flash'); setExpandedArticle(null); }}
                      className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        subTab === 'flash'
                          ? 'bg-white text-slate-950 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      实时闪电快讯
                    </button>
                    <button
                      onClick={() => { setSubTab('anchor'); setExpandedArticle(null); }}
                      className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        subTab === 'anchor'
                          ? 'bg-white text-slate-950 shadow-xs'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      核心主线档案
                    </button>
                  </div>
                  {/* 档案日期切换槽 —— 仅在核心主线档案子板块时平滑淡入 */}
                  <div className={`transition-all duration-300 ease-out ${
                    subTab === 'anchor'
                      ? 'opacity-100 translate-x-0'
                      : 'opacity-0 translate-x-2 pointer-events-none'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 font-medium">档案日期</span>
                      {archiveDateList.length > 0 ? (
                        <div className="relative">
                          <select
                            value={selectedArchiveDate || archiveDateList[archiveDateList.length - 1]}
                            onChange={(e) => {
                              const newDate = e.target.value;
                              setSelectedArchiveDate(newDate);
                              setExpandedArticle(null);
                              fetchArchiveData(newDate);
                            }}
                            className="appearance-none bg-white border border-neutral-200/60 rounded-xl px-4 py-2 pr-9 text-sm text-slate-700 outline-none cursor-pointer transition-all hover:bg-neutral-50 focus:ring-1 focus:ring-slate-300 min-w-[140px]"
                          >
                            {archiveDateList.map(date => (
                              <option key={date} value={date}>{date}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">暂无历史档案</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  {/* ----- 实时闪电快讯 ----- */}
                  {subTab === 'flash' && filteredArticles.map((article, idx) => {
                    const key = (article as any).url || `flash-${idx}`;
                    const isExpanded = expandedArticle === key;
                    return (
                      <NewsCard
                        key={key}
                        article={article}
                        isExpanded={isExpanded}
                        onToggle={() => setExpandedArticle(isExpanded ? null : key)}
                      />
                    );
                  })}

                  {/* ----- 核心主线档案（历史日历查询） ----- */}
                  {subTab === 'anchor' && (
                    <div className="space-y-4">

                      {/* 加载动效 */}
                      {isLoadingArchive && (
                        <div className="bg-neutral-50/50 border border-neutral-200/40 rounded-2xl p-12 text-center">
                          <p className="text-base text-slate-500 animate-pulse">⏳ 正在调取历史卷宗...</p>
                        </div>
                      )}

                      {/* 异常捕获 */}
                      {archiveError && !isLoadingArchive && (
                        <div className="bg-amber-50/80 border border-amber-200/40 rounded-2xl p-8 text-center">
                          <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-3" />
                          <p className="text-sm text-amber-700 font-medium">{archiveError}</p>
                          <p className="text-xs text-amber-500/70 mt-2">该日档案尚未同步或已归档，请选择其他日期。</p>
                        </div>
                      )}

                      {/* 空数据 */}
                      {!isLoadingArchive && !archiveError && archiveArticles.length === 0 && (
                        <div className="bg-white border border-neutral-200/40 rounded-2xl p-12 text-center">
                          <p className="text-sm text-slate-400">该日期暂无历史档案数据</p>
                        </div>
                      )}

                      {/* 档案新闻列表（与实时快讯完全相同的 NewsCard 组件） */}
                      {!isLoadingArchive && !archiveError && archiveArticles.map((article, idx) => {
                        const key = article.url || `archive-${idx}`;
                        const isExpanded = expandedArticle === key;
                        return (
                          <NewsCard
                            key={key}
                            article={article}
                            isExpanded={isExpanded}
                            onToggle={() => setExpandedArticle(isExpanded ? null : key)}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* 行业热度动量爆发榜（占 1 列） */}
              <div className="lg:col-span-1">
                <div className="bg-white border border-neutral-200/40 rounded-2xl p-6 sticky top-24 transition-all duration-300 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
                  <h3 className="text-sm font-semibold text-slate-500 tracking-wider uppercase mb-5">
                    行业热度动量爆发榜
                  </h3>
                  <div className="space-y-4">
                    {sortedByMomentum.map((item, idx) => {
                      const rankColors = ["text-slate-800", "text-slate-500", "text-slate-400", "text-slate-300", "text-slate-300"];
                      return (
                        <div key={item.subject} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span className={`text-xs font-mono font-semibold ${rankColors[idx] || "text-slate-300"}`}>
                              {String(idx + 1).padStart(2, "0")}
                            </span>
                            <span className="text-sm text-slate-600">{item.subject}</span>
                          </div>
                          <MomentumBadge momentum={item.momentum} />
                        </div>
                      );
                    })}
                  </div>
                  <div className="border-t border-slate-100 mt-5 pt-4 text-xs text-slate-500 leading-relaxed">
                    基于 24 小时全球新闻声量与社交讨论热度的动量变化率量化排序。
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
