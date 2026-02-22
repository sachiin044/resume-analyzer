import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { usePuterStore } from "~/lib/puter";
import {
  generateLatexResume,
  compileLatexToPDF,
  downloadBlob,
} from "../../constants/latex";

export const meta = () => [
  { title: "Resumind | Optimized Resume" },
  {
    name: "description",
    content: "Your AI-optimized resume ready to download",
  },
];

// ─── Score display ─────────────────────────────────────────────────────────────
const ScoreRing = ({
  score,
  label,
  size = 80,
}: {
  score: number;
  label: string;
  size?: number;
}) => {
  const r = size * 0.42;
  const circ = 2 * Math.PI * r;
  const filled = circ * (score / 100);
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="flex flex-col items-center gap-1">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={size * 0.1}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={size * 0.1}
          strokeDasharray={circ}
          strokeDashoffset={circ - filled}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease" }}
        />
      </svg>
      <span className="font-bold text-lg" style={{ color }}>
        {score}
      </span>
      <span className="text-xs text-gray-500 text-center">{label}</span>
    </div>
  );
};

// ─── Resume print template ─────────────────────────────────────────────────────
const ResumeDocument = ({ data }: { data: any }) => {
  const fields = data.optimizedFields || {};

  const Section = ({ title, content }: { title: string; content: string }) => {
    if (!content?.trim()) return null;
    return (
      <div style={{ marginBottom: "18px" }}>
        <div
          style={{
            borderBottom: "2px solid #6366f1",
            paddingBottom: "3px",
            marginBottom: "8px",
            color: "#6366f1",
            fontWeight: 700,
            fontSize: "13px",
            letterSpacing: "1.5px",
            textTransform: "uppercase",
          }}
        >
          {title}
        </div>
        <div
          style={{
            whiteSpace: "pre-wrap",
            lineHeight: 1.6,
            fontSize: "12px",
            color: "#1f2937",
          }}
        >
          {content}
        </div>
      </div>
    );
  };

  return (
    <div
      id="resume-print"
      style={{
        fontFamily: "'Georgia', 'Times New Roman', serif",
        padding: "40px 48px",
        background: "#ffffff",
        color: "#1f2937",
        maxWidth: "794px",
        margin: "0 auto",
        minHeight: "1122px",
        boxSizing: "border-box",
      }}
    >
      {/* Header */}
      <div
        style={{
          textAlign: "center",
          marginBottom: "24px",
          borderBottom: "3px solid #6366f1",
          paddingBottom: "16px",
        }}
      >
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 800,
            color: "#111827",
            margin: 0,
            fontFamily: "Arial, sans-serif",
            letterSpacing: "-0.5px",
          }}
        >
          {fields.fullName || data.jobTitle || "Your Name"}
        </h1>
        {fields.contact && (
          <p
            style={{
              fontSize: "11px",
              color: "#6b7280",
              marginTop: "6px",
              lineHeight: 1.5,
              fontFamily: "Arial, sans-serif",
            }}
          >
            {fields.contact}
          </p>
        )}
        {(data.jobTitle || data.companyName) && (
          <div
            style={{
              display: "inline-block",
              marginTop: "8px",
              background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 600,
              padding: "3px 14px",
              borderRadius: "999px",
              fontFamily: "Arial, sans-serif",
            }}
          >
            Applying for: {data.jobTitle}
            {data.companyName ? ` at ${data.companyName}` : ""}
          </div>
        )}
      </div>

      {/* Body */}
      {fields.summary && (
        <Section title="Professional Summary" content={fields.summary} />
      )}
      {fields.experience && (
        <Section title="Work Experience" content={fields.experience} />
      )}
      {fields.education && (
        <Section title="Education" content={fields.education} />
      )}
      {fields.skills && (
        <Section title="Technical Skills" content={fields.skills} />
      )}
      {fields.projects && (
        <Section title="Projects" content={fields.projects} />
      )}
      {fields.certifications && (
        <Section
          title="Certifications & Awards"
          content={fields.certifications}
        />
      )}

      {/* Footer watermark */}
      <div
        style={{
          textAlign: "center",
          marginTop: "32px",
          fontSize: "9px",
          color: "#d1d5db",
          fontFamily: "Arial, sans-serif",
        }}
      >
        Generated by Resumind AI • ATS Score: {data.feedback?.overallScore || 0}
        /100
      </div>
    </div>
  );
};

