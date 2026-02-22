// ─── LaTeX resume generator ────────────────────────────────────────────────────
// Uses the same preamble + command structure as the user's hand-written template.
// Fills sections from the AI-optimised fields stored in Puter KV.

/** Escape special LaTeX characters so plain text can be embedded safely. */
export function escapeLaTeX(str: string | undefined | null): string {
  if (!str) return "";
  return str
    .replace(/\\/g, "\\textbackslash{}")
    .replace(/&/g, "\\&")
    .replace(/%/g, "\\%")
    .replace(/\$/g, "\\$")
    .replace(/#/g, "\\#")
    .replace(/_/g, "\\_")
    .replace(/\{/g, "\\{")
    .replace(/\}/g, "\\}")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}");
}

/**
 * Convert a plain-text multi-line block into LaTeX bullet items.
 * Lines starting with •, -, or * become \item bullets.
 * Other non-empty lines are rendered as plain paragraphs.
 */
function blockToLatex(block: string): string {
  if (!block?.trim()) return "";
  return block
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const isBullet = /^[•\-\*]/.test(line);
      const text = escapeLaTeX(line.replace(/^[•\-\*]\s*/, ""));
      return isBullet ? `  \\item ${text}` : text;
    })
    .join("\n");
}

/**
 * Parse the "Work Experience" free-text field into structured job entries.
 *
 * Expected format per job (separated by blank lines):
 *   Job Title — Company (Start – End)
 *   • Bullet one
 *   • Bullet two
 */
interface JobEntry {
  title: string;
  company: string;
  dates: string;
  bullets: string[];
}

function parseExperience(raw: string): JobEntry[] {
  if (!raw?.trim()) return [];
  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const jobs: JobEntry[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    // First line: "Title — Company (Dates)" or "Title — Company | Dates"
    const header = lines[0];
    const dateMatch =
      header.match(/\(([^)]+)\)\s*$/) ||
      header.match(/[|–\-]\s*([A-Z][a-z]+\s+\d{4}.*)$/);
    const dates = dateMatch ? dateMatch[1].trim() : "";
    const withoutDates = header.replace(dateMatch?.[0] || "", "").trim();

    // Split on em dash —, or "at", or " - "
    const parts = withoutDates.split(/\s+(?:—|at)\s+|(?<=\S)\s+-\s+(?=\S)/);
    const title = parts[0]?.trim() || withoutDates;
    const company = parts[1]?.trim() || "";

    const bullets = lines
      .slice(1)
      .filter((l) => /^[•\-\*]/.test(l))
      .map((l) => l.replace(/^[•\-\*]\s*/, "").trim());

    jobs.push({ title, company, dates, bullets });
  }
  return jobs;
}

/**
 * Parse the "Education" free-text field into structured entries.
 *
 * Expected format per entry:
 *   Degree, Major — University Name (Year)
 *   GPA / Percentage / extra info
 */
interface EduEntry {
  degree: string;
  institution: string;
  dates: string;
  extra: string;
}

function parseEducation(raw: string): EduEntry[] {
  if (!raw?.trim()) return [];
  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const entries: EduEntry[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    const header = lines[0];
    const dateMatch =
      header.match(/\(([^)]+)\)\s*$/) ||
      header.match(/(\d{4}\s*[-–]\s*(?:\d{4}|Present|Ongoing))/i);
    const dates = dateMatch ? dateMatch[1].trim() : "";
    const withoutDates = header.replace(dateMatch?.[0] || "", "").trim();
    const parts = withoutDates.split(/\s+(?:—|at)\s+|(?<=\S)\s+-\s+(?=\S)/);
    const degree = parts[0]?.trim() || withoutDates;
    const institution = parts[1]?.trim() || "";
    const extra = lines.slice(1).join(" ");

    entries.push({ degree, institution, dates, extra });
  }
  return entries;
}

/**
 * Parse the "Projects" free-text field into structured entries.
 *
 * Expected format per project:
 *   Project Name | Tech Stack | Date
 *   • Description line
 *   Tech: ...  /  Live: ...  /  GitHub: ...
 */
interface ProjectEntry {
  name: string;
  date: string;
  tech: string;
  description: string;
  live: string;
  github: string;
}

