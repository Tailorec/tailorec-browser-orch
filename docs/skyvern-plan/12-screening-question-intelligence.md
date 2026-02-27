# 12 — Screening Question Intelligence

Alignment: inspired

## Problem

Job applications contain screening questions that are **strategically sensitive**. Wrong answers can auto-reject the candidate. The agent needs specific guidance for each question category — generic "fill everything" isn't enough.

### Question Categories and Their Risks

| Category | Risk Level | Failure Mode |
|---|---|---|
| **Work authorization** | 🔴 Critical | Wrong answer = auto-reject by ATS filter |
| **Visa sponsorship** | 🔴 Critical | "Yes" when not needed = filtered out |
| **Years of experience** | 🔴 Critical | Below minimum = auto-reject |
| **EEO demographics** | 🟡 Legal | No risk if "Decline"; risk if fabricated |
| **Salary expectations** | 🟡 Strategic | Too high = filtered; too low = underpaid |
| **Availability / start date** | 🟡 Moderate | "6 months" = deprioritized vs "immediately" |
| **Relocation willingness** | 🟡 Moderate | "No" for remote-only job = fine; "No" for on-site = rejected |
| **Free-text "Why us?"** | 🟠 Quality | Generic = weak application |
| **Custom screening** | Varies | Knockout questions can auto-reject |

---

## Implementation Plan

### Phase 1: open-agent — Screening Question Classifier

This is purely agent-side intelligence — no openclaw-browser changes needed.

#### File: `../open-agent/src/orchestrator/screening-questions.ts` (NEW)

