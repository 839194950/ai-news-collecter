import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import fs from 'fs/promises';
import path from 'path';

/* ======================================================================
   DeepSeek 客户端（惰性初始化，避免构建时因缺失 API Key 崩溃）
   ====================================================================== */

let _client: OpenAI | null = null;
function getClient(): OpenAI {
  if (!_client) {
    _client = new OpenAI({
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com',
      apiKey: process.env.DEEPSEEK_API_KEY || '',
      timeout: 30000,
    });
  }
  return _client;
}

interface RawStock {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  trailingPE: number | null;
  buyZone: string;
  takeProfit: string;
  stopLoss: string;
  reason: string;
}

interface FilterResult {
  code: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  trailingPE: number | null;
  buyZone: string;
  takeProfit: string;
  stopLoss: string;
  dynamicReason: string;
  reason: string;
}

export async function POST(request: NextRequest) {
  let body: { query?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '无效的请求体。' }, { status: 400 });
  }

  const query = body.query?.trim();
  if (!query) {
    return NextResponse.json({ error: '请输入您的投资策略。' }, { status: 400 });
  }

  if (query.length > 500) {
    return NextResponse.json({ error: '策略描述超出 500 字限制。' }, { status: 400 });
  }

  // ======================================================================
  // 第一阶段：读取本地真实大账本 latest.json
  // ======================================================================
  let allStocks: RawStock[] = [];
  try {
    const p = path.join(process.cwd(), 'src', 'data', 'latest.json');
    const raw = await fs.readFile(p, 'utf-8');
    const data = JSON.parse(raw);
    const radar = data.globalInvestmentRadar;
    if (radar) {
      const aPool: RawStock[] = Array.isArray(radar.aSharePool) ? radar.aSharePool : [];
      const uPool: RawStock[] = Array.isArray(radar.usSharePool) ? radar.usSharePool : [];
      allStocks = [...aPool, ...uPool];
    }
  } catch {
    return NextResponse.json({ error: '无法读取股票数据，请确保 pipeline 已运行。' }, { status: 500 });
  }

  if (allStocks.length === 0) {
    return NextResponse.json({ error: '当前股票池为空。' }, { status: 500 });
  }

  // ---- 建立股票池 code 索引（用于后续强行行情对账） ----
  const poolMap = new Map<string, RawStock>();
  for (const s of allStocks) poolMap.set(s.code, s);

  // ======================================================================
  // 第二阶段：向 DeepSeek 投喂全量股票池（只传描述，不做价格分档）
  // 大模型只负责定性筛选：根据用户的策略描述挑最匹配的标的
  // ======================================================================

  const stockPoolSummary = allStocks.map(s =>
    `[${s.code}] ${s.name} | 现价:${s.price ?? '--'} | 涨跌幅:${s.changePercent != null ? s.changePercent.toFixed(2) + '%' : '--'} | 市盈率:${s.trailingPE ?? '--'} | 建仓区:${s.buyZone} | 止盈:${s.takeProfit} | 止损:${s.stopLoss} | 概述:${s.reason}`
  ).join('\n');

  try {
    const response = await getClient().chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一位顶尖的量化选股策略师。用户输入自定义投资策略（如"低估值+高成长+AI主题"），你需要从下方给出的全量股票池中精选 3-4 支最符合条件的标的。

## 筛选规则
- 根据基本面、行业主题、成长逻辑进行定性判断，挑选最符合用户策略描述的标的
- 每支入选股票必须给出 60 字以内的【动态入选理由】
- 严禁硬编码价格分档或绝对价格区间——价格筛选由后端系统自动完成
- 如果没有任何股票符合条件，results 返回空数组

## 输出格式（必须遵守）
只输出 JSON，不要 markdown 代码块：
{ "results": [{ "code": "股票代码", "dynamicReason": "动态入选理由（60 字以内）" }] }

## 铁律 — 禁止伪造数据
你只能输出 code 和 dynamicReason 字段。严禁输出任何价格、市盈率、建仓区间等数值字段——这些必须由系统后端从股票池中原地读取最新真实数据。`,
        },
        {
          role: 'user',
          content: `【全量股票池（所有数据均为最新真实行情）】\n${stockPoolSummary}\n\n【自定义投资策略】\n${query}\n\n请精选最符合要求的标的，按 {"results": [{"code": "...", "dynamicReason": "..."}]} 格式返回。不要包含任何价格数据。`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2048,
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) throw new Error('API 返回内容为空');

    interface AiSelection {
      code: string;
      dynamicReason: string;
    }

    const parsed = JSON.parse(raw);
    const selections: AiSelection[] = Array.isArray(parsed)
      ? parsed.slice(0, 4)
      : Array.isArray(parsed.results)
        ? parsed.results.slice(0, 4)
        : [];

    // ====================================================================
    // 第三阶段：后端强行行情对账缝合
    // 用 latest.json 中的 100% 真实行情覆盖 AI 返回结果中的空值
    // ====================================================================

    const results: FilterResult[] = [];
    for (const sel of selections) {
      const realStock = poolMap.get(sel.code);
      if (!realStock) continue;

      // 真实行情全面覆盖：优先用池子里采集到的真实股价
      const realPrice = realStock.price != null
        ? Number(realStock.price)
        : (realStock as any).currentPrice != null
          ? Number((realStock as any).currentPrice)
          : null;

      results.push({
        code: realStock.code,
        name: realStock.name,
        price: realPrice,
        changePercent: realStock.changePercent,
        trailingPE: realStock.trailingPE,
        // 用真实行情的价位区间，绝对不空
        buyZone: realStock.buyZone && realStock.buyZone !== '--' ? realStock.buyZone : '--',
        takeProfit: realStock.takeProfit && realStock.takeProfit !== '--' ? realStock.takeProfit : '--',
        stopLoss: realStock.stopLoss && realStock.stopLoss !== '--' ? realStock.stopLoss : '--',
        dynamicReason: sel.dynamicReason || realStock.reason,
        reason: realStock.reason,
      });
    }

    return NextResponse.json({ results });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    console.error('[api/custom-filter] DeepSeek 选股失败:', message);
    return NextResponse.json({ error: 'AI 选股服务暂时不可用，请检查 DeepSeek API 配置或稍后重试。' }, { status: 503 });
  }
}