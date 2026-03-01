import React, { useState } from 'react';
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import { usePuterStore } from "~/lib/puter";
import { useNavigate } from "react-router";
import { convertPdfToImage } from "~/lib/PdfToImage";
import { generateUUID } from "~/lib/utils";
import { prepareInstructions, prepareCoverLetterInstructions } from "../../constants";
import { createDateValidationServiceWithPersistence, formatValidationResultsForAI } from "~/lib/dateValidation";


export const meta = () => ([{ title: "Resumind | Upload" }, { name: "description", content: "Upload your resume" },])


const upload = () => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [statusText, setStatusText] = useState("");
    const [file, setFile] = useState<File | null>(null);
    const [isInternshala, setIsInternshala] = useState(false);
    const [internshalaUrl, setInternshalaUrl] = useState("");
    const [internshalaUrlError, setInternshalaUrlError] = useState("");
    const [companyName, setCompanyName] = useState("");
    const [jobTitle, setJobTitle] = useState("");
    const [jobDescription, setJobDescription] = useState("");
    const [location, setLocation] = useState("");
    const [skills, setSkills] = useState<string[]>([]);
    const [coverLetter, setCoverLetter] = useState("");
    const [rephrasedCoverLetter, setRephrasedCoverLetter] = useState<string | null>(null);
    const [toast, setToast] = useState<{ message: string; type: "error" | "success" | "info" } | null>(null);

    // Show toast for 2.5 seconds
    const showToast = (message: string, type: "error" | "success" | "info" = "error") => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 2500);
    };

    const { fs, auth, isLoading, ai, kv } = usePuterStore();
    const navigate = useNavigate();

    const handleFileSelect = (file: File | null) => {
        setFile(file);
    };

    const isInternshalaUrl = internshalaUrl.trim().toLowerCase().includes("internshala.com");

    const handleInternshalaFetch = async () => {
        if (!internshalaUrl || !isInternshalaUrl) {
            setInternshalaUrlError("Please enter a valid Internshala job URL.");
            return;
        }
        setInternshalaUrlError("");
        setStatusText("Fetching job details from Internshala...");
        setIsProcessing(true);
        try {
            const response = await fetch("/api/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: internshalaUrl })
            });
            const data = await response.json();
            setCompanyName(data.company || "");
            setJobTitle(data.title || "");
            setLocation(data.location || "");
            setSkills(data.skills || []);
            let jobDescText = Array.isArray(data.jobDescription) ? data.jobDescription.join("\n") : "";
            if (data.skills && Array.isArray(data.skills) && data.skills.length > 0) {
                jobDescText += `\n\nRequired Skills: ${data.skills.join(", ")}`;
            }
            setJobDescription(jobDescText);
            setStatusText("");
        } catch (error) {
            setStatusText("Failed to fetch job details from Internshala.");
        }
        setIsProcessing(false);
    };

    const handleAnalyse = async ({ companyName, jobTitle, jobDescription, file }: {
        companyName: string, jobTitle: string, jobDescription: string, file: File
    }) => {
        setIsProcessing(true);
        setStatusText("Uploading your resume...");
        const uploadedFile = await fs.upload([file]);
        if (!uploadedFile) {
            setIsProcessing(false);
            setStatusText("Failed to upload your resume. Please try again.");
            return;
        }
        setStatusText("Converting to image...");
        const imageFile = await convertPdfToImage(file);

        if (!imageFile.file) {
            setIsProcessing(false);
            setStatusText("Failed to convert your resume to image. Please try again.");
            return;
        }
        setStatusText("Uploading the image...");
        const uploadedImage = await fs.upload([imageFile.file]);

        if (!uploadedImage) {
            setIsProcessing(false);
            setStatusText("Failed to upload your resume image. Please try again.");
            return;
        }
        setStatusText("Preparing data for analysis...");

        const uuid = generateUUID();
        const data = {
            id: uuid,
            resumePath: uploadedFile.path,
            imagePath: uploadedImage.path,
            companyName,
            jobTitle,
            jobDescription,
            coverLetter: coverLetter || "",
            rephrasedCoverLetter: rephrasedCoverLetter || "",
            feedback: '' as any,
            parsedContent: null as any,
        };

        await kv.set(`resume:${uuid}`, JSON.stringify(data));
        setStatusText("Analysing your resume...");

        // First, run date validation with enhanced logging
        setStatusText("Validating resume dates...");
        let dateValidationResults = null;
        let dateValidationSummary = "";

        console.log("🚀 Starting enhanced date validation with logging...");

        try {
            // Extract text from the uploaded file for date validation
            const resumeBlob = await fs.read(uploadedFile.path);
            if (resumeBlob) {
                // Convert blob to text (this is a simplified approach - in production you'd use proper PDF text extraction)
                const resumeText = await resumeBlob.text();

                console.log("📄 Resume text extracted, length:", resumeText.length, "characters");
                console.log("🔍 Running enhanced date validation service...");

                // Run our enhanced date validation
                const dateValidationService = await createDateValidationServiceWithPersistence();
                const validationStartTime = Date.now();
                dateValidationResults = dateValidationService.validateResumeDates(resumeText);
                const validationEndTime = Date.now();

                dateValidationSummary = formatValidationResultsForAI(dateValidationResults);

                console.log("✅ Enhanced date validation completed in", validationEndTime - validationStartTime, "ms");
                console.log("📊 Date validation results:", {
                    isValid: dateValidationResults.isValid,
                    totalIssues: dateValidationResults.issues.length,
                    criticalIssues: dateValidationResults.issues.filter(i => i.type === 'critical').length,
                    warningIssues: dateValidationResults.issues.filter(i => i.type === 'warning').length,
                    suggestionIssues: dateValidationResults.issues.filter(i => i.type === 'suggestion').length,
                    warnings: dateValidationResults.warnings.length,
                    suggestions: dateValidationResults.suggestions.length
                });

                if (dateValidationResults.issues.length > 0) {
                    console.log("🔍 Detailed issues found:");
                    dateValidationResults.issues.forEach((issue, index) => {
                        console.log(`   ${index + 1}. [${issue.type.toUpperCase()}] ${issue.category}: ${issue.message}`);
                        if (issue.detectedDate) console.log(`      📅 Date: ${issue.detectedDate}`);
                        if (issue.suggestedFix) console.log(`      💡 Fix: ${issue.suggestedFix}`);
                    });
                }

                console.log("📝 AI Summary generated:", dateValidationSummary.substring(0, 100) + "...");
            } else {
                console.warn("⚠️ Could not read resume blob for date validation");
            }
        } catch (dateValidationError) {
            console.error("❌ Date validation failed:", dateValidationError);
            dateValidationSummary = "Date validation could not be performed due to technical issues.";
        }

        setStatusText("Getting AI feedback...");

        // Include date validation results in the AI prompt
        const enhancedInstructions = prepareInstructions({ jobDescription, jobTitle }) +
            (dateValidationSummary ? `\n\nAdditional Date Validation Analysis:\n${dateValidationSummary}` : "");

        const feedback = await ai.feedback(uploadedFile.path, enhancedInstructions);

        if (!feedback) {
            setIsProcessing(false);
            setStatusText("Failed to analyse your resume. Please try again.");
            return;
        }
        try {
            let feedbackText = '';
            if (typeof feedback.message.content === 'string') {
                feedbackText = feedback.message.content;
            } else if (Array.isArray(feedback.message.content)) {
                for (const content of feedback.message.content) {
                    if (content.type === 'text' && content.text) {
                        feedbackText = content.text;
                        break;
                    }
                }
                if (!feedbackText && feedback.message.content.length > 0) {
                    feedbackText = feedback.message.content[0].text || '';
                }
            }
            if (!feedbackText) {
                throw new Error('Could not extract text from AI response');
            }
            feedbackText = feedbackText.trim();
            if (feedbackText.startsWith('```json')) {
                feedbackText = feedbackText.substring(7);
            }
            if (feedbackText.startsWith('```')) {
                feedbackText = feedbackText.substring(3);
            }
            if (feedbackText.endsWith('```')) {
                feedbackText = feedbackText.substring(0, feedbackText.length - 3);
            }
            data.feedback = JSON.parse(feedbackText);
            if (data.feedback.parsedContent) {
                data.parsedContent = data.feedback.parsedContent;
            }
            // Add date validation results to the stored data
            if (dateValidationResults) {
                // Calculate a score based on validation results
                const criticalIssues = dateValidationResults.issues.filter(issue => issue.type === 'critical').length;
                const warningIssues = dateValidationResults.issues.filter(issue => issue.type === 'warning').length;
                const suggestionIssues = dateValidationResults.issues.filter(issue => issue.type === 'suggestion').length;

                // Score calculation: start at 100, deduct points for issues
                let score = 100;
                score -= criticalIssues * 25; // Critical issues: -25 points each
                score -= warningIssues * 10;  // Warning issues: -10 points each
                score -= suggestionIssues * 5; // Suggestion issues: -5 points each
                score = Math.max(0, score); // Don't go below 0

                console.log("📊 Date validation score calculated:", {
                    score,
                    breakdown: {
                        criticalIssues: `${criticalIssues} × -25 = -${criticalIssues * 25}`,
                        warningIssues: `${warningIssues} × -10 = -${warningIssues * 10}`,
                        suggestionIssues: `${suggestionIssues} × -5 = -${suggestionIssues * 5}`
                    }
                });

                data.feedback.dateValidation = {
                    score: score,
                    issues: dateValidationResults.issues,
                    summary: dateValidationSummary
                };

                console.log("💾 Date validation results added to feedback data");
            } else {
                console.log("⚠️ No date validation results to store");
            }

            await kv.set(`resume:${uuid}`, JSON.stringify(data));
            setIsProcessing(false);
            setStatusText("Resume analysed successfully. You can now review your feedback.");
            navigate(`/resume/${uuid}`);
            console.log("feedback: ", data);
        } catch (error) {
            console.error("Error processing AI feedback:", error);
            setIsProcessing(false);
            setStatusText("Failed to process AI feedback. Please try again.");
        }
    };

    const handleRephrase = async () => {
        if (!coverLetter) {
            showToast("Please paste your cover letter first.", "error");
            return;
        }
        setIsProcessing(true);
        setStatusText("Rephrasing cover letter...");
        try {
            const prompt = [
                { role: "user", content: [{ type: "text", text: coverLetter }] },
                { role: "user", content: [{ type: "text", text: prepareCoverLetterInstructions({ jobTitle, jobDescription }) }] }
            ];
            const aiResp = await ai.chat(prompt as any);
            if (!aiResp) throw new Error("No AI response");
            let text = "";
            if (typeof (aiResp as any).message?.content === "string") {
                text = (aiResp as any).message.content;
            } else if (Array.isArray((aiResp as any).message?.content)) {
                for (const c of (aiResp as any).message.content) {
                    if (c.type === "text" && c.text) { text = c.text; break; }
                }
                if (!text && (aiResp as any).message.content.length > 0) {
                    text = (aiResp as any).message.content[0].text || "";
                }
            }
            text = text.trim();
            if (text.startsWith("```")) {
                if (text.indexOf("\n") > -1) text = text.substring(text.indexOf("\n") + 1);
                else text = text.replace(/```/g, "");
            }
            if (text.endsWith("```")) text = text.slice(0, -3).trim();
            setRephrasedCoverLetter(text);
            setStatusText("Rephrased cover letter ready");
        } catch (err) {
            console.error("Cover letter rephrase error:", err);
            setStatusText("Failed to rephrase cover letter");
            showToast("Failed to rephrase cover letter", "error");
        }
        setIsProcessing(false);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const form = e.currentTarget.closest("form");
        if (!form) return;
        let _companyName = companyName;
        let _jobTitle = jobTitle;
        let _jobDescription = jobDescription;
        if (!isInternshala) {
            const formData = new FormData(form);
            _companyName = formData.get("company-name") as string;
            _jobTitle = formData.get("job-title") as string;
            _jobDescription = formData.get("job-description") as string;
        }
        if (!file) {
            showToast("Please upload your resume before analysing.", "error");
            return;
        }
        handleAnalyse({ companyName: _companyName, jobTitle: _jobTitle, jobDescription: _jobDescription, file });
    };

    return (
        <main className="bg-[url('/images/bg-main.svg')] bg-cover">
            <div style={{ pointerEvents: 'none' }}>
                <div
                    className={`fixed left-1/2 z-50 px-6 py-3 rounded-xl shadow-lg text-white font-semibold transition-all duration-500 transform -translate-x-1/2 ${toast ? 'top-8 opacity-100 translate-y-0' : 'top-0 opacity-0 -translate-y-8'} ${toast && toast.type === "error" ? "bg-red-500" : toast && toast.type === "success" ? "bg-green-500" : toast && toast.type === "info" ? "bg-blue-500" : ""}`}
                    style={{ minWidth: '260px', maxWidth: '90vw', textAlign: 'center' }}
                >
                    {toast && toast.message}
                </div>
            </div>
            <Navbar />
            <section className="main-section">
                <div className="page-heading py-16">
                    <h1>Smart Feedback for your dream job</h1>
                    {isProcessing ? (
                        <>
                            <h2>{statusText}</h2>
                            <img src="/images/resume-scan.gif" alt="resume" className="w-full md:w-1/2 " />
                        </>
                    ) : (
                        <h2>Drop your resume for an ATS score and improvement tips</h2>
                    )}
                    {!isProcessing && (
                        <>
                            <div className="flex flex-row items-center gap-3 mb-4">
                                <label
                                    htmlFor="internshala-checkbox"
                                    className="text-lg font-semibold text-gray-800 cursor-pointer select-none"
                                >
                                    Job details from{" "}
                                    <span className="font-bold text-blue-600">Internshala</span>?
                                </label>
                                <input
                                    id="internshala-checkbox"
                                    type="checkbox"
                                    checked={isInternshala}
                                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIsInternshala(e.target.checked)}
                                    className="internshala-checkbox w-6 h-6 accent-blue-600 cursor-pointer"
                                />
                            </div>
                            {isInternshala && (
                                <div className="form-div flex flex-col gap-2 mb-4">
                                    <label htmlFor="internshala-url">Internshala Job URL</label>
                                    <input
                                        type="text"
                                        id="internshala-url"
                                        name="internshala-url"
                                        placeholder="Paste Internshala job URL"
                                        value={internshalaUrl}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                            setInternshalaUrl(e.target.value);
                                            if (e.target.value && !e.target.value.toLowerCase().includes("internshala.com")) {
                                                setInternshalaUrlError("URL must be from internshala.com");
                                            } else {
                                                setInternshalaUrlError("");
                                            }
                                        }}
                                        className="input"
                                    />
                                    {internshalaUrlError && (
                                        <span className="text-red-500 text-sm">{internshalaUrlError}</span>
                                    )}
                                    <button
                                        type="button"
                                        className="primary-button w-fit"
                                        onClick={handleInternshalaFetch}
                                        disabled={!internshalaUrl || !isInternshalaUrl || isProcessing}
                                    >
                                        Fetch Job Details
                                    </button>
                                </div>
                            )}
                            <form id="upload-form" onSubmit={handleSubmit} className="flex flex-col gap-4 mt-8">
                                <div className="form-div">
                                    <label htmlFor="company-name">Company Name</label>
                                    <input
                                        type="text"
                                        name="company-name"
                                        id="company-name"
                                        placeholder="Company Name"
                                        value={companyName}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCompanyName(e.target.value)}
                                        disabled={isInternshala}
                                    />
                                </div>
                                <div className="form-div">
                                    <label htmlFor="job-title">Job Title</label>
                                    <input
                                        type="text"
                                        name="job-title"
                                        id="job-title"
                                        placeholder="Job Title"
                                        value={jobTitle}
                                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setJobTitle(e.target.value)}
                                        disabled={isInternshala}
                                    />
                                </div>
                                <div className="form-div">
                                    <label htmlFor="job-description">Job Description</label>
                                    <textarea
                                        rows={5}
                                        name="job-description"
                                        id="job-description"
                                        placeholder="Job Description"
                                        value={jobDescription}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setJobDescription(e.target.value)}
                                        disabled={isInternshala}
                                    />
                                </div>
                                <div className="form-div">
                                    <label htmlFor="cover-letter">Cover Letter (optional)</label>
                                    <textarea
                                        rows={6}
                                        name="cover-letter"
                                        id="cover-letter"
                                        placeholder="Paste your current cover letter here to rephrase for this role"
                                        value={coverLetter}
                                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setCoverLetter(e.target.value)}
                                        disabled={isProcessing}
                                    />
                                    <div className="flex gap-2 mt-2">
                                        <button
                                            type="button"
                                            className="primary-button w-fit px-4 py-2"
                                            onClick={handleRephrase}
                                            disabled={isProcessing || !coverLetter}
                                        >
                                            Rephrase Cover Letter
                                        </button>
                                        {rephrasedCoverLetter && (
                                            <button
                                                type="button"
                                                className="bg-white border px-4 py-2 rounded-md"
                                                onClick={() => {
                                                    navigator.clipboard?.writeText(rephrasedCoverLetter);
                                                    showToast("Rephrased cover letter copied", "success");
                                                }}
                                            >
                                                Copy Rephrased
                                            </button>
                                        )}
                                    </div>
                                    {rephrasedCoverLetter && (
                                        <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                                            <p className="font-semibold mb-2">Rephrased Cover Letter</p>
                                            <pre className="whitespace-pre-wrap">{rephrasedCoverLetter}</pre>
                                            <div className="flex gap-2 mt-2">
                                                <button className="primary-button" onClick={() => setCoverLetter(rephrasedCoverLetter)}>Use Rephrased</button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="form-div">
                                    <label htmlFor="uploader">Upload Resume</label>
                                    <FileUploader onFileSelect={handleFileSelect} />
                                </div>
                                <button className="primary-button" type="submit">Analyse Resume</button>
                            </form>
                        </>
                    )}
                </div>
            </section>
        </main>
    );
};

export default upload;