```typescript
/**
 * Screening question pattern matcher for job applications.
 *
 * Classifies snapshot text lines into question categories and provides
 * recommended answers based on profile data.
 */

export type ScreeningCategory =
  | "work_authorization"
  | "visa_sponsorship"
  | "years_experience"
  | "salary_expectation"
  | "start_date"
  | "relocation"
  | "eeo_gender"
  | "eeo_race"
  | "eeo_veteran"
  | "eeo_disability"
  | "criminal_history"
  | "age_verification"
  | "referral_source"
  | "custom_freetext"
  | "custom_select"
  | "unknown";

export type ScreeningQuestionHint = {
  category: ScreeningCategory;
  isKnockout: boolean;          // Can this question auto-reject?
  defaultAnswer: string | null; // Safe default if no profile data
  profileField: string | null;  // Which profile field to pull from
  answerGuidance: string;       // Detailed guidance for the LLM
};

const QUESTION_PATTERNS: Array<{
  patterns: RegExp[];
  category: ScreeningCategory;
  isKnockout: boolean;
  defaultAnswer: string | null;
  profileField: string | null;
  answerGuidance: string;
}> = [
  {
    patterns: [
      /authorized\s+to\s+work/i,
      /legally\s+authorized/i,
      /eligible\s+to\s+work/i,
      /right\s+to\s+work/i,
      /work\s+authorization/i,
      /permitted\s+to\s+work/i,
    ],
    category: "work_authorization",
    isKnockout: true,
    defaultAnswer: "Yes",
    profileField: "user_profile.work_authorization",
    answerGuidance:
      "Select 'Yes' unless the user profile explicitly indicates they are NOT authorized. " +
      "This is a knockout question — 'No' will auto-reject the application on most ATS. " +
      "If the profile doesn't specify, default to 'Yes'.",
  },
  {
    patterns: [
      /require.*(?:visa|sponsorship)/i,
      /need.*sponsorship/i,
      /immigration\s+sponsorship/i,
      /visa\s+sponsorship/i,
      /sponsor.*visa/i,
      /sponsorship.*required/i,
    ],
    category: "visa_sponsorship",
    isKnockout: true,
    defaultAnswer: "No",
    profileField: "user_profile.requires_sponsorship",
    answerGuidance:
      "Select 'No' unless the user profile explicitly indicates they NEED sponsorship. " +
      "This is a knockout question — 'Yes' will often auto-reject. " +
      "If unsure, default to 'No'.",
  },
  {
    patterns: [
      /years?\s+of\s+experience/i,
      /how\s+many\s+years/i,
      /total\s+experience/i,
      /relevant\s+experience/i,
      /professional\s+experience/i,
      /yoe/i,
    ],
    category: "years_experience",
    isKnockout: true,
    defaultAnswer: null,
    profileField: "resume.total_experience_years",
    answerGuidance:
      "Use resume.total_experience_years. Round UP to the nearest integer. " +
      "If the job requires '5+ years' and you have 4.8, round to 5. " +
      "This is a knockout — below the minimum will auto-reject. " +
      "For dropdowns with ranges (e.g., '3-5 years', '5-7 years'), select the range that contains your number. " +
      "If input is a number field, enter the integer value.",
  },
  {
    patterns: [
      /salary/i,
      /compensation/i,
      /pay\s+expectation/i,
      /desired\s+(?:salary|pay|compensation)/i,
    ],
    category: "salary_expectation",
    isKnockout: false,
    defaultAnswer: null,
    profileField: "user_profile.salary_expectation",
    answerGuidance:
      "If the user profile has a salary expectation, use it. " +
      "If not, and the field is OPTIONAL, leave it blank or enter 'Negotiable'. " +
      "If required with a number input, check the job listing for salary range hints. " +
      "For range inputs (min/max), enter a reasonable range. " +
      "NEVER enter $0 or unrealistically low/high numbers.",
  },
  {
    patterns: [
      /start\s+date/i,
      /when.*(?:start|available|begin)/i,
      /earliest.*start/i,
      /availability/i,
      /notice\s+period/i,
    ],
    category: "start_date",
    isKnockout: false,
    defaultAnswer: "Immediately",
    profileField: "user_profile.availability",
    answerGuidance:
      "If profile has availability info, use it. " +
      "Otherwise default to 'Immediately' or '2 weeks notice'. " +
      "For date inputs, use a date 2-4 weeks from today. " +
      "For dropdown selections, pick 'Immediately' or the shortest option.",
  },
  {
    patterns: [
      /willing\s+to\s+relocate/i,
      /open\s+to\s+relocation/i,
      /relocate/i,
    ],
    category: "relocation",
    isKnockout: false,
    defaultAnswer: "Yes",
    profileField: "user_profile.willing_to_relocate",
    answerGuidance:
      "Default to 'Yes' unless the user explicitly specified 'No'. " +
      "For remote-only jobs, this is irrelevant but 'Yes' is still safe.",
  },
  {
    patterns: [/gender/i, /sex/i, /gender\s+identity/i],
    category: "eeo_gender",
    isKnockout: false,
    defaultAnswer: "Decline to self-identify",
    profileField: null,
    answerGuidance:
      "ALWAYS select 'Decline to self-identify' or 'Prefer not to answer'. " +
      "These fields are legally voluntary under EEOC. Never guess or infer.",
  },
  {
    patterns: [/race/i, /ethnicity/i, /racial/i, /ethnic/i],
    category: "eeo_race",
    isKnockout: false,
    defaultAnswer: "Decline to self-identify",
    profileField: null,
    answerGuidance:
      "ALWAYS select 'Decline to self-identify' or 'Prefer not to answer'. " +
      "If no 'decline' option exists, select 'Two or More Races' as the most neutral option.",
  },
  {
    patterns: [/veteran/i, /military/i, /protected\s+veteran/i],
    category: "eeo_veteran",
    isKnockout: false,
    defaultAnswer: "I am not a protected veteran",
    profileField: null,
    answerGuidance:
      "Select 'I am not a protected veteran' or 'Prefer not to answer'. " +
      "Never select a veteran status without explicit profile data.",
  },
  {
    patterns: [/disability/i, /disabled/i, /accommodation/i],
    category: "eeo_disability",
    isKnockout: false,
    defaultAnswer: "Prefer not to answer",
    profileField: null,
    answerGuidance:
      "Select 'I don't wish to answer' or 'Prefer not to answer'. " +
      "This is voluntary under Section 503. Never guess.",
  },
  {
    patterns: [
      /criminal/i, /conviction/i, /felony/i, /arrest/i,
      /background\s+check/i,
    ],
    category: "criminal_history",
    isKnockout: true,
    defaultAnswer: "No",
    profileField: null,
    answerGuidance:
      "Select 'No' unless user profile explicitly indicates otherwise. " +
      "This is a sensitive knockout question.",
  },
  {
    patterns: [/18\s+years/i, /age.*18/i, /at\s+least\s+18/i, /legal\s+age/i],
    category: "age_verification",
    isKnockout: true,
    defaultAnswer: "Yes",
    profileField: null,
    answerGuidance: "Always select 'Yes'. This is a legal compliance checkbox.",
  },
  {
    patterns: [
      /how\s+did\s+you\s+(?:hear|find|learn)/i,
      /referral\s+source/i,
      /where\s+did\s+you/i,
      /source/i,
    ],
    category: "referral_source",
    isKnockout: false,
    defaultAnswer: "Job Board",
    profileField: null,
    answerGuidance:
      "Select 'Job Board', 'Online Job Posting', or 'Company Website'. " +
      "If 'LinkedIn' is an option, prefer it. " +
      "If there's a 'Referral' option and the user was referred, select it.",
  },
];

export function classifyScreeningQuestion(questionText: string): ScreeningQuestionHint {
  const text = questionText.toLowerCase().trim();

  for (const pattern of QUESTION_PATTERNS) {
    for (const regex of pattern.patterns) {
      if (regex.test(text)) {
        return {
          category: pattern.category,
          isKnockout: pattern.isKnockout,
          defaultAnswer: pattern.defaultAnswer,
          profileField: pattern.profileField,
          answerGuidance: pattern.answerGuidance,
        };
      }
    }
  }

  // Heuristic: if it looks like a free-text question
  if (text.includes("?") && text.length > 30) {
    return {
      category: "custom_freetext",
      isKnockout: false,
      defaultAnswer: null,
      profileField: null,
      answerGuidance:
        "This is a custom free-text question. Generate a concise, role-relevant answer " +
        "that connects the user's skills/experience to the job requirements. " +
        "Keep it under 200 words. Be specific, not generic.",
    };
  }

  return {
    category: "unknown",
    isKnockout: false,
    defaultAnswer: null,
    profileField: null,
    answerGuidance: "Unknown question type. Use best judgment based on profile data.",
  };
}

/**
 * Classify multiple questions from a snapshot excerpt.
 * Pass lines that contain question text from the form.
 */
export function classifyScreeningQuestions(
  questionTexts: string[],
): Array<{ question: string; hint: ScreeningQuestionHint }> {
  return questionTexts.map((q) => ({
    question: q.slice(0, 200),
    hint: classifyScreeningQuestion(q),
  }));
}
```

