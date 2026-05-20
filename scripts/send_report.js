#!/usr/bin/env node
/**
 * AI 投研日报邮件发送脚本
 *
 * 环境变量:
 *   EMAIL_USER        — QQ 邮箱地址 (如 xxx@qq.com)
 *   EMAIL_PASS        — 16 位 QQ 邮箱独立授权码
 *   RECEIVER_EMAIL    — 接收邮箱（可选，默认发给自己）
 *
 * 用法:
 *   EMAIL_USER=xxx@qq.com EMAIL_PASS=xxxx node scripts/send_report.js
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

/* ===================== 1. 读取数据 ===================== */
const dataPath = path.resolve(__dirname, '../src/data/latest.json');
const raw = fs.readFileSync(dataPath, 'utf-8');
const data = JSON.parse(raw);

const {
  lastUpdated,
  macroMetrics,
  marketRegime,
  marketSentimentTracker,
  globalInvestmentRadar,
  marketBenchmarks,
  economicForecast,
  catalystFactors,
  industryRadar,
  aiDebate,
} = data;

const fearGreedIndex = marketSentimentTracker?.fearGreedIndex ?? 50;
const hotThemes = marketSentimentTracker?.hotThemes ?? [];
const aShares = globalInvestmentRadar?.aSharePool ?? [];
const usShares = globalInvestmentRadar?.usSharePool ?? [];
const economicConfidence = macroMetrics?.economicConfidence ?? '--';

/* ===================== 2. 五档情绪逻辑 ===================== */
function getTier(index) {
  if (index <= 20) return {
    label: '极度恐惧', color: '#dc2626', bg: '#fef2f2',
    advice: '市场陷入全面非理性恐慌，往往是买方机构"黄金左侧伏击圈"。仓位轻者建议停止恐慌，分批伏击低估高成长标的。',
  };
  if (index <= 40) return {
    label: '恐惧', color: '#d97706', bg: '#fffbeb',
    advice: '市场信心退潮，多头日内观望。日内资金向核心避险资产和高动量主线抱团。建议维持中等偏保守仓位。',
  };
  if (index <= 60) return {
    label: '中性', color: '#64748b', bg: '#f8fafc',
    advice: '多空交织拉锯，方向不明。建议静默对账，关注流动性热力图的交叉共振节点，不盲目满仓。',
  };
  if (index <= 80) return {
    label: '贪婪', color: '#059669', bg: '#ecfdf5',
    advice: '情绪全面回暖，散户与热钱进场抢筹。建议逐步逢高减仓获利了结，止盈位已触发的果断分批锁死利润。',
  };
  return {
    label: '极度贪婪', color: '#06b6d4', bg: '#ecfeff',
    advice: '筹码极度过热，全网情绪指标拉满！随时高位多头踩踏。建议死守止损线，拒绝一切新开仓追高诱惑！',
  };
}

const tier = getTier(fearGreedIndex);

/* ===================== 3. 构建 HTML ===================== */
const dateStr = new Date(lastUpdated).toLocaleString('zh-CN', {
  timeZone: 'Asia/Shanghai', hour12: false,
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit',
});

/* --- 市场基准行 --- */
function benchmarkRow(name, current, change) {
  const isUp = change > 0;
  const isDown = change < 0;
  const color = isUp ? '#ef4444' : isDown ? '#10b981' : '#94a3b8';
  const arrow = isUp ? '▲' : isDown ? '▼' : '—';
  return `
    <tr>
      <td style="font-size:14px;color:#1e293b;padding:6px 12px;border-bottom:1px solid #f1f5f9;">${name}</td>
      <td style="font-size:14px;color:#1e293b;padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;font-variant-numeric:tabular-nums;">${current}</td>
      <td style="font-size:14px;color:${color};padding:6px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-weight:600;">${arrow} ${Math.abs(change).toFixed(2)}%</td>
    </tr>`;
}

const sp500 = marketBenchmarks?.sp500;
const nasdaq = marketBenchmarks?.nasdaq;
const csi300 = marketBenchmarks?.csi300;
const csi500 = marketBenchmarks?.csi500;