function parseProjects(raw: string): ProjectEntry[] {
  if (!raw?.trim()) return [];
  const blocks = raw
    .split(/\n{2,}/)
    .map((b) => b.trim())
    .filter(Boolean);
  const projects: ProjectEntry[] = [];

  for (const block of blocks) {
    const lines = block
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) continue;

    const header = lines[0];
    const dateMatch = header.match(/[|–]\s*([A-Z][a-z]+\s+\d{4})/);
    const date = dateMatch ? dateMatch[1] : "";

    // Extract tech, live, github from body lines
    let tech = "",
      live = "",
      github = "";
    const descLines: string[] = [];

    for (const line of lines.slice(1)) {
      if (/^[Tt]ech[:\s]/i.test(line))
        tech = line.replace(/^[Tt]ech[:\s]*/i, "").trim();
      else if (/^[Ll]ive[:\s]/i.test(line))
        live = line.replace(/^[Ll]ive[:\s]*/i, "").trim();
      else if (/^[Gg]it[Hh]ub[:\s]/i.test(line))
        github = line.replace(/^[Gg]it[Hh]ub[:\s]*/i, "").trim();
      else descLines.push(line.replace(/^[•\-\*]\s*/, ""));
    }

    const name = header
      .replace(dateMatch?.[0] || "", "")
      .replace(/\|.*$/, "")
      .trim();

    projects.push({
      name,
      date,
      tech,
      description: descLines.join(" "),
      live,
      github,
    });
  }
  return projects;
}

/** Parse skill lines like "Category: skill1, skill2, ..." into key/value pairs. */
function parseSkills(raw: string): { category: string; skills: string }[] {
  if (!raw?.trim()) return [];
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const colon = line.indexOf(":");
      if (colon === -1) return { category: "Others", skills: line };
      return {
        category: line.slice(0, colon).trim(),
        skills: line.slice(colon + 1).trim(),
      };
    });
}

interface ResumeFields {
  fullName?: string;
  contact?: string;
  summary?: string;
  experience?: string;
  education?: string;
  skills?: string;
  projects?: string;
  certifications?: string;
}

