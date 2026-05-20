"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lock, Sparkles, TrendingUp } from "lucide-react";
import NavHeader from "../../components/NavHeader";

/* ======================================================================
   类型定义 — 与 latest.json 扁平池刚性对齐
   ====================================================================== */

interface Stock {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  trailingPE: number | null;
  buyZone: string;
  takeProfit: string;
  stopLoss: string;
  reason: string;
  dynamicReason?: string;
}

interface GlobalRadar {
  aSharePool: Stock[];
  usSharePool: Stock[];
}

/* ======================================================================
   默认数据
   ====================================================================== */

const DEFAULT_RADAR: GlobalRadar = { aSharePool: [], usSharePool: [] };

/* ======================================================================
   静态配置 — 市场 + 纯前端价格数学分档（不再依赖 AI 死分类）
   ====================================================================== */

const MARKETS = [
  { key: "aShare" as const, label: "中国 A 股市场" },
  { key: "usShare" as const, label: "美国美股市场" },
];

const TIERS = [
  { key: "under5" as const, label: "5元以下", sub: "绝对低价" },
  { key: "tier5to15" as const, label: "5 - 15", sub: "轻资产" },
  { key: "tier15to50" as const, label: "15 - 50", sub: "中流砥柱" },
  { key: "tier50to200" as const, label: "50 - 200", sub: "高端成长" },
  { key: "over200" as const, label: "200以上", sub: "核心资产" },
];

type TierKey = (typeof TIERS)[number]["key"];

/* ----- 纯前端根据对账后真实 price 进行数学分档 ----- */
/* ----- 多市场主权货币对账：A 股 ¥ / 美股 $ ----- */
function isACode(code: string): boolean {
  return /\.(SZ|SS|SH)$/i.test(code);
}

function fmtValue(val: string | number | null | undefined, code: string): string {
  if (val == null || val === '--' || val === '') return '--';
  const sym = isACode(code) ? '¥' : '$';
  if (typeof val === 'number') return `${sym}${val.toFixed(2)}`;
  // 处理区间字符串如 "3.5-4.2" → "¥3.5-¥4.2"
  return String(val).replace(/(\d+\.?\d*)/g, (m) => `${sym}${m}`);
}

function filterByTier(stocks: Stock[], tierKey: TierKey): Stock[] {
  return stocks.filter((s) => {
    // 无有效价格的标的不流入任何档位，避免扎堆 10-50
    if (s.price == null || s.price <= 0) return false;
    if (s.price < 5) return tierKey === "under5";
    if (s.price < 15) return tierKey === "tier5to15";
    if (s.price < 50) return tierKey === "tier15to50";
    if (s.price < 200) return tierKey === "tier50to200";
    return tierKey === "over200";
  });
}

/* ======================================================================
   StockCard — 零门禁：直接从 item.price / item.trailingPE 消费
   ====================================================================== */

