import { exec } from "child_process";
import * as path from "path";
import * as fs from "fs";
import { promisify } from "util";
import FormData from "form-data";
import fetch from "node-fetch";

const execAsync = promisify(exec);

export interface CompileResult {
  success: boolean;
  pdfPath?: string;
  error?: string;
  method: "pdflatex" | "latexonline" | "manual-instructions";
}

export async function compileToPdf(texFilePath: string): Promise<CompileResult> {
  const dir = path.dirname(texFilePath);
  // PDF gets the same base name but with .pdf extension
  // (already named Sachin_Durge_Frontend_Developer_Resume_CompanyName.tex)
  const baseName = path.basename(texFilePath, ".tex");

  // 1️⃣ Try local pdflatex
  const local = await tryPdflatex(texFilePath, dir, baseName);
  if (local.success) return local;

  // 2️⃣ Try latexonline.cc (free, no auth needed)
  const online = await tryLatexOnline(texFilePath, dir, baseName);
  if (online.success) return online;

  // 3️⃣ Return manual instructions
  return {
    success: false,
    error: [
      `PDF compilation failed automatically. Options:`,
      ``,
      `Option 1 — Install MacTeX (one-time):`,
      `  brew install --cask mactex-no-gui`,
      `  Then re-run compile_resume_pdf`,
      ``,
      `Option 2 — Overleaf (manual, free):`,
      `  1. Go to https://overleaf.com → New Project → Blank Project`,
      `  2. Delete default content, paste contents of:`,
      `     ${texFilePath}`,
      `  3. Click Recompile → Download PDF`,
      `  4. Rename to: ${baseName}.pdf`,
      ``,
      `Your tailored .tex is ready at:`,
      `  ${texFilePath}`,
    ].join("\n"),
    method: "manual-instructions",
  };
}

// ─── Strategy 1: local pdflatex ───────────────────────────────────────────
async function tryPdflatex(
  texFilePath: string,
  dir: string,
  baseName: string
): Promise<CompileResult> {
  try {
    await execAsync("which pdflatex");
    await execAsync(`pdflatex -interaction=nonstopmode "${texFilePath}"`, { cwd: dir });
    await execAsync(`pdflatex -interaction=nonstopmode "${texFilePath}"`, { cwd: dir });

    const pdfPath = path.join(dir, `${baseName}.pdf`);
    if (fs.existsSync(pdfPath)) {
      // Clean up aux files
      for (const ext of [".aux", ".log", ".out"]) {
        const f = path.join(dir, `${baseName}${ext}`);
        if (fs.existsSync(f)) fs.unlinkSync(f);
      }
      return { success: true, pdfPath, method: "pdflatex" };
    }
    return { success: false, error: "pdflatex ran but PDF not found", method: "pdflatex" };
  } catch {
    return { success: false, error: "pdflatex not installed", method: "pdflatex" };
  }
}

// ─── Strategy 2: latexonline.cc (free public API) ─────────────────────────
async function tryLatexOnline(
  texFilePath: string,
  dir: string,
  baseName: string
): Promise<CompileResult> {
  try {
    const texContent = fs.readFileSync(texFilePath, "utf-8");

    const form = new FormData();
    form.append("file", Buffer.from(texContent), {
      filename: "resume.tex",
      contentType: "application/x-tex",
    });

    const response = await fetch(
      "https://latexonline.cc/data?command=pdflatex&force=true",
      {
        method: "POST",
        body: form,
        headers: form.getHeaders(),
        // 60s timeout
        signal: AbortSignal.timeout(60000),
      }
    );

    if (!response.ok) {
      return {
        success: false,
        error: `latexonline.cc responded with ${response.status}`,
        method: "latexonline",
      };
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/pdf")) {
      const body = await response.text();
      return {
        success: false,
        error: `latexonline.cc did not return PDF. Response: ${body.slice(0, 300)}`,
        method: "latexonline",
      };
    }

    const pdfBuffer = Buffer.from(await response.arrayBuffer());
    const pdfPath = path.join(dir, `${baseName}.pdf`);
    fs.writeFileSync(pdfPath, pdfBuffer);

    return { success: true, pdfPath, method: "latexonline" };
  } catch (err: any) {
    return {
      success: false,
      error: `latexonline.cc failed: ${err.message}`,
      method: "latexonline",
    };
  }
}
