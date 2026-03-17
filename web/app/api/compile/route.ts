import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60; // Vercel: allow up to 60s for LaTeX compile

export async function POST(req: NextRequest) {
  try {
    const { latex, companyName } = await req.json();

    if (!latex) {
      return NextResponse.json({ error: "latex content is required" }, { status: 400 });
    }

    const formData = new FormData();
    const blob = new Blob([latex], { type: "application/x-tex" });
    formData.append("file", blob, "resume.tex");

    const response = await fetch(
      "https://latexonline.cc/data?command=pdflatex&force=true",
      {
        method: "POST",
        body: formData,
        signal: AbortSignal.timeout(90000),
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `LaTeX compile service error: ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/pdf")) {
      const body = await response.text();
      return NextResponse.json(
        { error: `Compile failed. Log: ${body.slice(0, 500)}` },
        { status: 422 }
      );
    }

    const pdfBuffer = await response.arrayBuffer();
    const safeCompany = (companyName ?? "Resume")
      .replace(/[^a-zA-Z0-9\s]/g, "")
      .replace(/\s+/g, "_");

    return new NextResponse(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Sachin_Durge_${safeCompany}.pdf"`,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? "Unknown error" }, { status: 500 });
  }
}