// ─── Main generator ────────────────────────────────────────────────────────────
export function generateLatexResume(
  fields: ResumeFields,
  jobTitle?: string,
  companyName?: string
): string {
  const name = escapeLaTeX(fields.fullName || "Your Name");

  // ── Parse contact info (try to extract LinkedIn, GitHub, Email, Phone, Portfolio) ──
  const contactRaw = fields.contact || "";
  const emailMatch = contactRaw.match(/[\w.+-]+@[\w-]+\.[a-zA-Z.]{2,}/);
  const phoneMatch = contactRaw.match(/(?:\+?\d[\d\s\-().]{7,}\d)/);
  const linkedinMatch = contactRaw.match(/linkedin\.com\/in\/([\w-]+)/i);
  const githubMatch = contactRaw.match(/github\.com\/([\w-]+)/i);
  const portfolioMatch = contactRaw.match(
    /(?:https?:\/\/)?(?:www\.)?([\w-]+\.(?:tech|dev|io|co|com|me|app|site))/i
  );

  const email = emailMatch ? emailMatch[0] : "";
  const phone = phoneMatch ? phoneMatch[0].replace(/\s+/g, "") : "";
  const linkedinUser = linkedinMatch ? linkedinMatch[1] : "";
  const githubUser = githubMatch ? githubMatch[1] : "";
  const portfolio = portfolioMatch ? portfolioMatch[1] : "";

  // ── Education ──────────────────────────────────────────────────────────────
  const eduEntries = parseEducation(fields.education || "");
  const educationLatex = eduEntries.length
    ? eduEntries
        .map(
          (e) => `  \\resumeSubHeadingListStart
  \\vspace{2pt}
    \\resumeSubheading
      {${escapeLaTeX(e.institution)}}{} 
      {${escapeLaTeX(e.degree)}}{${escapeLaTeX(e.dates)}}
      ${e.extra ? `{\\scriptsize \\textit{\\footnotesize{${escapeLaTeX(e.extra)}}}}` : "\\vspace{1pt}"}
    \\resumeSubHeadingListEnd`
        )
        .join("\n")
    : `  \\resumeSubHeadingListStart
  \\vspace{2pt}
    \\resumeSubheading
      {Your University}{}
      {${escapeLaTeX(fields.education?.substring(0, 80) || "Degree")}}{Year}
      \\vspace{1pt}
    \\resumeSubHeadingListEnd`;

  // ── Skills ─────────────────────────────────────────────────────────────────
  const skillGroups = parseSkills(fields.skills || "");
  const skillsLatex = skillGroups.length
    ? `\\resumeSubHeadingListStart\n${skillGroups
        .map(
          (s) =>
            `  \\resumeSubItem{${escapeLaTeX(s.category)}}{${escapeLaTeX(s.skills)}}`
        )
        .join("\n")}\n\\resumeSubHeadingListEnd`
    : `\\resumeSubHeadingListStart
  \\resumeSubItem{Skills}{${escapeLaTeX(fields.skills?.substring(0, 200) || "")}}
\\resumeSubHeadingListEnd`;

  // ── Experience ─────────────────────────────────────────────────────────────
  const jobs = parseExperience(fields.experience || "");
  const experienceLatex = jobs.length
    ? jobs
        .map(
          (job) => `\\resumeSubHeadingListStart
\\vspace{2pt}
    \\resumeSubheading
      {${escapeLaTeX(job.company)}}{}
      {${escapeLaTeX(job.title)}}{${escapeLaTeX(job.dates)}}
      { { {
      ${job.bullets.map((b) => `\\newline{}• ${escapeLaTeX(b)}`).join("\n      ")}
      } } }
\\resumeSubHeadingListEnd`
        )
        .join("\n\n")
    : `\\resumeSubHeadingListStart
\\vspace{2pt}
    \\resumeSubheading
      {Company Name}{}
      {Role}{Dates}
      { { {
      \\newline{}• ${escapeLaTeX(fields.experience?.substring(0, 200) || "Experience details")}
      } } }
\\resumeSubHeadingListEnd`;

  // ── Projects ───────────────────────────────────────────────────────────────
  const projectEntries = parseProjects(fields.projects || "");
  const projectsSection = projectEntries.length
    ? projectEntries
        .map(
          (p) =>
            `    \\item \\textbf{${escapeLaTeX(p.name)}} \\hfill \\textit{${escapeLaTeX(p.date)}}
    \\vspace{1pt}
    \\newline ${escapeLaTeX(p.description)}${p.tech ? `\\newline\n    \\textbf{Tech:} ${escapeLaTeX(p.tech)}` : ""}${
      p.live
        ? `\n    \\newline \\textbf{Live:} \\href{${p.live}}{${escapeLaTeX(p.live)}}`
        : ""
    }${
      p.github
        ? ` \\quad \\textbf{GitHub:} \\href{${p.github}}{${escapeLaTeX(p.github)}}`
        : ""
    }
    \\vspace{2pt}`
        )
        .join("\n\n")
    : fields.projects
      ? `    \\item ${escapeLaTeX(fields.projects.substring(0, 400))}`
      : "";

  // ── Certifications / Awards ────────────────────────────────────────────────
  const certLines = (fields.certifications || "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const certSection =
    certLines.length > 0
      ? `%-----------Certifications \\& Awards-----------------
\\vspace{2pt}
\\section{Certifications \\& Awards}
\\begin{description}[font=\\$\\bullet\\$]
${certLines.map((l) => `\\item ${escapeLaTeX(l)}`).join("\n")}
\\end{description}`
      : "";

  // ── Summary (if provided, add as an Objective/Summary section) ────────────
  const summarySection = fields.summary?.trim()
    ? `%-----------SUMMARY-----------------
\\vspace{-5pt}
\\section{Professional Summary}
\\vspace{2pt}
${escapeLaTeX(fields.summary)}
`
    : "";

  // ── Target job banner ──────────────────────────────────────────────────────
  const targetBanner =
    jobTitle || companyName
      ? `\\vspace{-5pt}
{\\small \\textit{Applying for: ${escapeLaTeX(jobTitle || "")}${companyName ? ` at ${escapeLaTeX(companyName)}` : ""}}}
\\vspace{4pt}
`
      : "";

  // ─── Assemble the full document ────────────────────────────────────────────
  return `\\documentclass[a4paper,11pt]{article}

\\usepackage{latexsym}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{marvosym}
\\usepackage[usenames,dvipsnames]{color}
\\usepackage{verbatim}
\\usepackage{enumitem}
\\usepackage[hidelinks,pdftex]{hyperref}
\\usepackage{fancyhdr}

\\pagestyle{fancy}
\\fancyhf{}
\\fancyfoot{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}

\\addtolength{\\oddsidemargin}{-0.530in}
\\addtolength{\\evensidemargin}{-0.375in}
\\addtolength{\\textwidth}{1in}
\\addtolength{\\topmargin}{-.45in}
\\addtolength{\\textheight}{1in}

\\urlstyle{rm}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}

\\titleformat{\\section}{
  \\vspace{-10pt}\\scshape\\raggedright\\large
}{}{0em}{}[\\color{black}\\titlerule \\vspace{-6pt}]

\\newcommand{\\resumeItem}[2]{
  \\item\\small{
    \\textbf{#1}{: #2 \\vspace{-2pt}}
  }
}

\\newcommand{\\resumeSubheading}[4]{
  \\vspace{-1pt}\\item
    \\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}
      \\textbf{#1} & #2 \\\\
      \\textit{#3} & \\textit{#4} \\\\
    \\end{tabular*}\\vspace{-5pt}
}

\\newcommand{\\resumeSubItem}[2]{\\resumeItem{#1}{#2}\\vspace{-3pt}}

\\renewcommand{\\labelitemii}{\\$\\circ\\$}

\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=*]\\vspace{-5pt}}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}\\vspace{-7pt}}

\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

%-----------------------------
%%%%%%  CV STARTS HERE  %%%%%%

\\begin{document}

%----------HEADING-----------------
\\begin{center}
    {\\Huge \\textbf{${name}}} \\\\
    \\vspace{0.8em}
\\end{center}

\\begin{tabular*}{\\textwidth}{l@{\\extracolsep{\\fill}}r}
${linkedinUser ? `    LinkedIn: \\href{https://linkedin.com/in/${linkedinUser}}{linkedin.com/in/${escapeLaTeX(linkedinUser)}} & ` : "    "}${phone ? `Mobile: ${escapeLaTeX(phone)}` : ""} \\\\
${githubUser ? `    Github: \\href{https://github.com/${githubUser}}{github.com/${escapeLaTeX(githubUser)}} & ` : "    "}${email ? `Email: \\href{mailto:${email}}{${escapeLaTeX(email)}}` : ""} \\\\
${portfolio ? `    Portfolio: \\href{https://${portfolio}}{${escapeLaTeX(portfolio)}} & \\\\` : ""}
\\end{tabular*}

${targetBanner}
${summarySection}
%-----------EDUCATION-----------------
\\section{Education}
\\vspace{2pt}
${educationLatex}

%-----------Skills-----------------
\\vspace{-5pt}
\\section{Skills Summary}
\\vspace{2pt}

${skillsLatex}

%-----------Experience-----------------
\\vspace{2pt}
\\section{Work Experience}
\\vspace{2pt}

${experienceLatex}

%-----------PROJECTS-----------------
${
  projectsSection
    ? `\\section{Projects}
\\vspace{2pt}

\\begin{itemize}[leftmargin=*]

${projectsSection}

\\end{itemize}`
    : ""
}

${certSection}

\\vspace{-5pt}

\\end{document}
`;
}

/**
 * Compile the LaTeX source via texlive.net's public API and return the PDF blob.
 * Throws on network error or non-200 response.
 */
export async function compileLatexToPDF(latexSource: string): Promise<Blob> {
  const form = new FormData();
  const texBlob = new Blob([latexSource], { type: "text/plain" });
  form.append("filecontents[]", texBlob, "resume.tex");
  form.append("filename[]", "resume.tex");
  form.append("engine", "pdflatex");
  form.append("return", "pdf");

  const response = await fetch("https://texlive.net/cgi-bin/latexcgi.pl", {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(
      `LaTeX compilation failed: ${response.status} ${response.statusText}`
    );
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/pdf")) {
    // The service returns an error log as HTML when compilation fails
    const text = await response.text();
    const match = text.match(/!.*?(?=\n)/);
    throw new Error(
      match
        ? `LaTeX error: ${match[0]}`
        : "Compilation returned non-PDF response"
    );
  }

  return response.blob();
}

/** Trigger a browser download of a Blob. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}
