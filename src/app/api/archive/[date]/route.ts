import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/* ======================================================================
   GET /api/archive/[date]
   读取 src/data/history/ 中对应日期的历史快照 JSON
   ====================================================================== */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const { date } = await params;

  // 校验日期格式 YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: '日期格式无效，请使用 YYYY-MM-DD 格式。' }, { status: 400 });
  }

  const archivePath = path.join(process.cwd(), 'src', 'data', 'history', `${date}.json`);

  if (!fs.existsSync(archivePath)) {
    return NextResponse.json({ error: '该日档案尚未同步或已归档。' }, { status: 404 });
  }

  try {
    const raw = fs.readFileSync(archivePath, 'utf-8');
    const content = JSON.parse(raw);
    return NextResponse.json(content);
  } catch (e) {
    console.error(`[api/archive] ❌ 归档解析失败: ${date}`, e);
    return NextResponse.json({ error: '归档文件格式损坏，无法解析。' }, { status: 500 });
  }
}