// ─── Result Page ───────────────────────────────────────────────────────────────
const ResultPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { kv, isLoading, auth } = usePuterStore();
  const printRef = useRef<HTMLDivElement>(null);

  const [resumeData, setResumeData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [latexStatus, setLatexStatus] = useState<
    "idle" | "generating" | "compiling" | "done" | "error"
  >("idle");
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [scoreVisible, setScoreVisible] = useState(false);

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!isLoading && !auth.isAuthenticated)
      navigate(`/auth?next=/resume/${id}/result`);
  }, [isLoading]);

  useEffect(() => {
    const load = async () => {
      const raw = await kv.get(`resume:${id}`);
      if (!raw) {
        setLoading(false);
        return;
      }
      const data = JSON.parse(raw);
      setResumeData(data);
      setLoading(false);
      setTimeout(() => setScoreVisible(true), 300);
    };
    if (id) load();
  }, [id]);

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      // Use the browser's print dialog targeted at just the resume div
      const resumeEl = document.getElementById("resume-print");
      if (!resumeEl) throw new Error("Resume element not found");

      const printWindow = window.open("", "_blank", "width=900,height=1200");
      if (!printWindow) throw new Error("Popup blocked");

      printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${resumeData?.optimizedFields?.fullName || "Resume"} - Optimized Resume</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: white; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>
  ${resumeEl.outerHTML}
