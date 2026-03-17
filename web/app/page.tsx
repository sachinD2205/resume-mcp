"use client";

import { useEffect, useState } from "react";

type TailorResult = {
  tailoredLatex: string;
  atsScore: number;
  scoreBreakdown: string[];
  addedAsExposure: string[];
  keyChanges: string[];
};

type Step = "idle" | "tailoring" | "compiling" | "done" | "error";

export default function Home() {
  const [companyName, setCompanyName] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [baseLatex, setBaseLatex] = useState("");
  const [result, setResult] = useState<TailorResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [showLatex, setShowLatex] = useState(false);

  // Load base resume on mount
  useEffect(() => {
    fetch("/api/base-resume")
      .then((r) => r.json())
      .then((d) => { if (d.content) setBaseLatex(d.content); })
      .catch(() => {});
  }, []);

  async function handleGenerate() {
    if (!companyName.trim() || !jobDescription.trim() || !baseLatex.trim()) {
      setErrorMsg("Please fill in Company Name, Job Description, and Base Resume.");
      setStep("error");
      return;
    }

    setStep("tailoring");
    setErrorMsg("");
    setResult(null);
    setPdfUrl(null);

    try {
      // Step 1: Tailor
      const tailorRes = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, jobDescription, baseLatex }),
      });

      if (!tailorRes.ok) {
        let errMsg = "Tailoring failed";
        try {
          const e = await tailorRes.json();
          errMsg = e.error ?? errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const tailored: TailorResult = await tailorRes.json();
      setResult(tailored);

      // Step 2: Compile PDF
      setStep("compiling");

      const compileRes = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latex: tailored.tailoredLatex, companyName }),
      });

      if (!compileRes.ok) {
        let errMsg = "PDF compilation failed";
        try {
          const e = await compileRes.json();
          errMsg = e.error ?? errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      const pdfBlob = await compileRes.blob();
      const url = URL.createObjectURL(pdfBlob);
      setPdfUrl(url);
      setStep("done");
    } catch (err: any) {
      setErrorMsg(err.message ?? "Something went wrong");
      setStep("error");
    }
  }

  function handleDownload() {
    if (!pdfUrl) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    const safe = companyName.replace(/[^a-zA-Z0-9]/g, "_");
    a.download = `Sachin_Durge_${safe}.pdf`;
    a.click();
  }

  const isLoading = step === "tailoring" || step === "compiling";

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-sm font-bold">SD</div>
          <div>
            <h1 className="text-lg font-semibold leading-none">Resume Tailor</h1>
            <p className="text-xs text-gray-500 mt-0.5">Sachin Durge — ATS-optimized in seconds</p>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* LEFT — Input */}
        <section className="flex flex-col gap-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Job Details</h2>

          {/* Company Name */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-300">Company Name</label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Google, Razorpay, Swiggy"
              className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
            />
          </div>

          {/* Job Description */}
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-sm font-medium text-gray-300">Job Description</label>
            <textarea
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              placeholder="Paste the full job description here..."
              rows={12}
              className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none flex-1"
            />
          </div>

          {/* Base Resume Toggle */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-300">Base Resume (LaTeX)</label>
              <button
                onClick={() => setShowLatex((v) => !v)}
                className="text-xs text-blue-400 hover:text-blue-300 transition"
              >
                {showLatex ? "Hide" : "Edit"}
              </button>
            </div>
            {showLatex && (
              <textarea
                value={baseLatex}
                onChange={(e) => setBaseLatex(e.target.value)}
                rows={14}
                spellCheck={false}
                className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-xs font-mono text-gray-300 placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition resize-none"
              />
            )}
            {!showLatex && (
              <div className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-3 text-xs text-gray-600">
                {baseLatex ? `${baseLatex.split("\n").length} lines loaded — click Edit to modify` : "Loading..."}
              </div>
            )}
          </div>

          {/* Generate Button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-900 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 text-sm"
          >
            {isLoading ? (
              <>
                <Spinner />
                {step === "tailoring" ? "Tailoring with AI..." : "Compiling PDF..."}
              </>
            ) : (
              "Generate Resume"
            )}
          </button>

          {step === "error" && (
            <div className="bg-red-950 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-300">
              {errorMsg}
            </div>
          )}
        </section>

        {/* RIGHT — Results */}
        <section className="flex flex-col gap-6">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Results</h2>

          {!result && step !== "done" && (
            <div className="flex-1 bg-gray-900 border border-gray-800 border-dashed rounded-xl flex items-center justify-center min-h-64 text-gray-600 text-sm">
              Generated resume will appear here
            </div>
          )}

          {result && (
            <>
              {/* ATS Score */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-5">
                <div className="relative w-20 h-20 flex-shrink-0">
                  <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1f2937" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="15.9" fill="none"
                      stroke={result.atsScore >= 90 ? "#22c55e" : result.atsScore >= 75 ? "#eab308" : "#ef4444"}
                      strokeWidth="3"
                      strokeDasharray={`${result.atsScore} 100`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute inset-0 flex flex-col items-center justify-center leading-none">
                    <span className="text-lg font-bold">{result.atsScore}</span>
                    <span className="text-[9px] text-gray-500">/100</span>
                  </span>
                </div>
                <div>
                  <p className="font-semibold text-sm text-gray-200">ATS Score</p>
                  <p className={`text-xs mt-1 ${result.atsScore >= 90 ? "text-green-400" : result.atsScore >= 75 ? "text-yellow-400" : "text-red-400"}`}>
                    {result.atsScore >= 90 ? "Excellent match" : result.atsScore >= 75 ? "Good match" : "Needs improvement"}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {result.scoreBreakdown.map((b, i) => (
                      <li key={i} className="text-xs text-gray-400">• {b}</li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Key Changes */}
              {result.keyChanges.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Key Changes</h3>
                  <ul className="space-y-1.5">
                    {result.keyChanges.map((c, i) => (
                      <li key={i} className="text-sm text-gray-300 flex gap-2">
                        <span className="text-blue-400 mt-0.5">✓</span>
                        <span>{c}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Added as Exposure */}
              {result.addedAsExposure.length > 0 && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Added as Exposure</h3>
                  <div className="flex flex-wrap gap-2">
                    {result.addedAsExposure.map((s, i) => (
                      <span key={i} className="bg-gray-800 text-gray-300 text-xs px-2.5 py-1 rounded-full border border-gray-700">
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Tailored LaTeX */}
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Tailored LaTeX</h3>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(result.tailoredLatex);
                    }}
                    className="text-xs text-blue-400 hover:text-blue-300 transition"
                  >
                    Copy
                  </button>
                </div>
                <pre className="text-xs font-mono text-gray-400 overflow-auto max-h-40 whitespace-pre-wrap break-all">
                  {result.tailoredLatex.slice(0, 600)}...
                </pre>
              </div>

              {/* PDF Actions */}
              {step === "compiling" && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-3 text-sm text-gray-400">
                  <Spinner />
                  Compiling PDF via LaTeX...
                </div>
              )}

              {pdfUrl && (
                <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">PDF Ready</h3>
                  <iframe
                    src={pdfUrl}
                    className="w-full h-96 rounded-lg border border-gray-700"
                    title="Resume PDF Preview"
                  />
                  <button
                    onClick={handleDownload}
                    className="w-full bg-green-700 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition text-sm flex items-center justify-center gap-2"
                  >
                    Download PDF
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}
