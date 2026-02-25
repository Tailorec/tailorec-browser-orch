# 18 — Free-Text Answer Quality

## Problem

Job applications often include free-text questions that differentiate a strong application from a weak one:

- "Why do you want to work at [Company]?" — requires company-specific knowledge
- "Tell us about a relevant project" — requires resume-specific details
- "Why are you interested in this role?" — requires job description alignment
- "What makes you a good fit?" — requires skill-to-requirement matching
- "Cover letter" — long-form writing

Currently the agent uses the LLM to generate answers, but without **structured context injection**, the answers tend to be:
- Generic ("I'm passionate about technology...")
- Disconnected from the user's actual resume
- Missing company/role-specific details
- Too short or too long for the field

---

## Implementation Plan

### Phase 1: open-agent — Answer Context Builder

This is purely agent-side intelligence — no openclaw-browser changes needed.

#### File: `../open-agent/src/orchestrator/answer-generator.ts` (NEW)

```typescript
/**
 * Builds rich context for generating free-text answers to job application questions.
 * Extracts relevant information from:
 * - User profile / resume data
 * - Job description / posting
 * - Company information
 * - Question requirements (word count, topic)
 */

export type AnswerContext = {
  question: string;
  questionCategory: string;
  answerGuidelines: string;
  relevantResumeExcerpts: string[];
  relevantJobRequirements: string[];
  companyInfo: string | null;
  roleTitle: string | null;
  maxWords: number;
  tone: string;
};

const QUESTION_CATEGORIES: Array<{
  patterns: RegExp[];
  category: string;
  guidelines: string;
  maxWords: number;
  tone: string;
  resumeFields: string[];
}> = [
  {
    patterns: [
      /why\s+(?:do\s+you\s+)?want\s+to\s+work/i,
      /why\s+(?:are\s+you\s+)?interested\s+in\s+(?:this|our)/i,
      /what\s+(?:interests|attracts|excites)\s+you/i,
      /why\s+(?:this|our)\s+company/i,
    ],
    category: "why_company",
    guidelines:
      "Reference specific aspects of the company (products, mission, culture, recent news). " +
      "Connect your experience to their domain. Show you've researched them. " +
      "DON'T just say 'I'm passionate about technology'. BE SPECIFIC. " +
      "Structure: 1) What about the company excites you, 2) How your background aligns, 3) What you'd contribute.",
    maxWords: 150,
    tone: "enthusiastic but professional",
    resumeFields: ["experience", "skills"],
  },
  {
    patterns: [
      /why\s+(?:are\s+you\s+)?(?:a\s+)?good\s+fit/i,
      /what\s+makes\s+you\s+(?:a\s+)?(?:good|great|strong)\s+candidate/i,
      /why\s+should\s+we\s+(?:hire|consider)/i,
      /what\s+(?:do\s+you\s+)?bring\s+to/i,
    ],
    category: "why_you",
    guidelines:
      "Match 2-3 specific skills/experiences from resume to job requirements. " +
      "Use concrete numbers/achievements (e.g., 'Led a team of 5 to deliver...'). " +
      "DON'T list skills without context. Show IMPACT. " +
      "Structure: 1) Most relevant experience, 2) Key achievement, 3) How it transfers.",
    maxWords: 150,
    tone: "confident but not arrogant",
    resumeFields: ["experience", "skills", "achievements"],
  },
  {
    patterns: [
      /tell\s+us\s+about\s+(?:a\s+)?(?:relevant|recent)?\s*project/i,
      /describe\s+(?:a\s+)?(?:relevant|recent)?\s*project/i,
      /share\s+(?:a\s+)?(?:an?\s+)?example/i,
      /(?:technical|coding|engineering)\s+challenge/i,
    ],
    category: "project_example",
    guidelines:
      "Pick the most relevant project from resume that aligns with the job requirements. " +
      "Use STAR format: Situation, Task, Action, Result. " +
      "Include specific technologies mentioned in the job posting. " +
      "Quantify results where possible (e.g., 'improved performance by 40%'). " +
      "DON'T describe a project unrelated to the role.",
    maxWords: 200,
    tone: "technical and specific",
    resumeFields: ["experience", "projects"],
  },
  {
    patterns: [
      /cover\s+letter/i,
      /letter\s+of\s+(?:interest|motivation)/i,
    ],
    category: "cover_letter",
    guidelines:
      "Write a brief, targeted cover letter. Structure: " +
      "1) Opening: Express interest in the specific role at the specific company. " +
      "2) Body (2 paragraphs): Connect your top 2-3 relevant experiences to job requirements. " +
      "3) Closing: Express enthusiasm and availability. " +
      "Keep it under 250 words. Be specific, not generic. " +
      "DON'T start with 'I am writing to apply for...' — use a stronger opening.",
    maxWords: 250,
    tone: "professional and personable",
    resumeFields: ["experience", "skills", "education"],
  },
  {
    patterns: [
      /additional\s+information/i,
      /anything\s+else/i,
      /is\s+there\s+anything/i,
    ],
    category: "additional_info",
    guidelines:
      "This is OPTIONAL. If the user has nothing specific to add, leave blank or write a brief " +
      "1-2 sentence statement. Only use if there's relevant context not captured elsewhere " +
      "(e.g., willing to relocate, available to start immediately, relevant side project). " +
      "DON'T repeat what's already in the resume or other fields.",
    maxWords: 100,
    tone: "brief and direct",
    resumeFields: [],
  },
];

export function buildAnswerContext(opts: {
  questionText: string;
  resumeData: Record<string, unknown>;
  jobDescription: string | null;
  companyName: string | null;
  roleTitle: string | null;
}): AnswerContext {
  const { questionText, resumeData, jobDescription, companyName, roleTitle } = opts;
  const qLower = questionText.toLowerCase();

  // Find matching category
  let matched = QUESTION_CATEGORIES.find((cat) =>
    cat.patterns.some((p) => p.test(qLower))
  );

  if (!matched) {
    matched = {
      patterns: [],
      category: "generic",
      guidelines:
        "Answer concisely and relevantly. Connect your experience to what's being asked. " +
        "Be specific, not generic. Keep it under 150 words.",
      maxWords: 150,
      tone: "professional",
      resumeFields: ["experience", "skills"],
    };
  }

  // Extract relevant resume excerpts
  const relevantExcerpts: string[] = [];
  for (const field of matched.resumeFields) {
    const data = resumeData[field];
    if (Array.isArray(data)) {
      // For experience/projects arrays, take most recent 2
      for (const item of data.slice(0, 2)) {
        if (typeof item === "object" && item !== null) {
          const summary = Object.values(item as Record<string, unknown>)
            .filter((v) => typeof v === "string")
            .join(" | ")
            .slice(0, 200);
          relevantExcerpts.push(summary);
        }
      }
    } else if (typeof data === "string") {
      relevantExcerpts.push(data.slice(0, 200));
    } else if (Array.isArray(data) === false && typeof data === "object" && data !== null) {
      relevantExcerpts.push(JSON.stringify(data).slice(0, 200));
    }
  }

  // Extract relevant job requirements
  const relevantRequirements: string[] = [];
  if (jobDescription) {
    // Extract bullet points / requirements from job description
    const lines = jobDescription.split("\n").filter((l) => l.trim().length > 10);
    const requirementLines = lines.filter((l) =>
      /required|must\s+have|you\s+will|you'll|responsibilities|qualifications|requirements/i.test(l) ||
      l.trim().startsWith("•") ||
      l.trim().startsWith("-") ||
      l.trim().startsWith("*")
    );
    relevantRequirements.push(...requirementLines.slice(0, 5).map((l) => l.trim().slice(0, 150)));

    // If no structured requirements found, take first few lines
    if (relevantRequirements.length === 0) {
      relevantRequirements.push(...lines.slice(0, 3).map((l) => l.trim().slice(0, 150)));
    }
  }

  return {
    question: questionText.slice(0, 300),
    questionCategory: matched.category,
    answerGuidelines: matched.guidelines,
    relevantResumeExcerpts: relevantExcerpts,
    relevantJobRequirements: relevantRequirements,
    companyInfo: companyName ? `Company: ${companyName}` : null,
    roleTitle: roleTitle || null,
    maxWords: matched.maxWords,
    tone: matched.tone,
  };
}
```

