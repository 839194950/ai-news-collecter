import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const dataPath = path.resolve(process.cwd(), "src", "data", "latest.json");
    if (!fs.existsSync(dataPath)) {
      return NextResponse.json({ error: "Data not found" }, { status: 404 });
    }
    const raw = fs.readFileSync(dataPath, "utf-8");
    const data = JSON.parse(raw);
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
