import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const TAILORING_SYSTEM_PROMPT = `You are an expert resume writer for Sachin Durge, a Frontend Developer with 4+ years of experience.

## CONFIRMED FACTS — never change these
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
- Award: Certificate of Appreciation, Domo Inc. (2025) — Data Modeling Beta launch — ALWAYS keep this

## TAILORING RULES
1. Always target 90%+ ATS keyword match against the JD
2. Single page always — trim less relevant bullets if needed to fit
3. Each JD = fresh tailoring from the base resume — never carry over previous JD changes
4. UPDATE Summary to directly mirror the JD's job title and top requirements
5. REWRITE bullets using exact keywords and verb forms from the JD (e.g. if JD says "architect", use "architected")
6. REORDER bullets — most JD-relevant ones first
7. Skills NOT worked on but explored/studied → add as "X (exposure)" in skills — never claim full proficiency
8. Backend, DevOps, mobile experience user hasn't done → only mention as "exposure" if JD explicitly needs it
9. Do NOT add fake companies, fake projects, or fabricate metrics
10. QUANTIFY achievements wherever possible using existing numbers
11. Keep LaTeX syntax valid and compilable — preserve all custom commands
12. ATS style: accentblue section titles, \\textbullet bullets, \\setstretch{1.3} per item, \\vspace{6pt} between jobs
13. Add Namaste React certification ONLY if JD explicitly asks for certifications — otherwise never add it
14. Awards section: ALWAYS keep "Certificate of Appreciation, Domo Inc. (2025)"
15. After tailoring, rate the resume vs JD out of 100 with 2-3 bullet explanations

## SCORING CRITERIA
Rate based on: skill overlap, experience relevance, keyword alignment, seniority match, gaps/exposures
Target: 90+/100`;

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

    const response = await client.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      max_tokens: 8192,
      messages: [
        { role: "system", content: TAILORING_SYSTEM_PROMPT },
        {
          role: "user",
          content: `Tailor the base resume for this job at ${companyName}.

JOB DESCRIPTION:
${jobDescription}

BASE LATEX RESUME:
${baseLatex}

Return a JSON object with this exact structure:
{
  "tailoredLatex": "<complete valid LaTeX content>",
  "atsScore": 92,
  "scoreBreakdown": [
    "Strong overlap: React.js, TypeScript, Redux match JD exactly",
    "Added Bitbucket as confirmed tool (GIT/Bitbucket in JD)",
    "Minor gap: No mobile app builder experience"
  ],
  "addedAsExposure": ["skill1 (exposure)", "skill2 (exposure)"],
  "keyChanges": [
    "Summary updated to mirror 'Senior Frontend Developer' title",
    "Reordered Domo bullets to lead with component development"
  ]
}

Respond with ONLY the JSON object. No markdown fences.`,
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? "";
    const cleaned = text.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      return NextResponse.json({ error: "Could not parse AI response" }, { status: 500 });
    }

    const result = JSON.parse(jsonMatch[0]);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