---

### Phase 2: open-agent — Answer Context Tool

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createRuntimeTools`:

```typescript
{
  name: "runtime.build_answer_context",
  label: "Build Answer Context for Free-Text Question",
  description:
    "Given a free-text question from a job application, builds structured context " +
    "for generating a high-quality answer. Returns question category, answer guidelines, " +
    "relevant resume excerpts, job requirements to reference, tone guidance, and max word count. " +
    "Use this BEFORE writing any free-text answer to ensure quality and relevance.",
  parameters: Type.Object({
    questionText: Type.String({ description: "The free-text question from the form" }),
  }),
  execute: async (_toolCallId, params) => {
    const questionText = String((params as Record<string, unknown>).questionText ?? "");
    const profile = compactDeferredProfile(contextCore, jobContext);
    const resume = (profile.resume ?? {}) as Record<string, unknown>;
    const jobDesc = String(jobContext?.jobDescription ?? "");
    const company = String(jobContext?.companyName ?? "");
    const role = String(jobContext?.roleTitle ?? "");

    const { buildAnswerContext } = await import("./answer-generator.js");
    const ctx = buildAnswerContext({
      questionText,
      resumeData: resume,
      jobDescription: jobDesc || null,
      companyName: company || null,
      roleTitle: role || null,
    });

    return toToolResult({
      ok: true,
      context: ctx,
      prompt:
        `Write a ${ctx.tone} answer to "${ctx.question}" in under ${ctx.maxWords} words.\n\n` +
        `Guidelines: ${ctx.answerGuidelines}\n\n` +
        (ctx.relevantResumeExcerpts.length > 0
          ? `Your relevant experience:\n${ctx.relevantResumeExcerpts.map((e) => `- ${e}`).join("\n")}\n\n`
          : "") +
        (ctx.relevantJobRequirements.length > 0
          ? `Job requirements to address:\n${ctx.relevantJobRequirements.map((r) => `- ${r}`).join("\n")}\n\n`
          : "") +
        (ctx.companyInfo ? `${ctx.companyInfo}\n` : "") +
        (ctx.roleTitle ? `Role: ${ctx.roleTitle}\n` : ""),
    });
  },
},
```

---

### Phase 3: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Free-text answer protocol
1. For ANY free-text question (textarea, "Why us?", "Tell us about...", "Additional info"):
   - Call `runtime.build_answer_context` with the question text.
   - Use the returned `prompt` as the basis for generating your answer.
   - Follow the `answerGuidelines` and `tone` instructions.
   - Stay within the `maxWords` limit.
2. Quality requirements:
   - **Be specific**: Reference actual skills, projects, and achievements from the resume.
   - **Be relevant**: Connect your answer to the job requirements.
   - **Be concise**: Most ATS fields have hidden character limits (500-2000 chars).
   - **Be authentic**: Don't use buzzwords or generic phrases.
3. For "Additional information" fields:
   - Leave blank if nothing specific to add.
   - Only fill if the user has context not captured elsewhere.
4. For cover letter textareas:
   - Follow the cover letter structure from the guidelines.
   - Keep under 250 words.
   - Mention the company name AND role title.

## Answer quality checklist
Before filling a free-text field, verify your answer:
- [ ] References the specific company/role (not generic)
- [ ] Includes at least one concrete experience/achievement from resume
- [ ] Addresses what the question is actually asking
- [ ] Is within the word limit
- [ ] Doesn't repeat information already in other fields
```

---

## Testing Strategy

1. **"Why do you want to work here?"**: Verify answer references the specific company and role from job context.
2. **"Tell us about a project"**: Verify answer uses STAR format with a real project from resume.
3. **"Cover letter" textarea**: Verify structured cover letter within 250 words.
4. **"Additional information"**: Verify the tool recommends leaving blank when no relevant context.
5. **No job context**: Test with missing job description. Verify answer still makes sense with resume data only.
6. **Word count**: Verify generated answers respect the maxWords limit.