/* --- 热度动量条 --- */
function themeBarHTML(theme) {
  const isUp = theme.trendDirection === 'up';
  const isDown = theme.trendDirection === 'down';
  const barColor = isUp ? '#f43f5e' : isDown ? '#10b981' : '#94a3b8';
  const arrow = isUp ? '↑' : isDown ? '↓' : '→';
  const pct = Math.max(0, Math.min(100, (theme.momentumScore ?? 0) * 10));
  return `
    <div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
        <span style="font-size:13px;font-weight:600;color:#1e293b;">${theme.keyword} <span style="color:${barColor};">${arrow}</span></span>
        <span style="font-size:12px;font-weight:700;color:${barColor};">${theme.momentumScore}/10</span>
      </div>
      <div style="width:100%;height:6px;background:#e2e8f0;border-radius:999px;overflow:hidden;">
        <div style="width:${pct}%;height:100%;background:${barColor};border-radius:999px;transition:width 0.7s;"></div>
      </div>
    </div>`;
}

/* --- 选股卡片 --- */
function isACode(code) {
  return /\.(SZ|SS|SH)$/i.test(code);
}

function fmtPrice(val, code) {
  if (val == null || val === '--' || val === '') return '--';
  const sym = isACode(code) ? '¥' : '$';
  if (typeof val === 'number') return sym + val.toFixed(2);
  return String(val).replace(/(\d+\.?\d*)/g, sym + '$1');
}

function stockCardHTML(stock, idx) {
  const isUp = (stock.changePercent ?? 0) > 0;
  const isDown = (stock.changePercent ?? 0) < 0;
  const color = isUp ? '#ef4444' : isDown ? '#10b981' : '#94a3b8';
  const arrow = isUp ? '▲' : isDown ? '▼' : '—';
  return `
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 16px;margin-bottom:8px;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <span style="font-size:13px;font-weight:700;color:#0f172a;">${stock.name}</span>
          <span style="font-size:11px;color:#94a3b8;margin-left:6px;">${stock.code}</span>
        </div>
        <div style="text-align:right;">
          <span style="font-size:14px;font-weight:700;color:#1e293b;">${fmtPrice(stock.price, stock.code)}</span>
          <span style="font-size:12px;font-weight:600;color:${color};margin-left:6px;">${arrow} ${Math.abs(stock.changePercent ?? 0).toFixed(2)}%</span>
        </div>
      </div>
      <div style="margin-top:6px;display:flex;gap:12px;flex-wrap:wrap;font-size:11px;color:#64748b;">
        <span>PE: ${stock.trailingPE ?? '--'}</span>
        <span>买入区: ${fmtPrice(stock.buyZone, stock.code)}</span>
        <span>止盈: ${fmtPrice(stock.takeProfit, stock.code)}</span>
        <span>止损: ${fmtPrice(stock.stopLoss, stock.code)}</span>
      </div>
      <div style="margin-top:6px;font-size:12px;color:#475569;line-height:1.5;">${stock.reason ?? ''}</div>
    </div>`;
}