function StockCard({ stock }: { stock: Stock }) {
  const hasPrice = stock.price != null && stock.price > 0;
  const rawChange = stock.changePercent;
  const isUp = rawChange != null && rawChange > 0;
  const isDown = rawChange != null && rawChange < 0;

  return (
    <div className="bg-white border border-neutral-200/40 rounded-2xl p-6 space-y-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.025)]">
      {/* 顶部：名称 + 代码 + 实时股价 + 涨跌幅 */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-lg font-semibold text-slate-900">{stock.name}</span>
          <span className="ml-2 text-sm text-slate-400 font-mono">{stock.code}</span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900 tabular-nums">
            {hasPrice ? fmtValue(stock.price!, stock.code) : "--"}
          </div>
          {rawChange != null && (
            <div
              className={`text-sm font-medium tabular-nums ${
                isUp ? "text-red-500" : isDown ? "text-emerald-600" : "text-slate-500"
              }`}
            >
              {isUp ? "▲" : isDown ? "▼" : "—"} {Math.abs(rawChange).toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* 核心腹地：建仓 / 止盈 / 止损 / 市盈率 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-amber-50/60 rounded-xl p-3 text-center">
          <div className="text-xs text-amber-600/70 font-medium mb-0.5">建议建仓价</div>
          <div className="text-base font-semibold text-amber-700">{fmtValue(stock.buyZone, stock.code)}</div>
        </div>
        <div className="bg-red-50/60 rounded-xl p-3 text-center">
          <div className="text-xs text-red-500/70 font-medium mb-0.5">目标止盈价</div>
          <div className="text-base font-semibold text-red-500">{fmtValue(stock.takeProfit, stock.code)}</div>
        </div>
        <div className="bg-emerald-50/60 rounded-xl p-3 text-center">
          <div className="text-xs text-emerald-600/70 font-medium mb-0.5">防御止损价</div>
          <div className="text-base font-semibold text-emerald-600">{fmtValue(stock.stopLoss, stock.code)}</div>
        </div>
        <div className="bg-slate-50 rounded-xl p-3 text-center">
          <div className="text-xs text-slate-400 font-medium mb-0.5">动态市盈率</div>
          <div className="text-base font-semibold text-slate-700">
            {stock.trailingPE != null ? `${stock.trailingPE.toFixed(1)}x` : "--"}
          </div>
        </div>
      </div>

      {/* DeepSeek 独家技术壁垒与供应链价值拆解 / 动态入选理由 */}
      {stock.reason && (
        <div className="space-y-1">
          {stock.dynamicReason && (
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="text-[10px] font-semibold text-indigo-500 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full">AI 动态入选</span>
            </div>
          )}
          <p className="text-base text-slate-800 leading-relaxed">{stock.reason}</p>
        </div>
      )}
    </div>
  );
}

/* ======================================================================
   页面主体
   ====================================================================== */

export default function InvestPage() {
  /* -------- 状态 -------- */
  const [isMounted, setIsMounted] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [radar, setRadar] = useState<GlobalRadar>(DEFAULT_RADAR);
  const [lastUpdated, setLastUpdated] = useState("");
  const [selectedMarket, setSelectedMarket] = useState<"aShare" | "usShare">("aShare");
  const [selectedTier, setSelectedTier] = useState<TierKey>("under5");

  // AI 自定义选股舱状态
  const [filterQuery, setFilterQuery] = useState("");
  const [filterResults, setFilterResults] = useState<Stock[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState("");

  /* -------- 水合保护 + 数据加载 -------- */
  useEffect(() => {
    setIsMounted(true);
    (async () => {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const localData = await res.json();
          if (localData?.globalInvestmentRadar) {
            setRadar(localData.globalInvestmentRadar);
          }
          if (localData?.lastUpdated) {
            setLastUpdated(localData.lastUpdated);
          }
        }
      } catch {
        // 运行时 fetch 失败时静默降级
      }
    })();
    const savedAuth = localStorage.getItem("radar_auth_passed");
    if (savedAuth === "true") {
      setIsLocked(false);
    }
  }, []);

  /* -------- 版本检测自动刷新 -------- */
  const versionRef = useRef(lastUpdated);
  useEffect(() => {
    if (!isMounted) return;
    versionRef.current = lastUpdated;
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
      } catch {}
    }, 120000);
    return () => clearInterval(interval);
  }, [isMounted]);

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

  /* -------- AI 自定义选股 -------- */
  const handleFilterSubmit = async () => {
    if (!filterQuery.trim()) return;
    setFilterLoading(true);
    setFilterError("");
    setFilterResults([]);
    try {
      const res = await fetch("/api/custom-filter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: filterQuery.trim() }),
      });
      const body = await res.json();
      if (res.ok && Array.isArray(body.results)) {
        setFilterResults(
          body.results.map((r: any) => ({
            code: r.code,
            name: r.name,
            price: r.price ?? null,
            changePercent: r.changePercent ?? null,
            trailingPE: r.trailingPE ?? null,
            buyZone: r.buyZone || "--",
            takeProfit: r.takeProfit || "--",
            stopLoss: r.stopLoss || "--",
            reason: r.dynamicReason || r.reason || "",
            dynamicReason: r.dynamicReason || "",
          }))
        );
      } else {
        setFilterError(body.error || "AI 选股暂不可用");
      }
    } catch {
      setFilterError("网络异常，请检查连接后重试");
    } finally {
      setFilterLoading(false);
    }
  };

  const handleFilterKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !filterLoading) {
      handleFilterSubmit();
    }
  };

  const clearFilterResults = () => {
    setFilterResults([]);
    setFilterError("");
  };

  if (!isMounted) return null;

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
  const pool = selectedMarket === "aShare" ? radar.aSharePool : radar.usSharePool;
  const currentStocks = filterByTier(pool, selectedTier);

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-slate-800 selection:bg-slate-100 font-sans antialiased pb-24" suppressHydrationWarning>
      <NavHeader lastUpdated={lastUpdated} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-6 sm:mt-10 space-y-6 sm:space-y-8">
        {/* 页面标题 */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-tight">资产掘金雷达</h1>
            <p className="text-sm text-slate-400">
              Global Investment Radar · 中美双轨 五档水位 · 智能资产狩猎矩阵
            </p>
          </div>
        </div>

        {/* 第一层联动：市场切换（iOS 级一体化胶囊槽） */}
        <div className="w-full overflow-x-auto scrollbar-none">
          <div className="inline-flex bg-neutral-200/40 backdrop-blur-sm rounded-2xl p-1.5 whitespace-nowrap">
            {MARKETS.map((m) => (
              <button
                key={m.key}
                onClick={() => setSelectedMarket(m.key)}
                className={`px-6 sm:px-8 py-2.5 rounded-xl text-sm sm:text-base transition-all ${
                  selectedMarket === m.key
                    ? "bg-white text-slate-950 font-medium shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* 第二层联动：价格档位切换 */}
        <div className="flex flex-wrap gap-2">
          {TIERS.map((tier) => (
            <button
              key={tier.key}
              onClick={() => setSelectedTier(tier.key)}
              className={`px-5 py-2 rounded-xl text-sm transition-all ${
                selectedTier === tier.key
                  ? "bg-slate-900 text-white font-medium shadow-sm"
                  : "bg-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100/50"
              }`}
            >
              {tier.label} <span className="text-xs opacity-70">/ {tier.sub}</span>
            </button>
          ))}
        </div>

        {/* 当前筛选指示器 */}
        <div className="text-sm text-slate-400">
          当前筛选：
          <span className="font-medium text-slate-600">
            {MARKETS.find((m) => m.key === selectedMarket)?.label}
          </span>
          ·
          <span className="font-medium text-slate-600 ml-1">
            {TIERS.find((t) => t.key === selectedTier)?.label}{" "}
            {TIERS.find((t) => t.key === selectedTier)?.sub}
          </span>
          · <span className="text-slate-500">{currentStocks.length} 支标的</span>
        </div>

        {/* ================================================================
            AI 驱动自定义选股舱
            ================================================================ */}
        <div className="bg-white border border-neutral-200/40 rounded-3xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 bg-indigo-50 border border-indigo-100 rounded-lg flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <span className="text-sm font-semibold text-slate-700">AI 实时自定义选股舱</span>
            <span className="text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">DeepSeek V4</span>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              placeholder="输入您的自定义投资策略，如：低市盈率 + 算力国产替代 + 绝对股价低于30元..."
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              onKeyDown={handleFilterKeyDown}
              className="flex-1 px-5 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-slate-300 transition-all text-slate-800 placeholder:text-slate-400"
            />
            <button
              onClick={handleFilterSubmit}
              disabled={filterLoading || !filterQuery.trim()}
              className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-sm font-medium transition-all shadow-sm flex items-center gap-2 shrink-0"
            >
              {filterLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span className="text-white/80">掘金中...</span>
                </>
              ) : (
                "启动策略掘金"
              )}
            </button>
          </div>

          {/* 骨架屏加载态 */}
          {filterLoading && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-pulse">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-white border border-neutral-200/40 rounded-2xl p-6 space-y-5">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="h-4 bg-slate-200 rounded w-20" />
                      <div className="h-3 bg-slate-100 rounded w-14" />
                    </div>
                    <div className="space-y-1.5">
                      <div className="h-6 bg-slate-200 rounded w-16" />
                      <div className="h-3 bg-slate-100 rounded w-12 ml-auto" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="bg-slate-50 rounded-xl p-3 space-y-1.5">
                        <div className="h-2 bg-slate-200 rounded w-10 mx-auto" />
                        <div className="h-3 bg-slate-200 rounded w-8 mx-auto" />
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    <div className="h-3 bg-slate-100 rounded w-full" />
                    <div className="h-3 bg-slate-100 rounded w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 错误提示 */}
          {filterError && !filterLoading && (
            <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm text-red-600">{filterError}</p>
            </div>
          )}

          {/* AI 选股结果 */}
          {filterResults.length > 0 && !filterLoading && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-500">
                  DeepSeek V4 策略匹配 · {filterResults.length} 支标的
                </span>
                <button
                  onClick={clearFilterResults}
                  className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                >
                  清除结果
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {filterResults.map((stock) => (
                  <StockCard key={stock.code} stock={stock} />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 正常股票网格（有筛选结果时隐藏） */}
        {filterResults.length === 0 && !filterLoading && (
          <>
          {currentStocks.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {currentStocks.map((stock: Stock) => (
              <StockCard key={stock.code} stock={stock} />
            ))}
          </div>
        ) : (
          <div className="bg-white border border-neutral-200/40 rounded-3xl p-12 text-center">
            <div className="text-slate-300 mb-2">
              <TrendingUp className="w-8 h-8 mx-auto" />
            </div>
            <p className="text-sm text-slate-500">当前筛选条件下暂无标的</p>
            <p className="text-xs text-slate-400 mt-1">请切换市场或价格档位浏览</p>
          </div>
        )}
        </>
      )}
      </main>
    </div>
  );
}
