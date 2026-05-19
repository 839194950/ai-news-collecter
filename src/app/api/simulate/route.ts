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

/* ======================================================================
   读取当前市场背景上下文
   ====================================================================== */

interface MarketContext {
  macroMetrics?: { economicConfidence?: number; regulatoryPressure?: number };
  marketRegime?: { quadrant?: string };
  marketBenchmarks?: Record<string, unknown>;
  macroBarometers?: Record<string, unknown>;
}

async function loadMarketContext(): Promise<MarketContext | null> {
  try {
    const p = path.join(process.cwd(), 'src', 'data', 'latest.json');
    const raw = await fs.readFile(p, 'utf-8');
    return JSON.parse(raw) as MarketContext;
  } catch {
    return null;
  }
}

/* ======================================================================
   POST /api/simulate
   ====================================================================== */

export async function POST(request: NextRequest) {
  // ---- 1. 请求校验 ----
  let body: { hypothesis?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: '请求体必须是有效的 JSON。' }, { status: 400 });
  }

  const hypothesis = body.hypothesis?.trim();
  if (!hypothesis) {
    return NextResponse.json(
      { error: '请提供您的宏观假设文本（字段名：hypothesis）。' },
      { status: 400 },
    );
  }

  if (hypothesis.length > 500) {
    return NextResponse.json(
      { error: '假设文本超出 500 字限制，请精简后重试。' },
      { status: 400 },
    );
  }

  // ---- 2. 读取当前市场背景 ----
  const marketContext = await loadMarketContext();
  const contextSummary = marketContext
    ? JSON.stringify({
        macroMetrics: marketContext.macroMetrics,
        marketRegime: marketContext.marketRegime,
        marketBenchmarks: marketContext.marketBenchmarks,
        macroBarometers: marketContext.macroBarometers,
      })
    : '（暂无实时市场数据）';

  // ---- 3. 调用 DeepSeek 沙盘推演 ----
  try {
    const response = await getClient().chat.completions.create({
      model: process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash',
      messages: [
        {
          role: 'system',
          content: `你是一位毒辣的宏观对冲基金策略师。用户会抛出一个"假设事件"，你要基于当前真实市场数据，在 250 字以内推演该事件通过怎样的因果链冲击美债、科技股、大 A 股三大资产。

## 输出格式
只输出 JSON，不要 markdown 代码块：
{ "simulation": "你的推演内容（250 字以内）" }

## 推演要求
- 开门见山，第一句直接点明总体方向（利多/利空/中性震荡）。
- 用 → 串联因果链条，例如："美联储降息 → 美债收益率跳水 → 科技股久期溢价重估 → 北向资金涌入 A 股核心资产"。
- 结尾一句给出可操作的短期结论。
- 语气锋利，拒绝模棱两可。`,
        },
        {
          role: 'user',
          content: `【当前市场背景】\n${contextSummary}\n\n【假设事件】\n${hypothesis}\n\n请推演。`,
        },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 1024,
    });

    const raw = response.choices?.[0]?.message?.content;
    if (!raw) throw new Error('API 返回内容为空');

    const parsed = JSON.parse(raw);
    return NextResponse.json({
      simulation: parsed.simulation || '推演引擎暂未生成有效结果，请稍后重试。',
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误';
    console.error('[api/simulate] ❌ DeepSeek 推演失败:', message);

    return NextResponse.json(
      {
        error: '蝴蝶效应沙盘暂时无法连接推演引擎。请检查 DeepSeek API 配置或稍后重试。',
      },
      { status: 503 },
    );
  }
}