/* ===================== 4. HTML 邮件模板 ===================== */

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <title>AI 投研日报</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Text','PingFang SC','Microsoft YaHei',sans-serif;">

  <!-- ===== 主容器 ===== -->
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#ffffff;">
    <tr><td style="padding:0;">

      <!-- ===== 头部 ===== -->
      <div style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 100%);padding:32px 28px 28px;border-radius:0 0 24px 24px;">
        <div style="font-size:11px;color:#64748b;letter-spacing:1px;text-transform:uppercase;margin-bottom:4px;">AI 投研日报</div>
        <div style="font-size:24px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;margin-bottom:4px;">全球市场情绪雷达</div>
        <div style="font-size:13px;color:#94a3b8;">${dateStr} 更新</div>
        <div style="margin-top:16px;display:inline-block;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:999px;padding:4px 16px;font-size:12px;font-weight:600;color:#cbd5e1;">
          美林时钟：${marketRegime?.quadrant ?? '--'}
        </div>
      </div>

      <!-- ===== 恐惧贪婪指数 ===== -->
      <div style="padding:24px 28px 20px;">
        <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">恐惧贪婪指数 · Fear & Greed</div>
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:8px;">
          <span style="font-size:56px;font-weight:900;color:#0f172a;letter-spacing:-2px;line-height:1;">${fearGreedIndex}</span>
          <span style="font-size:14px;color:#94a3b8;font-weight:500;">/ 100</span>
        </div>
        <div style="display:inline-block;background:${tier.bg};color:${tier.color};font-size:12px;font-weight:700;padding:4px 14px;border-radius:999px;margin-bottom:16px;">${tier.label}</div>

        <!-- 五档量化度量槽 -->
        <div style="display:flex;gap:6px;margin-bottom:20px;max-width:300px;">
          ${['#dc2626','#d97706','#64748b','#059669','#06b6d4'].map((c, i) => {
            const active = (fearGreedIndex >= i * 20 + (i === 0 ? 0 : 1) && fearGreedIndex <= (i + 1) * 20) ||
              (i === 0 && fearGreedIndex <= 20) ||
              (i === 4 && fearGreedIndex >= 81);
            return `<div style="flex:1;height:8px;border-radius:999px;background:${active ? c : '#e2e8f0'};transition:background 0.5s;"></div>`;
          }).join('')}
        </div>

        <!-- AI 操盘决策 -->
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px 20px;">
          <div style="font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">AI 操盘决策指引</div>
          <div style="font-size:14px;color:#334155;line-height:1.7;">${tier.advice}</div>
        </div>
      </div>

      <!-- ===== 宏观一览 ===== -->
      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">宏观指标一览</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="background:#f8fafc;border-radius:12px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">经济信心</div>
              <div style="font-size:28px;font-weight:800;color:#0f172a;">${economicConfidence}</div>
            </div>
            <div style="background:#f8fafc;border-radius:12px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">监管压力</div>
              <div style="font-size:28px;font-weight:800;color:#0f172a;">${macroMetrics?.regulatoryPressure ?? '--'}</div>
            </div>
            <div style="background:#f8fafc;border-radius:12px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">黑天鹅概率</div>
              <div style="font-size:28px;font-weight:800;color:#0f172a;">${macroMetrics?.blackSwanProbability ?? '--'}%</div>
            </div>
            <div style="background:#f8fafc;border-radius:12px;padding:14px;text-align:center;">
              <div style="font-size:11px;color:#94a3b8;margin-bottom:4px;">市场情绪</div>
              <div style="font-size:28px;font-weight:800;color:#0f172a;">${macroMetrics?.marketSentiment ?? '--'}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- ===== 全球大盘基准 ===== -->
      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">全球大盘基准</div>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            ${sp500 ? benchmarkRow(sp500.name, sp500.current, sp500.change) : ''}
            ${nasdaq ? benchmarkRow(nasdaq.name, nasdaq.current, nasdaq.change) : ''}
            ${csi300 ? benchmarkRow(csi300.name, csi300.current, csi300.change) : ''}
            ${csi500 ? benchmarkRow(csi500.name, csi500.current, csi500.change) : ''}
          </table>
        </div>
      </div>

      <!-- ===== 当日异动主题 ===== -->
      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">当日异动主题 · 动量资金流向</div>
          ${hotThemes.map(themeBarHTML).join('')}
          ${hotThemes.length === 0 ? '<div style="font-size:13px;color:#94a3b8;">暂无主题数据</div>' : ''}
        </div>
      </div>

      <!-- ===== 行业热力雷达 ===== -->
      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">行业热力雷达</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            ${(industryRadar ?? []).map(s => {
              const sentColor = (s.sentiment ?? 0) > 0 ? '#10b981' : (s.sentiment ?? 0) < 0 ? '#ef4444' : '#94a3b8';
              return `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 12px;">
                  <div style="font-size:13px;font-weight:600;color:#0f172a;">${s.subject}</div>
                  <div style="font-size:11px;color:#94a3b8;margin-top:2px;">
                    热度 ${s.hotness} · 情绪 <span style="color:${sentColor};">${(s.sentiment ?? 0) > 0 ? '+' : ''}${(s.sentiment ?? 0).toFixed(1)}</span> · 动量 ${s.momentum ?? 0}
                  </div>
                </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- ===== AI 选股池 ===== -->
      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">A股 · 低价价值雷达</div>
          ${aShares.slice(0, 6).map((s, i) => stockCardHTML(s, i)).join('')}
        </div>
      </div>

      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">美股 · 科技掘金</div>
          ${usShares.slice(0, 6).map((s, i) => stockCardHTML(s, i)).join('')}
        </div>
      </div>

      <!-- ===== 催化剂事件 ===== -->
      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">催化剂事件</div>
          <ul style="margin:0;padding:0 0 0 16px;">
            ${(catalystFactors ?? []).map(f => `
              <li style="font-size:13px;color:#334155;line-height:1.6;margin-bottom:6px;">${f}</li>
            `).join('')}
          </ul>
        </div>
      </div>

      <!-- ===== 经济展望 ===== -->
      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">经济展望</div>
          <div style="font-size:13px;color:#334155;line-height:1.7;">${economicForecast ?? '暂无'}</div>
        </div>
      </div>

      <!-- ===== AI 多空辩论 ===== -->
      <div style="padding:0 28px 24px;">
        <div style="border-top:1px solid #f1f5f9;padding-top:20px;">
          <div style="font-size:11px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">AI 多空辩论</div>
          <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:14px 16px;margin-bottom:10px;">
            <div style="font-size:11px;font-weight:700;color:#dc2626;margin-bottom:6px;">🐻 空方观点</div>
            <div style="font-size:13px;color:#7f1d1d;line-height:1.6;">${aiDebate?.bearCase ?? '暂无'}</div>
          </div>
          <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:14px 16px;">
            <div style="font-size:11px;font-weight:700;color:#16a34a;margin-bottom:6px;">🐂 多方观点</div>
            <div style="font-size:13px;color:#14532d;line-height:1.6;">${aiDebate?.bullCase ?? '暂无'}</div>
          </div>
        </div>
      </div>

      <!-- ===== 底部 ===== -->
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 28px;text-align:center;">
        <div style="margin-bottom:12px;">
          <a href="https://ai-news-collecter-seven.vercel.app/" style="font-size:13px;color:#2563eb;text-decoration:none;font-weight:600;">
            🌐 在线看盘 → ai-news-collecter-seven.vercel.app
          </a>
        </div>
        <div style="font-size:11px;color:#94a3b8;line-height:1.6;">
          本报告由 AI 自动生成，仅供参考，不构成投资建议。<br>
          数据来源: DeepSeek V4 智能分析 · ${dateStr}
        </div>
      </div>

    </td></tr>
  </table>

</body>
</html>`;

/* ===================== 5. 发送邮件 ===================== */
const transporter = nodemailer.createTransport({
  service: 'QQ',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const receiver = process.env.RECEIVER_EMAIL || process.env.EMAIL_USER;

const mailOptions = {
  from: `"AI 投研日报" <${process.env.EMAIL_USER}>`,
  to: receiver,
  subject: `AI 投研日报 | 恐惧贪婪 ${fearGreedIndex} · ${tier.label} · ${marketRegime?.quadrant ?? ''}`,
  html,
};

async function main() {
  console.log('📤 正在发送邮件...');
  console.log(`   收件人: ${receiver}`);
  console.log(`   恐惧贪婪指数: ${fearGreedIndex} (${tier.label})`);
  console.log(`   市场状态: ${marketRegime?.quadrant ?? '--'}`);

  const info = await transporter.sendMail(mailOptions);
  console.log(`✅ 发送成功! Message-ID: ${info.messageId}`);
}

main().catch(err => {
  console.error('❌ 发送失败:', err.message);
  process.exit(1);
});
