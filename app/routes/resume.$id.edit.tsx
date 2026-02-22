import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { usePuterStore } from "~/lib/puter";

export const meta = () => [
  { title: "Resumind | Edit Resume" },
  { name: "description", content: "Edit your resume with AI suggestions" },
];

interface EditableSection {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  aiSuggestion?: string;
  score?: number;
  tips?: { type: "good" | "improve"; tip: string; explanation: string }[];
}

const ScorePill = ({ score }: { score: number }) => {
  const color = score >= 70 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";
  const bg = score >= 70 ? "#dcfce7" : score >= 50 ? "#fef3c7" : "#fee2e2";
  return (
    <span
      style={{ background: bg, color, border: `1.5px solid ${color}33` }}
      className="text-xs font-bold px-2 py-0.5 rounded-full ml-2 align-middle"
    >
      {score}/100
    </span>
  );
};

const TipCard = ({
  tip,
  onApply,
}: {
  tip: { type: "good" | "improve"; tip: string; explanation: string };
  onApply?: () => void;
}) => (
  <div
    className={`flex flex-col gap-1 rounded-xl px-4 py-3 text-sm ${tip.type === "good" ? "bg-green-50 border border-green-200 text-green-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}
  >
    <div className="flex items-center gap-2 font-semibold">
      <img
        src={tip.type === "good" ? "/icons/check.svg" : "/icons/warning.svg"}
        alt={tip.type}
        className="w-4 h-4"
      />
      {tip.tip}
    </div>
    <p className="opacity-80">{tip.explanation}</p>
    {tip.type === "improve" && onApply && (
      <button
        onClick={onApply}
        className="mt-1 text-xs self-start bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded-full transition-all font-semibold"
      >
        ✨ Apply Suggestion to Editor
      </button>
    )}
  </div>
);

const EditableResumePage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { kv, ai, isLoading, auth } = usePuterStore();

  const [sections, setSections] = useState<EditableSection[]>([]);
  const [resumeData, setResumeData] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info";
  } | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [generatingAI, setGeneratingAI] = useState<string | null>(null);
  const [expandedTips, setExpandedTips] = useState<Record<string, boolean>>({});

  const showToast = (
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    if (!isLoading && !auth.isAuthenticated)
      navigate(`/auth?next=/resume/${id}/edit`);
  }, [isLoading]);

  useEffect(() => {
    const loadData = async () => {
      const raw = await kv.get(`resume:${id}`);
      if (!raw) return;
      const data = JSON.parse(raw);
      setResumeData(data);

      const feedback: Feedback = data.feedback;
      const parsed = data.parsedContent || {};

      const initialSections: EditableSection[] = [
        {
          id: "summary",
          label: "Professional Summary",
          placeholder:
            "Write a compelling professional summary that highlights your key strengths, years of experience, and what you bring to the role...",
          value: parsed.summary || "",
          score: feedback?.content?.score,
          tips: feedback?.content?.tips,
        },
        {
          id: "experience",
          label: "Work Experience",
          placeholder: `List your work experience in reverse chronological order:\n\nJob Title — Company Name (Start Date – End Date)\n• Key achievement with measurable impact\n• Responsibility and outcome\n\nRepeat for each role...`,
          value: parsed.experience || "",
          score: feedback?.toneAndStyle?.score,
          tips: feedback?.toneAndStyle?.tips,
        },
        {
          id: "education",
          label: "Education",
          placeholder: `Degree, Major — University Name (Year)\nCGPA / Percentage (if notable)\n\nCertifications or relevant coursework...`,
          value: parsed.education || "",
          score: feedback?.structure?.score,
          tips: feedback?.structure?.tips,
        },
        {
          id: "skills",
          label: "Skills",
          placeholder:
            "List your technical and soft skills, e.g.:\nReact, TypeScript, Node.js, Python, SQL, Git\nProject Management, Team Leadership, Agile/Scrum",
          value: parsed.skills || "",
          score: feedback?.skills?.score,
          tips: feedback?.skills?.tips,
        },
        {
          id: "projects",
          label: "Projects (Optional)",
          placeholder: `Project Name — Tech Stack Used\n• Brief description of what you built and why\n• Impact, users, or notable metrics\n• GitHub/Live link if available`,
          value: parsed.projects || "",
        },
        {
          id: "certifications",
          label: "Certifications & Awards (Optional)",
          placeholder:
            "Certification Name — Issuing Body (Year)\nAward or recognition...",
          value: parsed.certifications || "",
        },
      ];
      setSections(initialSections);
    };
    if (id) loadData();
  }, [id]);

  const updateSection = (sectionId: string, value: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, value } : s))
    );
  };

  const applyAISuggestion = (sectionId: string, tipText: string) => {
    setSections((prev) =>
      prev.map((s) => {
        if (s.id !== sectionId) return s;
        const note = `\n\n[AI Suggestion: ${tipText}]`;
        return { ...s, value: s.value + note };
      })
    );
    showToast("Suggestion appended to editor!", "info");
    setActiveSection(sectionId);
  };

  const generateAIHelp = async (section: EditableSection) => {
    if (!resumeData) return;
    setGeneratingAI(section.id);
    try {
      const prompt = `You are a professional resume writer. The user is editing the "${section.label}" section of their resume for the role: "${resumeData.jobTitle || "the applied role"}" at "${resumeData.companyName || "a company"}".

Current content:
${section.value || "(empty)"}

Job Description:
${resumeData.jobDescription || "Not provided"}

Provide ONLY an improved version of this section content (no explanations, no headers, just the improved text). Make it ATS-friendly, impactful, and tailored to the job. Use bullet points where appropriate.`;

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

      setSections((prev) =>
        prev.map((s) =>
          s.id === section.id ? { ...s, aiSuggestion: text } : s
        )
      );
      showToast("AI suggestion ready!", "success");
    } catch (err) {
      showToast("Failed to generate AI suggestion.", "error");
    }
    setGeneratingAI(null);
  };

  const applyGeneratedSuggestion = (sectionId: string, aiText: string) => {
    setSections((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? { ...s, value: aiText, aiSuggestion: undefined }
          : s
      )
    );
    showToast("AI content applied!", "success");
  };

  const handleSave = async () => {
    if (!resumeData) return;
    setSaving(true);
    try {
      const parsedContent: Record<string, string> = {};
      sections.forEach((s) => {
        parsedContent[s.id] = s.value;
      });
      const updatedData = {
        ...resumeData,
        parsedContent,
        lastEdited: new Date().toISOString(),
      };
      await kv.set(`resume:${id}`, JSON.stringify(updatedData));
      showToast("Changes saved successfully!", "success");
    } catch (err) {
      showToast("Failed to save changes.", "error");
    }
    setSaving(false);
  };

  const handleOptimize = async () => {
    await handleSave();
    navigate(`/resume/${id}/optimize`);
  };

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
          className={`fixed left-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-semibold transition-all duration-500 transform -translate-x-1/2 ${toast ? "top-8 opacity-100 translate-y-0" : "top-0 opacity-0 -translate-y-8"} ${toast?.type === "error" ? "bg-red-500" : toast?.type === "success" ? "bg-green-500" : "bg-blue-500"}`}
          style={{ minWidth: "260px", maxWidth: "90vw", textAlign: "center" }}
        >
          {toast?.message}
        </div>
      </div>

      {/* Nav */}
      <nav className="resume-nav bg-white/80 backdrop-blur-md sticky top-0 z-40">
        <Link to={`/resume/${id}`} className="back-button">
          <img src="/icons/back.svg" alt="back" className="w-2.5 h-2.5" />
          <span className="text-gray-800 text-sm font-semibold">
            Back to Review
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500 font-medium">
            ✏️ Editing Resume
          </span>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 rounded-full text-sm font-semibold border border-gray-300 hover:bg-gray-100 transition-all disabled:opacity-60"
          >
            {saving ? "Saving..." : "💾 Save Draft"}
          </button>
          <button
            onClick={handleOptimize}
            className="px-5 py-2 rounded-full text-sm font-semibold text-white transition-all"
            style={{
              background: "linear-gradient(to bottom, #8e98ff, #606beb)",
            }}
          >
            🚀 Optimize Resume →
          </button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-8">
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
            Edit Your Resume
          </h1>
          <p className="text-gray-600 text-lg">
            Refine each section using AI suggestions from your analysis. Your
            edits are saved automatically.
          </p>
        </div>

        {/* Info banner */}
        <div className="mb-8 rounded-2xl border border-indigo-200 bg-indigo-50 px-6 py-4 flex items-start gap-4">
          <span className="text-2xl">💡</span>
          <div>
            <p className="font-semibold text-indigo-800 mb-1">
              How to use this editor
            </p>
            <p className="text-indigo-700 text-sm">
              Each section shows your AI feedback score and tips. Click{" "}
              <strong>Generate AI Content</strong> to get fully rewritten
              content for any section, or manually edit to apply the
              suggestions.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {sections.map((section) => (
            <div
              key={section.id}
              className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md"
            >
              {/* Section header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-bold text-gray-900">
                    {section.label}
                  </h2>
                  {section.score !== undefined && (
                    <ScorePill score={section.score} />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {section.tips && section.tips.length > 0 && (
                    <button
                      onClick={() =>
                        setExpandedTips((prev) => ({
                          ...prev,
                          [section.id]: !prev[section.id],
                        }))
                      }
                      className="text-sm text-indigo-600 font-semibold hover:text-indigo-800 transition-colors px-3 py-1 rounded-full border border-indigo-200 hover:bg-indigo-50"
                    >
                      {expandedTips[section.id]
                        ? "▲ Hide Tips"
                        : `▼ ${section.tips.length} Tips`}
                    </button>
                  )}
                  <button
                    onClick={() => generateAIHelp(section)}
                    disabled={generatingAI === section.id}
                    className="text-sm font-semibold text-white px-4 py-1.5 rounded-full transition-all disabled:opacity-60 flex items-center gap-1.5"
                    style={{
                      background:
                        generatingAI === section.id
                          ? "#a5b4fc"
                          : "linear-gradient(to right, #6366f1, #8b5cf6)",
                    }}
                  >
                    {generatingAI === section.id ? (
                      <>
                        <span className="animate-spin">⟳</span> Generating...
                      </>
                    ) : (
                      <>✨ Generate AI Content</>
                    )}
                  </button>
                </div>
              </div>

              {/* AI Tips */}
              {expandedTips[section.id] &&
                section.tips &&
                section.tips.length > 0 && (
                  <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex flex-col gap-3">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                      AI Feedback Tips
                    </p>
                    {section.tips.map((tip, i) => (
                      <TipCard
                        key={i}
                        tip={tip}
                        onApply={
                          tip.type === "improve"
                            ? () => applyAISuggestion(section.id, tip.tip)
                            : undefined
                        }
                      />
                    ))}
                  </div>
                )}

              {/* AI Generated Suggestion Banner */}
              {section.aiSuggestion && (
                <div className="px-6 py-4 bg-gradient-to-r from-violet-50 to-indigo-50 border-b border-indigo-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-semibold text-indigo-800 flex items-center gap-2">
                      <span>✨</span> AI Generated Version
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() =>
                          applyGeneratedSuggestion(
                            section.id,
                            section.aiSuggestion!
                          )
                        }
                        className="text-sm bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-full font-semibold transition-all"
                      >
                        ✅ Apply This
                      </button>
                      <button
                        onClick={() =>
                          setSections((prev) =>
                            prev.map((s) =>
                              s.id === section.id
                                ? { ...s, aiSuggestion: undefined }
                                : s
                            )
                          )
                        }
                        className="text-sm border border-gray-300 hover:bg-gray-100 px-3 py-1.5 rounded-full font-semibold transition-all text-gray-600"
                      >
                        ✕ Dismiss
                      </button>
                    </div>
                  </div>
                  <pre className="whitespace-pre-wrap text-sm text-indigo-900 bg-white/70 rounded-xl p-4 font-sans leading-relaxed border border-indigo-100">
                    {section.aiSuggestion}
                  </pre>
                </div>
              )}

              {/* Textarea */}
              <div className="px-6 py-4">
                <textarea
                  value={section.value}
                  onChange={(e) => updateSection(section.id, e.target.value)}
                  onFocus={() => setActiveSection(section.id)}
                  placeholder={section.placeholder}
                  rows={8}
                  className={`w-full p-4 rounded-2xl text-sm font-mono leading-relaxed resize-y focus:outline-none transition-all border ${activeSection === section.id ? "border-indigo-400 ring-2 ring-indigo-100" : "border-gray-200"}`}
                  style={{ background: "#fafbff", minHeight: "180px" }}
                />
                <div className="flex justify-between items-center mt-2">
                  <span className="text-xs text-gray-400">
                    {section.value.length} characters
                  </span>
                  {section.value && (
                    <button
                      onClick={() => {
                        if (confirm("Clear this section?"))
                          updateSection(section.id, "");
                      }}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-10 flex flex-col sm:flex-row gap-4 items-center justify-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-8 py-3 rounded-full font-semibold border-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-all text-base disabled:opacity-60"
          >
            {saving ? "Saving..." : "💾 Save All Changes"}
          </button>
          <button
            onClick={handleOptimize}
            className="px-10 py-3 rounded-full font-bold text-white text-base transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
          >
            🚀 Continue to Optimize →
          </button>
        </div>
      </div>
    </main>
  );
};

export default EditableResumePage;