</body>
</html>`);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 500);
      showToast('Opening print dialog — choose "Save as PDF"!', "success");
    } catch (err) {
      console.error("Download error:", err);
      showToast(
        "Could not open print dialog. Try right-clicking the resume.",
        "error"
      );
    }
    setDownloading(false);
  };

  const handleCopyText = () => {
    if (!resumeData?.optimizedText) return;
    navigator.clipboard?.writeText(resumeData.optimizedText);
    showToast("Resume text copied to clipboard!", "success");
  };

  const handleLatexPDF = async () => {
    if (!resumeData?.optimizedFields) {
      showToast(
        "No optimized fields found. Generate an optimized resume first.",
        "error"
      );
      return;
    }
    const fields = resumeData.optimizedFields;
    const safeName = (fields.fullName || "resume")
      .toLowerCase()
      .replace(/\s+/g, "-");

    // Step 1 – generate LaTeX source
    setLatexStatus("generating");
    let latexSrc = "";
    try {
      latexSrc = generateLatexResume(
        fields,
        resumeData.jobTitle,
        resumeData.companyName
      );
    } catch (err) {
      setLatexStatus("error");
      showToast("Failed to generate LaTeX source.", "error");
      return;
    }

    // Step 2 – compile via texlive.net
    setLatexStatus("compiling");
    try {
      const pdfBlob = await compileLatexToPDF(latexSrc);
      downloadBlob(pdfBlob, `${safeName}-optimized.pdf`);
      setLatexStatus("done");
      showToast("LaTeX PDF downloaded successfully! 🎉", "success");
    } catch (compileErr) {
      console.warn(
        "LaTeX compilation failed, falling back to .tex download:",
        compileErr
      );
      // Fallback: download the .tex source
      const texBlob = new Blob([latexSrc], { type: "text/plain" });
      downloadBlob(texBlob, `${safeName}-optimized.tex`);
      setLatexStatus("error");
      showToast(
        "Compilation timed out — downloaded .tex file instead. Paste into overleaf.com to get PDF.",
        "info"
      );
    }
    setTimeout(() => setLatexStatus("idle"), 4000);
  };

  if (loading) {
    return (
      <main
        className="!pt-0 min-h-screen flex items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #f8f9ff, #eef2ff, #fdf4ff)",
        }}
      >
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-lg">
            Loading your optimized resume…
          </p>
        </div>
      </main>
    );
  }

  if (!resumeData) {
    return (
      <main className="!pt-0 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 text-xl mb-4">Resume not found.</p>
          <Link to="/" className="primary-button px-6">
            Go Home
          </Link>
        </div>
      </main>
    );
  }

  const feedback: Feedback = resumeData.feedback;
  const originalScore = resumeData.originalFeedback?.overallScore;
  const newScore = feedback?.overallScore || 0;
  const improvement = originalScore ? newScore - originalScore : null;

  return (
    <main
      className="!pt-0 min-h-screen"
      style={{
        background: "linear-gradient(135deg, #f0f4ff 0%, #fdf4ff 100%)",
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
        <Link
          to={`/resume/${resumeData.sourceResumeId || id}`}
          className="back-button"
        >
          <img src="/icons/back.svg" alt="back" className="w-2.5 h-2.5" />
          <span className="text-gray-800 text-sm font-semibold">
            Back to Original Review
          </span>
        </Link>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleCopyText}
            className="px-4 py-2 rounded-full text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition-all flex items-center gap-2"
          >
            📋 Copy Text
          </button>
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="px-5 py-2 rounded-full text-sm font-bold border-2 border-indigo-300 text-indigo-700 hover:bg-indigo-50 transition-all disabled:opacity-60 flex items-center gap-2"
          >
            {downloading ? (
              <>
                <span className="animate-spin">⟳</span> Opening…
              </>
            ) : (
              <>🖨️ HTML PDF</>
            )}
          </button>
          <button
            onClick={handleLatexPDF}
            disabled={
              latexStatus === "generating" || latexStatus === "compiling"
            }
            className="px-6 py-2 rounded-full text-sm font-bold text-white transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:opacity-60 flex items-center gap-2"
            style={{
              background:
                latexStatus === "done"
                  ? "linear-gradient(135deg,#22c55e,#16a34a)"
                  : latexStatus === "error"
                    ? "linear-gradient(135deg,#f59e0b,#d97706)"
                    : "linear-gradient(135deg, #6366f1, #8b5cf6)",
            }}
          >
            {latexStatus === "generating" ? (
              <>
                <span className="animate-spin">⟳</span> Building LaTeX…
              </>
            ) : latexStatus === "compiling" ? (
              <>
                <span className="animate-spin">⟳</span> Compiling PDF…
              </>
            ) : latexStatus === "done" ? (
              <>✅ PDF Downloaded!</>
            ) : latexStatus === "error" ? (
              <>⚠️ .tex Downloaded</>
            ) : (
              <>⬇️ LaTeX PDF</>
            )}
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 border border-green-300 rounded-full px-5 py-2 text-sm font-bold mb-4">
            ✅ Optimization Complete
          </div>
          <h1
            className="!text-3xl md:!text-4xl font-bold !leading-tight mb-2"
            style={{
              background: "linear-gradient(135deg, #6366f1, #8b5cf6, #ec4899)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            Your Optimized Resume is Ready!
          </h1>
          <p className="text-gray-500 text-lg">
            Download as PDF or copy the text. Review your new ATS score below.
          </p>
        </div>

        {/* Score comparison */}
        <div className="mb-8 rounded-3xl overflow-hidden shadow-lg border border-indigo-100">
          <div className="bg-white px-6 py-5 border-b border-gray-100 flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-indigo-500" />
            <h2 className="text-xl font-bold text-gray-900">New ATS Score</h2>
            {improvement !== null && improvement > 0 && (
              <span className="ml-2 text-sm bg-green-100 text-green-700 border border-green-300 px-3 py-0.5 rounded-full font-bold">
                +{improvement} points improvement 🎉
              </span>
            )}
          </div>
          <div className="bg-white px-6 py-6">
            <div
              className={`flex flex-wrap gap-6 items-center justify-center transition-all duration-700 ${scoreVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}
            >
              {/* Overall score */}
              <div className="flex flex-col items-center gap-2 px-6 py-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50">
                <p className="text-xs font-bold text-indigo-400 uppercase tracking-wider">
                  Overall
                </p>
                <ScoreRing score={newScore} label="Overall" size={96} />
                {originalScore !== undefined && (
                  <p className="text-xs text-gray-400">was {originalScore}</p>
                )}
              </div>
              <div className="h-16 w-px bg-gray-200 hidden sm:block" />
              {/* Category scores */}
              {[
                { label: "ATS", score: feedback?.ATS?.score || 0 },
                { label: "Content", score: feedback?.content?.score || 0 },
                {
                  label: "Tone & Style",
                  score: feedback?.toneAndStyle?.score || 0,
                },
                { label: "Structure", score: feedback?.structure?.score || 0 },
                { label: "Skills", score: feedback?.skills?.score || 0 },
              ].map(({ label, score }) => (
                <ScoreRing key={label} score={score} label={label} size={72} />
              ))}
            </div>
          </div>
        </div>

        {/* Two-column layout: resume + tips */}
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-8">
          {/* Resume Preview — spans 3 cols */}
          <div className="xl:col-span-3">
            <div className="bg-white rounded-3xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                  📄 Resume Preview
                </h2>
                <button
                  onClick={handleDownloadPDF}
                  disabled={downloading}
                  className="px-5 py-2 rounded-full text-sm font-bold text-white flex items-center gap-2 transition-all shadow hover:shadow-md disabled:opacity-60"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  }}
                >
                  ⬇️ Download PDF
                </button>
              </div>
              {/* Scrollable resume */}
              <div
                ref={printRef}
                className="overflow-auto"
                style={{ maxHeight: "800px", background: "#f8f9fa" }}
              >
                <div className="p-4">
                  <div className="shadow-md">
                    <ResumeDocument data={resumeData} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tips panel — spans 2 cols */}
          <div className="xl:col-span-2 flex flex-col gap-5">
            {/* ATS tips */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                <span className="text-xl">🎯</span>
                <h3 className="font-bold text-gray-900 text-base">
                  ATS Feedback
                </h3>
              </div>
              <div className="p-5 flex flex-col gap-3">
                {(feedback?.ATS?.tips || []).map((tip: any, i: number) => (
                  <div
                    key={i}
                    className={`flex gap-3 rounded-xl px-4 py-3 text-sm ${tip.type === "good" ? "bg-green-50 border border-green-200 text-green-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}
                  >
                    <img
                      src={
                        tip.type === "good"
                          ? "/icons/check.svg"
                          : "/icons/warning.svg"
                      }
                      alt={tip.type}
                      className="w-4 h-4 mt-0.5 flex-shrink-0"
                    />
                    <span>{tip.tip}</span>
                  </div>
                ))}
                {(!feedback?.ATS?.tips || feedback.ATS.tips.length === 0) && (
                  <p className="text-gray-400 text-sm text-center py-2">
                    No ATS tips available.
                  </p>
                )}
              </div>
            </div>

            {/* Other improvements */}
            {[
              { key: "content", label: "Content Tips", icon: "📝" },
              { key: "skills", label: "Skills Tips", icon: "⚡" },
              { key: "toneAndStyle", label: "Tone & Style", icon: "✍️" },
            ].map(({ key, label, icon }) => {
              const section = (feedback as any)?.[key];
              const improveTips =
                section?.tips?.filter((t: any) => t.type === "improve") || [];
              if (improveTips.length === 0) return null;
              return (
                <div
                  key={key}
                  className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden"
                >
                  <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <span className="text-xl">{icon}</span>
                    <h3 className="font-bold text-gray-900">{label}</h3>
                    <span className="ml-auto text-sm text-amber-600 font-semibold">
                      {section.score}/100
                    </span>
                  </div>
                  <div className="p-5 flex flex-col gap-3">
                    {improveTips.map((tip: any, i: number) => (
                      <div
                        key={i}
                        className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm"
                      >
                        <p className="font-semibold mb-1 flex items-center gap-1">
                          <img
                            src="/icons/warning.svg"
                            alt="improve"
                            className="w-4 h-4"
                          />
                          {tip.tip}
                        </p>
                        {tip.explanation && (
                          <p className="opacity-80">{tip.explanation}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Actions */}
            <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 flex flex-col gap-3">
              <h3 className="font-bold text-gray-900 mb-2">What to do next?</h3>
              <Link
                to={`/resume/${resumeData.sourceResumeId || id}/optimize`}
                className="w-full text-center px-5 py-3 rounded-full font-semibold text-indigo-600 border-2 border-indigo-200 hover:bg-indigo-50 transition-all text-sm"
              >
                🔄 Re-optimize with Changes
              </Link>
              <button
                onClick={handleLatexPDF}
                disabled={
                  latexStatus === "generating" || latexStatus === "compiling"
                }
                className="w-full px-5 py-3 rounded-full font-bold text-white transition-all disabled:opacity-60 text-sm flex items-center justify-center gap-2"
                style={{
                  background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                }}
              >
                {latexStatus === "generating" ? (
                  <>
                    <span className="animate-spin">⟳</span> Building LaTeX…
                  </>
                ) : latexStatus === "compiling" ? (
                  <>
                    <span className="animate-spin">⟳</span> Compiling…
                  </>
                ) : latexStatus === "done" ? (
                  <>✅ PDF Downloaded!</>
                ) : (
                  <>⬇️ Download LaTeX PDF</>
                )}
              </button>
              {/* Compilation status explainer */}
              {(latexStatus === "compiling" ||
                latexStatus === "generating") && (
                <p className="text-xs text-indigo-500 text-center -mt-1">
                  Compiling via texlive.net — may take ~15s…
                </p>
              )}
              {latexStatus === "error" && (
                <p className="text-xs text-amber-600 text-center -mt-1">
                  .tex file downloaded — paste into{" "}
                  <a
                    href="https://overleaf.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-semibold"
                  >
                    overleaf.com
                  </a>{" "}
                  to get the PDF.
                </p>
              )}
              <button
                onClick={handleDownloadPDF}
                className="w-full px-5 py-3 rounded-full font-semibold text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-50 transition-all text-sm"
              >
                🖨️ HTML PDF (Print)
              </button>
              <button
                onClick={handleCopyText}
                className="w-full px-5 py-3 rounded-full font-semibold text-gray-700 border border-gray-300 hover:bg-gray-100 transition-all text-sm"
              >
                📋 Copy Resume Text
              </button>
              <Link
                to="/"
                className="w-full text-center px-5 py-3 rounded-full font-semibold text-gray-500 hover:bg-gray-50 transition-all text-sm"
              >
                🏠 Back to Home
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ResultPage;
