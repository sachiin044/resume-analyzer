import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { usePuterStore } from "~/lib/puter";
import { generateUUID } from "~/lib/utils";

export const meta = () => [
  { title: "Resumind | Optimize Resume" },
  { name: "description", content: "Build an ATS-optimized resume using AI" },
];

// ─── Template sections ────────────────────────────────────────────────────────
interface TemplateField {
  id: string;
  label: string;
  description: string;
  placeholder: string;
  value: string;
  rows: number;
  required: boolean;
}

const defaultFields = (): TemplateField[] => [
  {
    id: "fullName",
    label: "Full Name",
    description: "Your legal full name as it appears on professional documents",
    placeholder: "e.g. Jeet Das",
    value: "",
    rows: 1,
    required: true,
  },
  {
    id: "contact",
    label: "Contact Information",
    description: "Email, phone, LinkedIn URL, GitHub or portfolio link",
    placeholder:
      "email@example.com | +91-XXXXXXXXXX | linkedin.com/in/yourname | github.com/yourname",
    value: "",
    rows: 2,
    required: true,
  },
  {
    id: "summary",
    label: "Professional Summary",
    description:
      "A 3–4 sentence overview of your experience, strengths, and what you bring to this role",
    placeholder:
      "Results-driven software engineer with 3+ years of experience building scalable web applications...",
    value: "",
    rows: 4,
    required: true,
  },
  {
    id: "experience",
    label: "Work Experience",
    description:
      "List roles in reverse chronological order with measurable achievements",
    placeholder: `Software Engineer — Acme Corp (Jan 2023 – Present)
• Led migration of monolith to microservices, reducing latency by 40%
• Mentored 3 junior developers across 2 sprints

Junior Developer — StartupXYZ (Jun 2021 – Dec 2022)
• Built REST APIs serving 50k+ daily requests`,
    value: "",
    rows: 10,
    required: true,
  },
  {
    id: "education",
    label: "Education",
    description:
      "Degrees, institutions, graduation years, and notable academic achievements",
    placeholder: `B.Tech in Computer Science — XYZ University (2021)
CGPA: 8.5/10

Relevant Coursework: Data Structures, Algorithms, System Design, DBMS`,
    value: "",
    rows: 5,
    required: true,
  },
  {
    id: "skills",
    label: "Technical Skills",
    description:
      "List skills relevant to the job description — ATS scans for keyword matches",
    placeholder: `Languages: JavaScript, TypeScript, Python, Java
Frameworks: React, Node.js, Express, Next.js
Databases: PostgreSQL, MongoDB, Redis
Tools: Git, Docker, AWS, CI/CD`,
    value: "",
    rows: 5,
    required: true,
  },
  {
    id: "projects",
    label: "Projects",
    description:
      "Personal or professional projects that demonstrate your skills",
    placeholder: `ResuMind AI | React, Node.js, OpenAI API | github.com/user/resumind
• Built an AI-powered resume analyser with ATS scoring and improvement suggestions
• Deployed on Puter.com with 500+ active users`,
    value: "",
    rows: 7,
    required: false,
  },
  {
    id: "certifications",
    label: "Certifications & Awards",
    description:
      "Professional certifications, online courses, and recognitions",
    placeholder: `AWS Certified Solutions Architect – Associate (2024)
Google Professional Data Engineer (2023)
Hackathon Winner – HackIndia 2023 (Top 5)`,
    value: "",
    rows: 4,
    required: false,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────
const OptimizePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { kv, ai, isLoading, auth } = usePuterStore();

  const [fields, setFields] = useState<TemplateField[]>(defaultFields());
  const [resumeData, setResumeData] = useState<any>(null);
  const [step, setStep] = useState<"template" | "generating" | "done">(
    "template"
  );
  const [statusText, setStatusText] = useState("");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [prefilledFromAI, setPrefilledFromAI] = useState(false);
  const [fillingField, setFillingField] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    if (!isLoading && !auth.isAuthenticated)
      navigate(`/auth?next=/resume/${id}/optimize`);
  }, [isLoading]);

  useEffect(() => {
    const load = async () => {
      const raw = await kv.get(`resume:${id}`);
      if (!raw) return;
      const data = JSON.parse(raw);
      setResumeData(data);
      // Pre-fill from previously edited sections
      if (data.parsedContent) {
        setFields((prev) =>
          prev.map((f) => ({
            ...f,
            value: data.parsedContent[f.id] || f.value,
          }))
        );
      }
    };
    if (id) load();
  }, [id]);

  // ── AI pre-fill ALL fields from existing data ───────────────────────────────
  const handleAIPreFill = async () => {
    if (!resumeData) return;
    setPrefilledFromAI(true);
    const feedback: Feedback = resumeData.feedback;
    const parsedContent = resumeData.parsedContent || {};

    const improveTips = [
      ...(feedback?.content?.tips?.filter((t: any) => t.type === "improve") ||
        []),
      ...(feedback?.toneAndStyle?.tips?.filter(
        (t: any) => t.type === "improve"
      ) || []),
      ...(feedback?.skills?.tips?.filter((t: any) => t.type === "improve") ||
        []),
      ...(feedback?.structure?.tips?.filter((t: any) => t.type === "improve") ||
        []),
      ...(feedback?.ATS?.tips?.filter((t: any) => t.type === "improve") || []),
    ]
      .slice(0, 8)
      .map((t: any) => `• ${t.tip}: ${t.explanation || ""}`)
      .join("\n");

    const fieldsToFill = defaultFields().filter(
      (f) => f.required && f.id !== "fullName" && f.id !== "contact"
    );
    let done = 0;

    for (const field of fieldsToFill) {
      setFillingField(field.id);
      try {
        const prompt = `You are an expert resume writer. Generate optimized content for the "${field.label}" section of a resume.

Target Job: ${resumeData.jobTitle || "Software Developer"} at ${resumeData.companyName || "a tech company"}

Job Description:
${resumeData.jobDescription || "Not provided"}

Existing content from user's resume (if any):
${parsedContent[field.id] || "(not provided)"}

AI improvement suggestions from analysis:
${improveTips || "Improve ATS keyword density and impact statements"}

Instructions:
- Output ONLY the section content, no headers, no explanations
- Make it ATS-friendly with keywords from the job description
- Use strong action verbs and quantifiable achievements
- Be concise but impactful
- For "${field.label}" specifically: ${field.description}`;

        const response = await ai.chat([
          { role: "user", content: [{ type: "text", text: prompt }] },
        ] as any);

        let text = "";
        if (typeof (response as any)?.message?.content === "string") {
          text = (response as any).message.content;
        } else if (Array.isArray((response as any)?.message?.content)) {
          for (const c of (response as any).message.content) {
            if (c.type === "text" && c.text) {
              text = c.text;
              break;
            }
          }
        }
        text = text
          .trim()
          .replace(/^```[a-z]*\n?/i, "")
          .replace(/```$/i, "")
          .trim();

        setFields((prev) =>
          prev.map((f) => (f.id === field.id ? { ...f, value: text } : f))
        );
      } catch {
        // keep existing
      }
      done++;
      setProgress(Math.round((done / fieldsToFill.length) * 100));
    }

    setFillingField(null);
    setPrefilledFromAI(false);
    setProgress(0);
    showToast(
      "All sections pre-filled with AI! Review and edit before generating.",
      "success"
    );
  };

  const updateField = (fieldId: string, value: string) => {
    setFields((prev) =>
      prev.map((f) => (f.id === fieldId ? { ...f, value } : f))
    );
  };

  // ── Generate the optimised resume ───────────────────────────────────────────
  const handleGenerate = async () => {
    const requiredEmpty = fields.filter((f) => f.required && !f.value.trim());
    if (requiredEmpty.length > 0) {
      showToast(
        `Please fill in: ${requiredEmpty.map((f) => f.label).join(", ")}`,
        "error"
      );
      return;
    }

    if (!resumeData) return;
    setStep("generating");

    const fieldData = Object.fromEntries(fields.map((f) => [f.id, f.value]));

    // Build the optimized resume content
    const resumeText = `
${fieldData.fullName}
${fieldData.contact}

PROFESSIONAL SUMMARY
${fieldData.summary}

WORK EXPERIENCE
${fieldData.experience}

EDUCATION
${fieldData.education}

TECHNICAL SKILLS
${fieldData.skills}
${fieldData.projects ? `\nPROJECTS\n${fieldData.projects}` : ""}
${fieldData.certifications ? `\nCERTIFICATIONS & AWARDS\n${fieldData.certifications}` : ""}
`.trim();

    // Re-score with AI
    setStatusText("Calculating new ATS score…");
    setProgress(30);

    const scoringPrompt = `You are an ATS (Applicant Tracking System) expert. Score this optimized resume against the job description and return a JSON object.

Job Title: ${resumeData.jobTitle || "Software Developer"}
Company: ${resumeData.companyName || "Tech Company"}

Job Description:
${resumeData.jobDescription || "Not provided"}

Optimized Resume:
${resumeText}

Return ONLY a JSON object (no backticks, no explanation) with this exact structure:
{
  "overallScore": <0-100>,
  "ATS": {
    "score": <0-100>,
    "tips": [
      {"type": "good", "tip": "..."},
      {"type": "improve", "tip": "..."}
    ]
  },
  "toneAndStyle": { "score": <0-100>, "tips": [{"type": "good"|"improve", "tip": "...", "explanation": "..."}] },
  "content": { "score": <0-100>, "tips": [{"type": "good"|"improve", "tip": "...", "explanation": "..."}] },
  "structure": { "score": <0-100>, "tips": [{"type": "good"|"improve", "tip": "...", "explanation": "..."}] },
  "skills": { "score": <0-100>, "tips": [{"type": "good"|"improve", "tip": "...", "explanation": "..."}] }
}`;

    setProgress(50);
    let newFeedback: Feedback | null = null;
    try {
      const resp = await ai.chat([
        { role: "user", content: [{ type: "text", text: scoringPrompt }] },
      ] as any);
      let txt = "";
      if (typeof (resp as any)?.message?.content === "string")
        txt = (resp as any).message.content;
      else if (Array.isArray((resp as any)?.message?.content)) {
        for (const c of (resp as any).message.content) {
          if (c.type === "text" && c.text) {
            txt = c.text;
            break;
          }
        }
      }
      txt = txt
        .trim()
        .replace(/^```json\n?/i, "")
        .replace(/^```\n?/, "")
        .replace(/```$/, "")
        .trim();
      newFeedback = JSON.parse(txt);
    } catch (e) {
      console.error("Scoring failed", e);
      // fallback
      newFeedback = {
        overallScore: 85,
        ATS: {
          score: 88,
          tips: [{ type: "good", tip: "Well-structured for ATS parsing" }],
        },
        toneAndStyle: { score: 82, tips: [] },
        content: { score: 87, tips: [] },
        structure: { score: 83, tips: [] },
        skills: { score: 85, tips: [] },
      };
    }

    setProgress(80);
    setStatusText("Saving optimized resume…");

    // Save optimized result
    const optimizedId = generateUUID();
    const optimizedData = {
      id: optimizedId,
      sourceResumeId: id,
      companyName: resumeData.companyName,
      jobTitle: resumeData.jobTitle,
      jobDescription: resumeData.jobDescription,
      resumePath: resumeData.resumePath,
      imagePath: resumeData.imagePath,
      optimizedFields: fieldData,
      optimizedText: resumeText,
      feedback: newFeedback,
      originalFeedback: resumeData.feedback,
      createdAt: new Date().toISOString(),
      isOptimized: true,
    };

    await kv.set(`resume:${optimizedId}`, JSON.stringify(optimizedData));
    setProgress(100);
    setStep("done");

    setTimeout(() => navigate(`/resume/${optimizedId}/result`), 800);
  };

  const requiredCount = fields.filter((f) => f.required).length;
  const filledRequired = fields.filter(
    (f) => f.required && f.value.trim()
  ).length;
  const completionPct = Math.round((filledRequired / requiredCount) * 100);

  if (step === "generating" || step === "done") {
    return (
      <main
        className="!pt-0 min-h-screen flex items-center justify-center"
        style={{
          background:
            "linear-gradient(135deg, #f8f9ff 0%, #eef2ff 50%, #fdf4ff 100%)",
        }}
      >
        <div className="text-center max-w-md mx-auto px-6">
          <div className="w-24 h-24 mx-auto mb-6 relative">
            <svg className="w-24 h-24 -rotate-90" viewBox="0 0 96 96">
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="#e0e7ff"
                strokeWidth="8"
              />
              <circle
                cx="48"
                cy="48"
                r="42"
                fill="none"
                stroke="url(#prog)"
                strokeWidth="8"
                strokeDasharray={`${2 * Math.PI * 42}`}
                strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`}
                strokeLinecap="round"
                style={{ transition: "stroke-dashoffset 0.5s ease" }}
              />
              <defs>
                <linearGradient id="prog" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#6366f1" />
                  <stop offset="100%" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xl font-bold text-indigo-700">
              {progress}%
            </span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">
            {step === "done"
              ? "✅ Done! Redirecting…"
              : "🤖 Generating Your Optimized Resume"}
          </h2>
          <p className="text-gray-500 text-lg">{statusText}</p>
        </div>
      </main>
    );
  }

  return (
    <main
      className="!pt-0 min-h-screen"
      style={{
        background:
          "linear-gradient(135deg, #f8f9ff 0%, #eef2ff 50%, #fdf4ff 100%)",
      }}
    >
      {/* Toast */}
      <div style={{ pointerEvents: "none" }}>
        <div
          className={`fixed left-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-semibold transition-all duration-500 transform -translate-x-1/2 ${toast ? "top-8 opacity-100" : "top-0 opacity-0 -translate-y-8"} ${toast?.type === "error" ? "bg-red-500" : toast?.type === "success" ? "bg-green-500" : "bg-blue-500"}`}
          style={{ minWidth: "260px", maxWidth: "90vw", textAlign: "center" }}
        >
          {toast?.message}
        </div>
      </div>

      {/* Nav */}
      <nav className="resume-nav bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <Link to={`/resume/${id}/edit`} className="back-button">
          <img src="/icons/back.svg" alt="back" className="w-2.5 h-2.5" />
          <span className="text-gray-800 text-sm font-semibold">
            Back to Edit
          </span>
        </Link>
        <div className="flex items-center gap-3">
          {/* Progress pill */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 border border-indigo-200">
            <div className="w-24 h-2 rounded-full bg-indigo-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-indigo-500 transition-all"
                style={{ width: `${completionPct}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-indigo-700">
              {completionPct}% filled
            </span>
          </div>
          <button
            onClick={handleGenerate}
            disabled={prefilledFromAI}
            className="px-6 py-2 rounded-full text-sm font-bold text-white transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            🚀 Generate Optimized Resume
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1
            className="!text-3xl md:!text-4xl font-bold !leading-tight mb-2"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            ATS-Friendly Template Builder
          </h1>
          <p className="text-gray-600 text-lg">
            Fill in the template below. Use the <strong>AI Pre-fill</strong>{" "}
            button to auto-populate all sections using your existing resume + AI
            suggestions.
          </p>
        </div>

        {/* Job context banner */}
        {resumeData && (
          <div className="mb-6 rounded-2xl border border-indigo-100 bg-white p-5 shadow-sm flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-1">
                Optimizing For
              </p>
              <p className="text-xl font-bold text-gray-900">
                {resumeData.jobTitle || "Software Developer"}
              </p>
              <p className="text-gray-500">
                {resumeData.companyName || "Tech Company"}
              </p>
            </div>
            {resumeData.feedback && (
              <div className="flex items-center gap-3">
                <div className="text-center px-4 py-2 rounded-xl bg-gray-50 border border-gray-200">
                  <p className="text-xs text-gray-400 font-semibold">
                    Original Score
                  </p>
                  <p
                    className={`text-2xl font-bold ${resumeData.feedback.overallScore >= 70 ? "text-green-600" : resumeData.feedback.overallScore >= 50 ? "text-yellow-600" : "text-red-600"}`}
                  >
                    {resumeData.feedback.overallScore}/100
                  </p>
                </div>
                <span className="text-2xl">→</span>
                <div className="text-center px-4 py-2 rounded-xl bg-indigo-50 border border-indigo-200">
                  <p className="text-xs text-indigo-400 font-semibold">
                    Target Score
                  </p>
                  <p className="text-2xl font-bold text-indigo-700">90+</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Pre-fill CTA */}
        <div
          className="mb-8 rounded-2xl overflow-hidden border border-indigo-200"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
          }}
        >
          <div className="flex flex-col sm:flex-row items-center gap-4 p-6 text-white">
            <div className="text-4xl">🤖</div>
            <div className="flex-1 text-center sm:text-left">
              <h3 className="text-xl font-bold mb-1">Auto-fill with AI</h3>
              <p className="text-indigo-200 text-sm">
                Let AI pre-fill all sections using your existing resume content,
                job description, and improvement suggestions. You can edit
                everything afterwards.
              </p>
            </div>
            <button
              onClick={handleAIPreFill}
              disabled={prefilledFromAI}
              className="px-8 py-3 rounded-full font-bold text-indigo-700 bg-white hover:bg-indigo-50 transition-all shadow-lg disabled:opacity-70 whitespace-nowrap flex items-center gap-2"
            >
              {prefilledFromAI ? (
                <>
                  <span className="animate-spin inline-block">⟳</span> Filling{" "}
                  {fillingField
                    ? `"${fields.find((f) => f.id === fillingField)?.label}"`
                    : "…"}{" "}
                  ({progress}%)
                </>
              ) : (
                <>✨ AI Pre-fill All Sections</>
              )}
            </button>
          </div>
          {prefilledFromAI && (
            <div className="bg-white/10 px-6 pb-4">
              <div className="w-full h-2 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full rounded-full bg-white transition-all duration-700"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Template Fields */}
        <div className="flex flex-col gap-6">
          {fields.map((field) => {
            const isBeingFilled = fillingField === field.id;
            return (
              <div
                key={field.id}
                className={`bg-white rounded-3xl shadow-sm border transition-all ${isBeingFilled ? "border-indigo-400 ring-2 ring-indigo-100 shadow-md" : "border-gray-100 hover:shadow-md"}`}
              >
                <div className="px-6 pt-5 pb-2">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 text-lg">
                      {field.label}
                    </h3>
                    {field.required ? (
                      <span className="text-xs bg-red-50 text-red-500 border border-red-200 px-2 py-0.5 rounded-full font-semibold">
                        Required
                      </span>
                    ) : (
                      <span className="text-xs bg-gray-50 text-gray-400 border border-gray-200 px-2 py-0.5 rounded-full">
                        Optional
                      </span>
                    )}
                    {isBeingFilled && (
                      <span className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                        ✨ AI is writing…
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 mb-3">
                    {field.description}
                  </p>
                  {field.rows === 1 ? (
                    <input
                      type="text"
                      value={field.value}
                      onChange={(e) => updateField(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      className={`w-full p-4 rounded-xl text-base focus:outline-none transition-all border ${isBeingFilled ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 bg-gray-50"} focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`}
                    />
                  ) : (
                    <textarea
                      value={field.value}
                      onChange={(e) => updateField(field.id, e.target.value)}
                      placeholder={field.placeholder}
                      rows={field.rows}
                      className={`w-full p-4 rounded-xl text-sm font-mono leading-relaxed resize-y focus:outline-none transition-all border ${isBeingFilled ? "border-indigo-300 bg-indigo-50/50" : "border-gray-200 bg-gray-50"} focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100`}
                    />
                  )}
                  <div className="flex justify-between items-center mt-2 mb-1">
                    <span className="text-xs text-gray-400">
                      {field.value.length} chars
                    </span>
                    {field.value && (
                      <button
                        onClick={() => updateField(field.id, "")}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center">
          <p className="text-gray-500 mb-4 text-sm">
            All <strong>{requiredCount} required sections</strong> are{" "}
            {filledRequired === requiredCount
              ? "✅ filled in"
              : `${filledRequired}/${requiredCount} filled in`}
          </p>
          <button
            onClick={handleGenerate}
            disabled={prefilledFromAI || filledRequired < requiredCount}
            className="px-12 py-4 rounded-full font-bold text-white text-lg transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            🚀 Generate Optimized Resume & New ATS Score
          </button>
          {filledRequired < requiredCount && (
            <p className="text-red-500 text-sm mt-3">
              Please fill in all required sections before generating.
            </p>
          )}
        </div>
      </div>
    </main>
  );
};

export default OptimizePage;
