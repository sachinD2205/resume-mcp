import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

export const maxDuration = 60; // Vercel: allow up to 60s for two Groq calls

const CONFIRMED_FACTS = `## CONFIRMED FACTS — never change these
- Name: Sachin Durge
- Phone: +91 8275972494
- Email: mrsachindurge@gmail.com
- LinkedIn: linkedin.com/in/mrsachindurge
- GitHub: github.com/sachinD2205
- Location: Pune, Maharashtra
- Experience: 4+ years (NOT 6, NOT 5)
- Domo Inc: Jan 2025 – Present (React Query / TanStack Query used here ✓, Vite used here ✓)
- Probity Software: Feb 2022 – Jan 2025 (Vite used here ✓, React Query NOT used here — do not add it)
- Education: MCA from Yashwantrao Chavan College of Science, Karad — CGPA 9.1/10, May 2022
- Award: Certificate of Appreciation, Domo Inc. (2025) — Data Modeling Beta launch — ALWAYS keep this`;

const TAILORING_RULES = `## TAILORING RULES
1. Always target 90%+ ATS keyword match against the JD
2. Single page always — trim less relevant bullets if needed to fit
3. Each JD = fresh tailoring from the base resume — never carry over previous JD changes
4. UPDATE Summary to directly mirror the JD's job title and top requirements
5. REWRITE bullets using exact keywords and verb forms from the JD
6. REORDER bullets — most JD-relevant ones first
7. Skills NOT worked on but explored/studied → add as "X (exposure)" in skills — never claim full proficiency
8. Do NOT add fake companies, fake projects, or fabricate metrics
9. QUANTIFY achievements wherever possible using existing numbers
10. Keep LaTeX syntax valid and compilable — preserve all custom commands
11. Awards section: ALWAYS keep "Certificate of Appreciation, Domo Inc. (2025)"`;

export async function POST(req: NextRequest) {
  try {
    const { jobDescription, companyName, baseLatex } = await req.json();

    if (!jobDescription || !companyName || !baseLatex) {
      return NextResponse.json(
        { error: "jobDescription, companyName, and baseLatex are required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "GROQ_API_KEY not configured" }, { status: 500 });
    }

    const client = new Groq({ apiKey });
    const context = `${CONFIRMED_FACTS}\n\n${TAILORING_RULES}`;

    // ── Call 1: Get tailored LaTeX as plain text (no JSON, avoids escape issues) ──
    const latexResponse = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8192,
      messages: [
        {
          role: "system",
          content: `You are an expert resume writer for Sachin Durge, a Frontend Developer with 4+ years of experience.\n\n${context}\n\nReturn ONLY the complete tailored LaTeX document. No explanation, no markdown fences, no JSON. Just raw LaTeX starting with \\documentclass.`,
        },
        {
          role: "user",
          content: `Tailor this resume for the job at ${companyName}.\n\nJOB DESCRIPTION:\n${jobDescription}\n\nBASE LATEX RESUME:\n${baseLatex}`,
        },
      ],
    });

    let tailoredLatex = latexResponse.choices[0]?.message?.content ?? "";
    // Strip any accidental markdown fences
    tailoredLatex = tailoredLatex.replace(/^```(?:latex|tex)?\n?/i, "").replace(/\n?```$/i, "").trim();

    // ── Call 2: Get metadata (ATS score, changes) as clean JSON ──
    const metaResponse = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 1024,
      messages: [
        {
          role: "system",
          content: `You are an expert ATS resume scorer. Rate based on: skill overlap, experience relevance, keyword alignment, seniority match. Target: 90+/100. Return ONLY valid JSON, no markdown.`,
        },
        {
          role: "user",
          content: `Score this tailored resume against the job description at ${companyName} and list key changes made.

JOB DESCRIPTION:
${jobDescription}

TAILORED RESUME (LaTeX):
${tailoredLatex}

Return ONLY this JSON (no markdown fences, no extra text):
{
  "atsScore": 92,
  "scoreBreakdown": ["reason1", "reason2", "reason3"],
  "addedAsExposure": ["skill1 (exposure)"],
  "keyChanges": ["change1", "change2", "change3"]
}`,
        },
      ],
    });

    const metaText = metaResponse.choices[0]?.message?.content ?? "";
    const metaCleaned = metaText.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const metaMatch = metaCleaned.match(/\{[\s\S]*\}/);

    let meta = { atsScore: 0, scoreBreakdown: [], addedAsExposure: [], keyChanges: [] };
    if (metaMatch) {
      try {
        meta = JSON.parse(metaMatch[0]);
      } catch {
        // metadata parse failed — return zeros, LaTeX is still valid
      }
    }

    return NextResponse.json({ tailoredLatex, ...meta });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
