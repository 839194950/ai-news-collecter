"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, TrendingUp, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

/* ======================================================================
   默认降级数据
   ====================================================================== */
const FALLBACK_SECTOR = {
  name: "未知行业",
  status: "数据暂缺，待下次 AI 分析更新",
  latestNews: [
    "暂无该行业最新动态数据。待下次管道运行后，DeepSeek 将对该行业的供应链迁移及地缘合规影响进行深度复盘。",
  ],
  catalyst: "暂无可用催化剂数据。",
  riskFactor: "暂无可用风险数据。",
  investmentVehicles: {
    stocks: [] as Array<{ code: string; name: string; exposureReason: string; price: number | null; changePercent: number | null; pe: number | null }>,
    fundsEtfs: [] as Array<{ code: string; name: string; strategyAdvice: string }>,
  },
};

/* ======================================================================
   独立研报页面（v3 完全体：含实时行情、PE、动量标签）
   ====================================================================== */
export default function SectorReportPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [sector, setSector] = useState<{
    name: string;
    status: string;
    latestNews: string[];
    catalyst: string;
    riskFactor: string;
    investmentVehicles: {
      stocks: Array<{ code: string; name: string; exposureReason: string; price: number | null; changePercent: number | null; pe: number | null }>;
      fundsEtfs: Array<{ code: string; name: string; strategyAdvice: string }>;
    };
  } | null>(null);

  const params = useParams();
  const sectorId = params.id as string;

  /* -------- 水合保护 + 数据加载 -------- */
  useEffect(() => {
    setIsMounted(true);
    (async () => {
      try {
        const res = await fetch("/api/data");
        if (res.ok) {
          const localData = await res.json();
          const found = localData?.dynamicSectors?.find(
            (s: { id: string }) => s.id === sectorId
          );
          setSector(found || FALLBACK_SECTOR);
        } else {
          setSector(FALLBACK_SECTOR);
        }
      } catch {
        setSector(FALLBACK_SECTOR);
      }
    })();
  }, [sectorId]);

  if (!isMounted) return null;
  if (!sector) return null;

  const { investmentVehicles } = sector;
  const hasStocks =
    investmentVehicles?.stocks && investmentVehicles.stocks.length > 0;
  const hasFunds =
    investmentVehicles?.fundsEtfs && investmentVehicles.fundsEtfs.length > 0;
  const showInvestments = hasStocks || hasFunds;

  return (
    <div className="min-h-screen bg-[#FBFBFA] text-slate-800 font-sans antialiased pb-32 selection:bg-slate-100">
      <div className="max-w-5xl mx-auto px-6 pt-10">

        {/* ---- 左上角返回按钮 ---- */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-12 group"
        >
          <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-0.5" />
          <span>返回宏观大盘</span>
        </Link>

        {/* ---- 头部：行业大标题 + 深算状态标签 ---- */}
        <div className="mb-16">
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight text-slate-900 leading-tight">
            {sector.name}
          </h1>
          <span className="inline-flex items-center px-4 py-1.5 mt-5 rounded-full text-sm font-medium bg-emerald-50/70 text-emerald-700 border border-emerald-200/30">
            {sector.status}
          </span>
        </div>

        {/* ---- 模块一：前沿直击 / 最新动态 ---- */}
        <section className="mb-12">
          <h2 className="text-xs font-semibold text-slate-400 tracking-[0.15em] uppercase mb-7">
            前沿直击 / 最新动态
          </h2>
          <div className="bg-white border border-neutral-200/30 rounded-3xl p-8 sm:p-10 space-y-8">
            {sector.latestNews.map((news: string, i: number) => (
              <p
                key={i}
                className="text-[15px] sm:text-base text-slate-700 leading-8 tracking-wide"
                style={{ textAlign: "justify" }}
              >
                {news}
              </p>
            ))}
          </div>
        </section>

        {/* ---- 模块二：双轮驱动 / 催化与风控 ---- */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white border border-neutral-200/30 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-red-400/50" />
            <h3 className="text-xs font-semibold text-red-600 tracking-[0.15em] uppercase mb-5">
              短期核心催化剂
            </h3>
            <p
              className="text-[15px] text-slate-700 leading-8 tracking-wide"
              style={{ textAlign: "justify" }}
            >
              {sector.catalyst}
            </p>
          </div>
          <div className="bg-white border border-neutral-200/30 rounded-3xl p-8 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-500/50" />
            <h3 className="text-xs font-semibold text-emerald-600 tracking-[0.15em] uppercase mb-5">
              潜在现实风险
            </h3>
            <p
              className="text-[15px] text-slate-700 leading-8 tracking-wide"
              style={{ textAlign: "justify" }}
            >
              {sector.riskFactor}
            </p>
          </div>
        </section>

        {/* ---- 模块三：资本市场映射矩阵 ---- */}
        {showInvestments && (
          <section>
            <h2 className="text-xs font-semibold text-slate-400 tracking-[0.15em] uppercase mb-7">
              资本市场映射矩阵 / 关联股票与基金
            </h2>

            <div className="space-y-6">
              {/* —— 关联龙头股票矩阵（含实时行情） —— */}
              {hasStocks && (
                <div className="bg-white border border-neutral-200/30 rounded-3xl overflow-hidden">
                  <div className="px-8 pt-8 pb-4 flex items-center gap-2.5">
                    <TrendingUp className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-600 tracking-wide">
                      关联龙头股票矩阵
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100">
                          <th className="text-left text-xs text-slate-400 font-medium uppercase tracking-wider px-8 py-4 w-[70px]">代码</th>
                          <th className="text-left text-xs text-slate-400 font-medium uppercase tracking-wider px-4 py-4 w-[90px]">名称</th>
                          <th className="text-right text-xs text-slate-400 font-medium uppercase tracking-wider px-4 py-4 w-[100px]">实时股价</th>
                          <th className="text-right text-xs text-slate-400 font-medium uppercase tracking-wider px-4 py-4 w-[90px]">涨跌幅</th>
                          <th className="text-right text-xs text-slate-400 font-medium uppercase tracking-wider px-4 py-4 w-[80px]">动态PE</th>
                          <th className="text-left text-xs text-slate-400 font-medium uppercase tracking-wider px-4 py-4">DeepSeek 关联逻辑</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investmentVehicles.stocks.map((stock, i) => {
                          const priceUp = stock.changePercent != null && stock.changePercent >= 0;
                          return (
                            <tr key={i} className="border-b border-neutral-50 last:border-b-0 hover:bg-neutral-50/40 transition-colors">
                              <td className="px-8 py-4">
                                <span className="font-mono font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded-md text-xs">
                                  {stock.code}
                                </span>
                              </td>
                              <td className="px-4 py-4 font-medium text-slate-700">{stock.name}</td>
                              <td className="px-4 py-4 text-right font-mono text-slate-800">
                                {stock.price != null
                                  ? (stock.code.endsWith('.HK') || stock.code.endsWith('.TW') || /^\d/.test(stock.code)
                                      ? `HK$${stock.price.toFixed(2)}`
                                      : `$${stock.price.toFixed(2)}`)
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-4 text-right">
                                {stock.changePercent != null
                                  ? <span className={`font-mono font-medium ${priceUp ? 'text-red-500' : 'text-emerald-600'}`}>
                                      {priceUp ? '▲' : '▼'} {Math.abs(stock.changePercent).toFixed(2)}%
                                    </span>
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-4 text-right font-mono text-slate-600">
                                {stock.pe != null
                                  ? stock.pe.toFixed(1)
                                  : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-4 py-4 text-slate-500 leading-6 tracking-wide text-[13px]">
                                {stock.exposureReason}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* —— 关联基金/ETF（含操作防身策略） —— */}
              {hasFunds && (
                <div className="bg-white border border-neutral-200/30 rounded-3xl overflow-hidden">
                  <div className="px-8 pt-8 pb-4 flex items-center gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    <h3 className="text-sm font-semibold text-slate-600 tracking-wide">
                      行业公募基金 / ETF
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-100">
                          <th className="text-left text-xs text-slate-400 font-medium uppercase tracking-wider px-8 py-4 w-[100px]">基金代码</th>
                          <th className="text-left text-xs text-slate-400 font-medium uppercase tracking-wider px-4 py-4">基金名称</th>
                          <th className="text-left text-xs text-slate-400 font-medium uppercase tracking-wider px-4 py-4">DeepSeek 操作防身策略</th>
                        </tr>
                      </thead>
                      <tbody>
                        {investmentVehicles.fundsEtfs.map((fund, i) => (
                          <tr key={i} className="border-b border-neutral-50 last:border-b-0 hover:bg-neutral-50/40 transition-colors">
                            <td className="px-8 py-4">
                              <span className="font-mono font-semibold text-slate-800 bg-slate-50 px-2 py-0.5 rounded-md text-xs">
                                {fund.code}
                              </span>
                            </td>
                            <td className="px-4 py-4 font-medium text-slate-700">{fund.name}</td>
                            <td className="px-4 py-4">
                              <div className="bg-amber-50/50 border border-amber-200/20 rounded-xl p-4">
                                <p className="text-xs font-semibold text-amber-700 tracking-wider uppercase mb-1.5">
                                  操作防身策略
                                </p>
                                <p className="text-sm text-amber-800/90 leading-7 tracking-wide">
                                  {fund.strategyAdvice}
                                </p>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </div>
  );
}
