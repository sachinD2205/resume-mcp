import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import * as path from "path";
import * as fs from "fs";
import * as dotenv from "dotenv";

import { tailorResume, saveTailoredLatex } from "./tools/tailorResume";
import { compileToPdf } from "./tools/compilePdf";

dotenv.config();

const BASE_RESUME_PATH = path.join(__dirname, "templates", "base_resume.tex");
const OUTPUT_DIR = path.join(__dirname, "..", "output");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const server = new McpServer({
  name: "resume-mcp",
  version: "2.0.0",
});

// ─── TOOL 1: Tailor + Compile (one-shot pipeline) ─────────────────────────
// @ts-ignore
server.registerTool(
  "prepare_resume",
  {
    description:
      "Full pipeline: paste a JD → get a tailored PDF resume named Sachin_Durge_Frontend_Developer_Resume_CompanyName.pdf. Targets 90%+ ATS match.",
    inputSchema: {
      jobDescription: z
        .string()
        .describe("Full job description text"),
      companyName: z
        .string()
        .describe("Company name (used in the PDF filename, e.g. 'AppMySite')"),
    },
  },
  async ({ jobDescription, companyName }) => {
    try {
      // Step 1: Tailor with Claude
      const result = await tailorResume(BASE_RESUME_PATH, jobDescription, companyName);

      // Step 2: Save .tex
      const texPath = saveTailoredLatex(result.tailoredLatex, OUTPUT_DIR, companyName);

      // Step 3: Compile to PDF
      const compile = await compileToPdf(texPath);

      const response: Record<string, any> = {
        status: "success",
        company: companyName,
        atsScore: `${result.atsScore}/100`,
        scoreBreakdown: result.scoreBreakdown,
        keyChanges: result.keyChanges,
        addedAsExposure: result.addedAsExposure,
        texFile: texPath,
      };

      if (compile.success) {
        response.pdfFile = compile.pdfPath;
        response.compiledVia = compile.method;
        response.message = `✅ PDF ready: ${compile.pdfPath}`;
      } else {
        response.pdfStatus = "compilation_failed";
        response.instructions = compile.error;
        response.message = "Resume tailored ✅ | PDF needs manual compile (see instructions)";
      }

      return {
        content: [{ type: "text", text: JSON.stringify(response, null, 2) }],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── TOOL 2: Tailor only (returns LaTeX, no compile) ──────────────────────
// @ts-ignore
server.registerTool(
  "tailor_resume_only",
  {
    description:
      "Tailor the base resume for a JD and return the LaTeX + ATS score. Does NOT compile to PDF.",
    inputSchema: {
      jobDescription: z.string().describe("Full job description text"),
      companyName: z.string().describe("Company name"),
    },
  },
  async ({ jobDescription, companyName }) => {
    try {
      const result = await tailorResume(BASE_RESUME_PATH, jobDescription, companyName);
      const texPath = saveTailoredLatex(result.tailoredLatex, OUTPUT_DIR, companyName);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                atsScore: `${result.atsScore}/100`,
                scoreBreakdown: result.scoreBreakdown,
                keyChanges: result.keyChanges,
                addedAsExposure: result.addedAsExposure,
                texFile: texPath,
                latex: result.tailoredLatex,
              },
              null,
              2
            ),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── TOOL 3: Compile an existing .tex to PDF ──────────────────────────────
// @ts-ignore
server.registerTool(
  "compile_resume_pdf",
  {
    description:
      "Compile an existing tailored .tex file to PDF (tries pdflatex first, then latexonline.cc).",
    inputSchema: {
      texFilePath: z.string().describe("Absolute path to the .tex file"),
    },
  },
  async ({ texFilePath }) => {
    try {
      const result = await compileToPdf(texFilePath);

      if (result.success) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  status: "success",
                  pdfPath: result.pdfPath,
                  method: result.method,
                  message: `PDF ready: ${result.pdfPath}`,
                },
                null,
                2
              ),
            },
          ],
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ status: "failed", instructions: result.error }, null, 2),
            },
          ],
        };
      }
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── TOOL 4: List all generated resumes ───────────────────────────────────
// @ts-ignore
server.registerTool(
  "list_resumes",
  {
    description: "List all generated resumes (.tex and .pdf) in the output folder.",
  },
  async () => {
    try {
      const files = fs
        .readdirSync(OUTPUT_DIR)
        .filter((f) => f.endsWith(".tex") || f.endsWith(".pdf"))
        .map((f) => {
          const stat = fs.statSync(path.join(OUTPUT_DIR, f));
          return {
            name: f,
            path: path.join(OUTPUT_DIR, f),
            sizeKB: Math.round(stat.size / 1024),
            created: stat.birthtime.toISOString().slice(0, 10),
          };
        })
        .sort((a, b) => b.created.localeCompare(a.created));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ outputDir: OUTPUT_DIR, count: files.length, files }, null, 2),
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── TOOL 5: Update base resume ───────────────────────────────────────────
// @ts-ignore
server.registerTool(
  "update_base_resume",
  {
    description:
      "Replace the master base_resume.tex with new content. Use this when confirmed facts change (new job, new award, etc.).",
    inputSchema: {
      latexContent: z.string().describe("Complete new LaTeX content for the base resume"),
    },
  },
  async ({ latexContent }) => {
    try {
      fs.writeFileSync(BASE_RESUME_PATH, latexContent, "utf-8");
      return {
        content: [
          {
            type: "text",
            text: `Base resume updated at: ${BASE_RESUME_PATH}`,
          },
        ],
      };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Error: ${err.message}` }],
        isError: true,
      };
    }
  }
);

// ─── Start server ──────────────────────────────────────────────────────────
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("resume-mcp server running on stdio");
}

main().catch(console.error);
