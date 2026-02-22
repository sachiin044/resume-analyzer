import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { usePuterStore } from "~/lib/puter";
import Summary from "~/components/Summary";
import ATS from "~/components/ATS";
import Details from "~/components/Details";

export const meta = () => [
  { title: "Resumind | Review" },
  {
    name: "description",
    content: "Detailed overview of your resume",
  },
];

const resume = () => {
  const { auth, isLoading, fs, kv } = usePuterStore();
  const { id } = useParams();
  const navigate = useNavigate();

  const [imageUrl, setImageUrl] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [rephrasedCoverLetter, setRephrasedCoverLetter] = useState<
    string | null
  >(null);

  useEffect(() => {
    if (!isLoading && !auth.isAuthenticated)
      navigate(`/auth?next=/resume/${id}`);
  }, [isLoading]);

  useEffect(() => {
    const loadResume = async () => {
      const resume = await kv.get(`resume:${id}`);

      if (!resume) return;

      const data = JSON.parse(resume);

      const resumeBlob = await fs.read(data.resumePath);
      if (!resumeBlob) return;

      const pdfBlob = new Blob([resumeBlob], { type: "application/pdf" });
      const resumeUrl = URL.createObjectURL(pdfBlob);

      setResumeUrl(resumeUrl);

      const imageBlob = await fs.read(data.imagePath);
      if (!imageBlob) return;

      const imageBlobUrl = URL.createObjectURL(imageBlob);
      setImageUrl(imageBlobUrl);

      setFeedback(data.feedback);
      if (data.rephrasedCoverLetter)
        setRephrasedCoverLetter(data.rephrasedCoverLetter);
      console.log({ resumeUrl, imageBlobUrl, feedback: data.feedback });
    };
    loadResume();
  }, [id]);

  return (
    <main className="!pt-0">
      <nav className="resume-nav">
        <Link to="/" className="back-button">
          <img src="/icons/back.svg" alt="logo" className="w-2.5 h-2.5" />
          <span className="text-gray-800 text-sm font-semibold">
            Back to home page
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <Link
            to={`/resume/${id}/edit`}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-all"
          >
            ✏️ Edit Resume
          </Link>
          <Link
            to={`/resume/${id}/optimize`}
            className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-bold text-white transition-all shadow-md hover:shadow-lg"
            style={{
              background: "linear-gradient(to bottom, #8e98ff, #606beb)",
            }}
          >
            🚀 Optimize
          </Link>
        </div>
      </nav>
      <div className="flex flex-row w-full max-lg:flex-col-reverse">
        <section className="feedback-section bg-[url('/images/bg-small.svg')] bg-cover h-[100vh] sticky top-0 items-center justify-center">
          {imageUrl && resumeUrl && (
            <div className=" animate-in fade-in duration-1000 gradient-border max-sm:m-0 h-[90%] max-w-xl:h-fit w-fit">
              <a
                href={resumeUrl}
                target="_blank"
                rel="noreferrer"
                className="w-full h-full"
              >
                <img
                  src={imageUrl}
                  alt="image"
                  className="w-full h-full object-cover object-center"
                  title="resume"
                />
              </a>
            </div>
          )}
        </section>
        <section className="feedback-section">
          <h2 className="text-4xl !text-black font-bold">Resume Review</h2>
          {feedback ? (
            <div className="feedback-content">
              <div className="flex flex-col gap-8 animate-in fade-in duration-1000">
                <Summary feedback={feedback} />
                <ATS
                  score={feedback.ATS.score || 0}
                  suggestions={feedback.ATS.tips || []}
                />
                <Details feedback={feedback} />
                {rephrasedCoverLetter && (
                  <div className="bg-white p-4 rounded-md shadow-sm">
                    <h3 className="text-lg font-semibold mb-2">
                      Rephrased Cover Letter
                    </h3>
                    <pre className="whitespace-pre-wrap text-sm">
                      {rephrasedCoverLetter}
                    </pre>
                  </div>
                )}
                {/* Next steps action panel */}
                <div className="rounded-2xl overflow-hidden border border-indigo-100 shadow-sm">
                  <div
                    className="px-6 py-4 flex items-center gap-3"
                    style={{
                      background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    }}
                  >
                    <span className="text-2xl">🚀</span>
                    <div>
                      <p className="font-bold text-white text-lg">
                        Ready to improve?
                      </p>
                      <p className="text-indigo-200 text-sm">
                        Edit your resume with AI guidance or build an
                        ATS-optimized version.
                      </p>
                    </div>
                  </div>
                  <div className="bg-white px-6 py-4 flex flex-col sm:flex-row gap-3">
                    <Link
                      to={`/resume/${id}/edit`}
                      className="flex-1 text-center px-5 py-3 rounded-full font-semibold text-indigo-700 border-2 border-indigo-200 hover:bg-indigo-50 transition-all text-sm"
                    >
                      ✏️ Edit with AI Suggestions
                    </Link>
                    <Link
                      to={`/resume/${id}/optimize`}
                      className="flex-1 text-center px-5 py-3 rounded-full font-bold text-white transition-all text-sm shadow-md hover:shadow-lg"
                      style={{
                        background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                      }}
                    >
                      🎯 Build ATS-Optimized Resume
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <img
              src="/images/resume-scan-2.gif"
              alt="resume scan"
              className="w-full"
            />
          )}
        </section>
      </div>
    </main>
  );
};

export default resume;
