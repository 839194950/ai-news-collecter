import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/* ======================================================================
   GET /api/archive-list
   刚性扫描 src/data/history/ 目录，提取所有历史快照日期
   返回倒序排列的日期数组
   ====================================================================== */

export async function GET() {
  const historyDir = path.join(process.cwd(), 'src', 'data', 'history');

  try {
    if (!fs.existsSync(historyDir)) {
      return NextResponse.json([]);
    }

    const files = fs.readdirSync(historyDir);
    const dateSet = new Set<string>();

    for (const file of files) {
      const match = file.match(/^(\d{4}-\d{2}-\d{2})\.json$/);
      if (match) {
        dateSet.add(match[1]);
      }
    }

    const dates = Array.from(dateSet).sort((a, b) => b.localeCompare(a));
    return NextResponse.json(dates);
  } catch (e) {
    console.error('[api/archive-list] 扫描历史档案目录失败:', e);
    return NextResponse.json([], { status: 500 });
  }
}
