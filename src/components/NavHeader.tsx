"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { RefreshCw } from "lucide-react";

const NAV_LINKS = [
  { href: "/", label: "宏观雷达大盘" },
  { href: "/invest", label: "资产掘金雷达" },
];

function formatBeijingTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  const bj = new Date(d.getTime() + 8 * 3600000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${bj.getUTCFullYear()}-${pad(bj.getUTCMonth() + 1)}-${pad(bj.getUTCDate())} ${pad(bj.getUTCHours())}:${pad(bj.getUTCMinutes())}`;
}

export default function NavHeader({ lastUpdated }: { lastUpdated?: string }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 bg-[#FBFBFA]/80 backdrop-blur-md z-40 border-b border-slate-100/60">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-3">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse" />
            <span className="text-base font-semibold tracking-tight text-slate-900">全球商情雷达</span>
          </div>
          <nav className="items-center space-x-1 hidden sm:flex">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-4 py-1.5 text-sm rounded-lg transition-all ${
                    isActive
                      ? "text-slate-900 font-medium underline decoration-slate-400/60 decoration-1 underline-offset-4"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center space-x-5 text-sm text-slate-500">
          <span className="hidden sm:flex items-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> 数据每 8 小时自动推演
          </span>
          {lastUpdated && (
            <span className="border-l border-slate-200 pl-5">更新: {formatBeijingTime(lastUpdated)}</span>
          )}
        </div>
      </div>
    </header>
  );
}
