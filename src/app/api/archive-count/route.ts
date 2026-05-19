import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  const archivesDir = path.join(process.cwd(), 'src', 'data', 'archives');
  try {
    if (!fs.existsSync(archivesDir)) {
      return NextResponse.json({ count: 0 });
    }
    const files = fs.readdirSync(archivesDir).filter(f => f.endsWith('.json'));
    return NextResponse.json({ count: files.length });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}