---

### Phase 2: open-agent — Screening Question Tool

#### File: `../open-agent/src/orchestrator/pi-runner.ts`

Add to `createRuntimeTools`:

```typescript
{
  name: "runtime.classify_screening_questions",
  label: "Classify Screening Questions",
  description:
    "Analyze screening question text to classify it (work authorization, visa, " +
    "experience, EEO, salary, etc.) and get recommended answers. " +
    "Pass the question text. Returns: category, isKnockout (can auto-reject?), " +
    "defaultAnswer, profileField to pull from, and detailed answerGuidance. " +
    "ALWAYS use this for screening questions before answering.",
  parameters: Type.Object({
    questions: Type.Array(Type.String({ description: "Question text from the form" })),
  }),
  execute: async (_toolCallId, params) => {
    const questions = (params as Record<string, unknown>).questions as string[];
    const { classifyScreeningQuestions } = await import("./screening-questions.js");
    const results = classifyScreeningQuestions(questions);
    return toToolResult({
      ok: true,
      classifications: results,
      knockoutCount: results.filter((r) => r.hint.isKnockout).length,
      note: "For knockout questions (isKnockout=true), use the defaultAnswer unless profile explicitly overrides. Wrong answers will auto-reject the application.",
    });
  },
},
```

---

### Phase 3: Skill Updates

#### File: `../open-agent/skills/job-application-execution.md`

```markdown
## Screening question protocol
1. When encountering screening questions, extract the question texts.
2. Call `runtime.classify_screening_questions` with the question texts.
3. For each classified question:
   - **Knockout questions** (isKnockout=true): Use the `defaultAnswer` unless the user profile explicitly provides different data via `profileField`.
   - **EEO questions**: ALWAYS "Decline to self-identify" — never guess demographics.
   - **Experience questions**: Use `resume.total_experience_years`, round UP.
   - **Salary questions**: Use profile data if available; otherwise skip if optional, or enter "Negotiable".
   - **Free-text questions**: Generate a concise answer connecting user skills to job requirements.
4. NEVER answer a knockout question incorrectly — it's better to use the safe default than to guess.

## Knockout question safety rules
- Work authorization → default "Yes"
- Visa sponsorship → default "No"
- Criminal history → default "No"
- Age verification → default "Yes"
- Years of experience → MUST match or exceed job minimum
- Use defaults only when profile data is unavailable and confidence is high; otherwise escalate for user confirmation.
```

---

## Testing Strategy

1. **Greenhouse screening**: Test on a Greenhouse application with work auth, visa, experience, EEO, and custom questions.
2. **Lever EEO section**: Verify all EEO questions get "Decline" answers.
3. **Knockout detection**: Verify work authorization is flagged as knockout. Verify salary is NOT flagged as knockout.
4. **Experience matching**: With 4.8 years experience and "5+ years required" question, verify answer is "5".
5. **Custom free-text**: Verify "Why do you want to work here?" is classified as custom_freetext with quality guidance.
