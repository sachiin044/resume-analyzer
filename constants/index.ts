export const resumes: Resume[] = [{
    id: "1",
    companyName: "Google",
    jobTitle: "Frontend Developer",
    imagePath: "/images/resume_01.png",
    resumePath: "/resumes/resume-1.pdf",
    feedback: {
        overallScore: 85, ATS: {
            score: 90, tips: [],
        }, toneAndStyle: {
            score: 90, tips: [],
        }, content: {
            score: 90, tips: [],
        }, structure: {
            score: 90, tips: [],
        }, skills: {
            score: 90, tips: [],
        },
    },
}, {
    id: "2",
    companyName: "Microsoft",
    jobTitle: "Cloud Engineer",
    imagePath: "/images/resume_02.png",
    resumePath: "/resumes/resume-2.pdf",
    feedback: {
        overallScore: 55, ATS: {
            score: 90, tips: [],
        }, toneAndStyle: {
            score: 90, tips: [],
        }, content: {
            score: 90, tips: [],
        }, structure: {
            score: 90, tips: [],
        }, skills: {
            score: 90, tips: [],
        },
    },
}, {
    id: "3",
    companyName: "Apple",
    jobTitle: "iOS Developer",
    imagePath: "/images/resume_03.png",
    resumePath: "/resumes/resume-3.pdf",
    feedback: {
        overallScore: 75, ATS: {
            score: 90, tips: [],
        }, toneAndStyle: {
            score: 90, tips: [],
        }, content: {
            score: 90, tips: [],
        }, structure: {
            score: 90, tips: [],
        }, skills: {
            score: 90, tips: [],
        },
    },
}, {
    id: "4",
    companyName: "Google",
    jobTitle: "Frontend Developer",
    imagePath: "/images/resume_01.png",
    resumePath: "/resumes/resume-1.pdf",
    feedback: {
        overallScore: 85, ATS: {
            score: 90, tips: [],
        }, toneAndStyle: {
            score: 90, tips: [],
        }, content: {
            score: 90, tips: [],
        }, structure: {
            score: 90, tips: [],
        }, skills: {
            score: 90, tips: [],
        },
    },
}, {
    id: "5",
    companyName: "Microsoft",
    jobTitle: "Cloud Engineer",
    imagePath: "/images/resume_02.png",
    resumePath: "/resumes/resume-2.pdf",
    feedback: {
        overallScore: 55, ATS: {
            score: 90, tips: [],
        }, toneAndStyle: {
            score: 90, tips: [],
        }, content: {
            score: 90, tips: [],
        }, structure: {
            score: 90, tips: [],
        }, skills: {
            score: 90, tips: [],
        },
    },
}, {
    id: "6",
    companyName: "Apple",
    jobTitle: "iOS Developer",
    imagePath: "/images/resume_03.png",
    resumePath: "/resumes/resume-3.pdf",
    feedback: {
        overallScore: 75, ATS: {
            score: 90, tips: [],
        }, toneAndStyle: {
            score: 90, tips: [],
        }, content: {
            score: 90, tips: [],
        }, structure: {
            score: 90, tips: [],
        }, skills: {
            score: 90, tips: [],
        },
    },
},];

export const AIResponseFormat = `
      interface Feedback {
      overallScore: number; //max 100
      parsedContent: {
        fullName: string; // Candidate full name (or empty if not found)
        contact: string; // Email, phone, links combined (or empty)
        summary: string; // Professional summary text
        experience: string; // Full work experience text
        education: string; // Full education text
        skills: string; // All technical skills
        projects: string; // Projects text (if any)
        certifications: string; // Certifications text (if any)
      };
      ATS: {
        score: number; //rate based on ATS suitability
        tips: {
          type: "good" | "improve";
          tip: string; //give 3-4 tips
        }[];
      };
      toneAndStyle: {
        score: number; //max 100
        tips: {
          type: "good" | "improve";
          tip: string; //make it a short "title" for the actual explanation
          explanation: string; //explain in detail here
        }[]; //give 3-4 tips
      };
      content: {
        score: number; //max 100
        tips: {
          type: "good" | "improve";
          tip: string; //make it a short "title" for the actual explanation
          explanation: string; //explain in detail here
        }[]; //give 3-4 tips
      };
      structure: {
        score: number; //max 100
        tips: {
          type: "good" | "improve";
          tip: string; //make it a short "title" for the actual explanation
          explanation: string; //explain in detail here
        }[]; //give 3-4 tips
      };
      skills: {
        score: number; //max 100
        tips: {
          type: "good" | "improve";
          tip: string; //make it a short "title" for the actual explanation
          explanation: string; //explain in detail here
        }[]; //give 3-4 tips
      };
    }`;

export const prepareInstructions = ({ jobTitle, jobDescription }: { jobTitle: string; jobDescription: string; }) => `You are an expert in ATS (Applicant Tracking System) and resume analysis.
      Please analyze and rate this resume and suggest how to improve it.
      The rating can be low if the resume is bad.
      Be thorough and detailed. Don't be afraid to point out any mistakes or areas for improvement.
      If there is a lot to improve, don't hesitate to give low scores. This is to help the user to improve their resume.
      If available, use the job description for the job user is applying to to give more detailed feedback.
      If provided, take the job description into consideration.
      
      Pay special attention to date consistency and accuracy in education and work experience sections.
      Look for:
      - Future dates that seem unrealistic
      - Overlapping employment periods that don't make sense
      - Education dates that conflict with work experience
      - Missing or incomplete date information
      - Date formatting inconsistencies
      
      The job title is: ${jobTitle}
      The job description is: ${jobDescription}
      Provide the feedback using the following format:
      ${AIResponseFormat}
      Return the analysis as an JSON object, without any other text and without the backticks.
      Do not include any other text or comments.`;

export const prepareCoverLetterInstructions = ({ jobTitle, jobDescription }: { jobTitle: string; jobDescription: string; }) => `You are an expert at rewriting cover letters to match job descriptions and job titles.
Given the original cover letter, rewrite it to:
- Align tone and keywords with the job title: "${jobTitle}"
- Explicitly reference important responsibilities / skills from the job description: "${jobDescription}"
- Keep the same intent and main points as the original letter, but make it concise (3-4 short paragraphs)
- Use professional, confident tone and first person
- Keep length between 150-300 words
Return only the rewritten cover letter text with no surrounding commentary.`;