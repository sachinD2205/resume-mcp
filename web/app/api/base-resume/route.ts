import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";

export async function GET() {
  try {
    // In production (Vercel), the file is bundled at build time via public folder
    // In dev, read from the local templates folder
    let content: string;

    try {
      // Try to read from public folder first (production)
      const publicPath = join(process.cwd(), "public", "base_resume.tex");
      content = readFileSync(publicPath, "utf-8");
    } catch {
      // Fallback: read from sibling src/templates (local dev)
      const devPath = join(process.cwd(), "..", "src", "templates", "base_resume.tex");
      content = readFileSync(devPath, "utf-8");
    }

    return NextResponse.json({ content });
  } catch {
    return NextResponse.json({ error: "Base resume not found" }, { status: 404 });
  }
}
