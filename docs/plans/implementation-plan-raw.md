# Implementation Plan

```json
{
  "fitEvaluation": {
    "stackCoverage": {
      "verdict": "high",
      "reasoning": "This project exercises all four target stack tools meaningfully. TypeScript is used throughout. React handles the multi-step form state and structured output rendering — non-trivial component work. Next.js is load-bearing: Server Components fetch saved Transitions and Projects from the database, Route Handlers proxy AI API calls (keeping the API key server-side), and the app/router structure maps directly to the tool's two-stage UX. Postgres stores users, Transitions (bridge analyses), and Projects (implementation plans) — requiring real schema design with foreign keys and typed queries. The AI API integration is not in your target stack, but it's the project's core value proposition and adds a meaningful async data-flow challenge on top of the stack fundamentals.",
      "missingTools": []
    },
    "scope": {
      "verdict": "realistic",
      "reasoning": "At 240+ available hours, the core feature set — two-stage form flow, AI API integration with structured JSON output, auth, persistence, and deploy — runs approximately 70–90 hours. That leaves 150+ hours unspent if you ship only the described feature set. The project as described is portfolio-worthy but under-uses the timeline. Recommended additions are listed below; without them, you'll finish feature-complete by week 8 and spend weeks 9–12 on polish that returns diminishing hiring signal.",
      "recommendations": [
        "Add streaming AI responses with a visible token-by-token render — this is a distinct technical challenge (ReadableStream, async iteration, incremental JSON parsing) that directly demonstrates you understand the browser runtime and Next.js server-client boundary. This is already planned as a core feature via the Vercel AI SDK.",
        "Add shareable public URLs for generated analyses (e.g., /transitions/[id] with a public flag) — requires understanding row-level access control and demonstrates you can reason about multi-user data isolation.",
        "Add the ability for users to edit and re-prompt specific sections of a generated plan — introduces optimistic UI updates and partial mutation patterns, both high-signal interview topics."
      ]
    },
    "hiringSignal": {
      "verdict": "strong",
      "reasoning": "This hits the highest-signal pattern from your Stage 1 analysis: a multi-step form producing AI-generated structured output, with auth and per-user persistence. It also has a credible real-world use case that a hiring engineer will understand in 30 seconds. The AI API integration differentiates it from a generic CRUD app. Shareable public links and streaming responses push it from 'competent portfolio piece' to 'this person ships products.' The meta angle (a tool for stack transitions, built during a stack transition) makes for a natural interview narrative."
    }
  },
  "stackForProject": [
    {
      "tool": "TypeScript",
      "source": "user_target",
      "purpose": "End-to-end type safety across form inputs, AI response schemas, database query results, and API contracts."
    },
    {
      "tool": "React",
      "source": "user_target",
      "purpose": "Multi-step form state, controlled inputs for stack/timeline fields, and rendering the structured plan output as interactive UI."
    },
    {
      "tool": "Next.js 15 (App Router)",
      "source": "user_target",
      "purpose": "Unified full-stack framework: app/router for page structure, Server Components for database reads, Route Handlers for AI API proxying and mutations."
    },
    {
      "tool": "PostgreSQL (Neon)",
      "source": "user_target",
      "purpose": "Persists users, Transitions (bridge analyses), and Projects (implementation plans) with relational integrity. Neon's serverless connection model pairs cleanly with Vercel."
    },
    {
      "tool": "Prisma ORM",
      "source": "supporting",
      "purpose": "Schema-as-code ORM that generates TypeScript types from your schema and handles migrations via prisma migrate dev. Keeps queries type-safe without hiding the SQL layer."
    },
    {
      "tool": "Clerk",
      "source": "project_specific",
      "purpose": "Hosted auth UI, OAuth providers, session management, and user lifecycle webhooks. auth() on the server, useUser() on the client — no JWT signing or session store to manage."
    },
    {
      "tool": "Anthropic API (Claude)",
      "source": "project_specific",
      "purpose": "Server-side LLM calls. Claude Sonnet for Stage 1 and Stage 2 plan generation; Haiku for any auxiliary calls. Static system-prompt portions use prompt caching."
    },
    {
      "tool": "Vercel AI SDK",
      "source": "project_specific",
      "purpose": "Streaming helper that wraps the Anthropic API with React-friendly hooks. Handles the ReadableStream plumbing on both server and client."
    },
    {
      "tool": "Zod",
      "source": "supporting",
      "purpose": "Runtime validation at trust boundaries: form inputs and LLM JSON outputs. The model's response is untyped at the boundary and must be validated before persisting."
    },
    {
      "tool": "Upstash Redis",
      "source": "project_specific",
      "purpose": "Rate limiting for anonymous generation: 3 generations per IP per day. Prevents anonymous abuse from burning through the Anthropic budget."
    },
    {
      "tool": "Tailwind CSS + shadcn/ui",
      "source": "supporting",
      "purpose": "Utility-first styling and accessible component primitives. Gets you to a professional UI without writing raw CSS; shadcn gives you unstyled-but-correct components (dialogs, accordions, badges) to drop in."
    },
    {
      "tool": "Vercel",
      "source": "supporting",
      "purpose": "Deployment target with native Next.js support. Handles environment variable injection, preview deployments, and cron job scheduling."
    }
  ],
  "phases": [
    {
      "order": 1,
      "name": "Foundation",
      "weekRange": "Week 1–2",
      "goal": "A deployed Next.js app with working auth, a connected Postgres database, and a CI pipeline. No features yet — just the skeleton that everything else builds on.",
      "milestones": [
        {
          "order": 1,
          "title": "Project scaffolded and deployed to Vercel with a passing CI check",
          "tasks": [
            {
              "order": 1,
              "title": "Initialize Next.js project with TypeScript and Tailwind via create-next-app",
              "description": "Accept the app/router default. Verify TypeScript strict mode is on in tsconfig.json.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Push to GitHub and connect repo to Vercel",
              "description": "Confirm a preview deployment succeeds on the first push. This is your deploy pipeline baseline.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Add a GitHub Actions workflow that runs tsc --noEmit on every PR",
              "description": "One YAML file. Fails the check if TypeScript errors exist. This is your safety net for the rest of the build.",
              "completed": false
            }
          ]
        },
        {
          "order": 2,
          "title": "Postgres database connected and schema applied",
          "tasks": [
            {
              "order": 1,
              "title": "Provision a Neon Postgres instance and add DATABASE_URL and DIRECT_DATABASE_URL to .env.local",
              "description": "Never commit .env.local. Add it to .gitignore now. Add production secrets in Vercel's environment variable settings. DIRECT_DATABASE_URL is required by Prisma for migrations against Neon's serverless connection pooler.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Install Prisma and write the initial schema.prisma with User, Transition, and Project models",
              "description": "User: id (Clerk userId as string PK), email, createdAt. Transition: id, userId (nullable FK to User), anonymousSessionId (nullable string), payload Json, createdAt — with a CHECK constraint enforcing exactly one of userId or anonymousSessionId is non-null. Project: id, transitionId (FK to Transition), payload Json, completedTasks (string array), createdAt.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Run prisma migrate dev to apply the schema and confirm tables exist in the Neon console",
              "completed": false
            }
          ]
        },
        {
          "order": 3,
          "title": "Auth working: users can sign in and sign out",
          "tasks": [
            {
              "order": 1,
              "title": "Install Clerk and add ClerkProvider to the root layout",
              "description": "Add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY to .env.local and Vercel. Register a GitHub OAuth provider in the Clerk dashboard.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Add middleware.ts using Clerk's clerkMiddleware() to protect routes",
              "description": "Protected paths: /dashboard, /api/transitions/[id]/*, /api/tasks/*. Public paths: /, /sign-in, /sign-up, /transitions/new, /api/transitions/generate. This is also where the anonymous session cookie is issued for eligible paths. This is the single auth enforcement point — not per-route getServerSession calls.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Create the /api/webhooks/clerk Route Handler for user lifecycle events",
              "description": "Verify the Svix signature using CLERK_WEBHOOK_SECRET before processing — return 401 if verification fails. On user.created: insert a User row keyed by the Clerk user ID. This is how users get into Postgres — not an upsert on sign-in.",
              "completed": false
            },
            {
              "order": 4,
              "title": "Add sign-in and sign-out UI and confirm the /dashboard redirect works for unauthenticated users",
              "description": "Clerk's <SignInButton> and <UserButton> components handle the UI. Use auth() in Server Components to get the current user — not getServerSession.",
              "completed": false
            }
          ]
        }
      ],
      "learningCallouts": [
        "Web deployment: environment variables, hosting, and CI — first encountered here. .env.local, Vercel secret injection, and the GitHub Actions check are your first hands-on reps with this concept. Note that DATABASE_URL and DIRECT_DATABASE_URL are both needed for Prisma on Neon.",
        "HTTP, REST, and statelessness — first encountered here. Clerk session cookies are the concrete implementation of statelessness workarounds: the server issues a session token, stores nothing in memory between requests, and the token reconnects the request to the user. Separately, /api/webhooks/clerk demonstrates a different HTTP pattern: Clerk calling your server (not the browser), with signature verification as the auth mechanism.",
        "Server/client boundary in Next.js — first encountered here. The middleware.ts file runs before every request and is your first non-component server-side code. The protected /dashboard route uses auth() in a Server Component — this is the pattern you'll use everywhere."
      ]
    },
    {
      "order": 2,
      "name": "Stage 1 Core: Bridge Analysis",
      "weekRange": "Week 3–5",
      "goal": "A user can fill out the Stage 1 form (current stack, target stack, timeline, hours per week), submit it, and receive a rendered bridge analysis generated by Claude — streamed progressively and saved as a Transition row.",
      "milestones": [
        {
          "order": 1,
          "title": "Stage 1 multi-step form collects and validates all required inputs",
          "tasks": [
            {
              "order": 1,
              "title": "Build the Stage 1 form as a Client Component with useState controlling each field",
              "description": "Fields: current stack (text), target stack (text), years of experience, timeline in weeks, hours per week. No submission logic yet.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Define a Zod schema for the Stage 1 form payload and add client-side validation",
              "description": "Validate on submit, display inline field errors using shadcn Form primitives. This is your first use of Zod.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Break the form into 3 steps with a progress indicator (step 1: stacks, step 2: timeline, step 3: review)",
              "description": "Manage current step index with useState. Validate each step before advancing.",
              "completed": false
            }
          ]
        },
        {
          "order": 2,
          "title": "AI API call streams a bridge analysis and saves it as a Transition row",
          "tasks": [
            {
              "order": 1,
              "title": "Create the POST /api/transitions/generate Route Handler",
              "description": "Check Clerk session with auth() — if no session, check for the anon_session cookie set by middleware. Rate-limit anonymous requests via Upstash Redis: 3 generations per IP per day, returning 429 if exceeded. Validate the form payload with Zod before proceeding.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Write and iterate on the Stage 1 system prompt to produce JSON matching the Transition schema",
              "description": "Mark the static system-prompt portion with Anthropic's cache_control to enable prompt caching. Expect 2–4 iterations before output is consistently parseable.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Use the Vercel AI SDK's streamText to call Claude Sonnet and pipe the response to the browser",
              "description": "Stream to the browser immediately. Accumulate the full response server-side. On completion: parse JSON, validate with Zod, write a Transition row (userId from Clerk session, or anonymousSessionId from cookie), return the new Transition ID. On parse/validation failure: log raw output server-side, return 422 with a regenerate affordance.",
              "completed": false
            }
          ]
        },
        {
          "order": 3,
          "title": "Analysis results render progressively and redirect to /transitions/[id]",
          "tasks": [
            {
              "order": 1,
              "title": "Build the streaming output Client Component using the AI SDK's useCompletion hook",
              "description": "Use partial-json or a similar library to extract complete sections from the stream as tokens arrive. Render each section (summary, skillBridge, timeline) as it completes rather than waiting for the full response.",
              "completed": false
            },
            {
              "order": 2,
              "title": "On stream completion, redirect to /transitions/[id] — the server-rendered Transition view",
              "description": "The /transitions/[id] page is a Server Component. It reads the saved Transition row from Postgres via Prisma and renders the full bridge analysis.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Render the skill bridge as a table, new concepts as a card grid, and timeline checkpoints as a vertical timeline",
              "description": "Use shadcn Table, Card, and Badge components. Build the layout with Tailwind.",
              "completed": false
            }
          ]
        }
      ],
      "learningCallouts": [
        "SQL and relational data modeling — first encountered here. The Transition table design requires a deliberate decision: the ownership invariant (userId XOR anonymousSessionId, enforced by CHECK constraint) is your first real schema constraint that reflects a business rule, not just data shape.",
        "The browser as a runtime — first encountered seriously here. The form is a Client Component (interactivity requires the browser). The Route Handler is server-only (API key stays server-side). The stream crosses the boundary: the server writes to a ReadableStream, the browser consumes it. Trace this data path before moving on.",
        "CSS layout: Flexbox and Grid — first encountered seriously here. The skill bridge table, card grid, and timeline component each require a different layout model. shadcn gives you structure; you still need to understand what Tailwind flex/grid classes are doing."
      ]
    },
    {
      "order": 3,
      "name": "Stage 2 Core: Project Plan",
      "weekRange": "Week 6–8",
      "goal": "From a completed Transition, a user can describe a project idea and receive a structured implementation plan — with phases, milestones, tasks, and done criteria — saved as a Project row linked to the Transition.",
      "milestones": [
        {
          "order": 1,
          "title": "Stage 2 form collects project description with Transition context attached",
          "tasks": [
            {
              "order": 1,
              "title": "Build /transitions/[id]/plan/new as a Server Component that reads the saved Transition from Postgres",
              "description": "The transition ID comes from the URL. Fetch server-side with Prisma and pass as a prop to the Client Component form. Data fetching stays on the server.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Build the Stage 2 form: project description textarea and optional specific requirements field",
              "description": "Validate that the description is at least 50 characters before allowing submission.",
              "completed": false
            }
          ]
        },
        {
          "order": 2,
          "title": "AI API call streams a structured project plan and saves it as a Project row",
          "tasks": [
            {
              "order": 1,
              "title": "Create the POST /api/transitions/[id]/plan/generate Route Handler",
              "description": "Fetch the saved Transition from Postgres inside the Route Handler — don't trust the client to send the full context. Verify ownership: transition.userId must match the Clerk user ID (or anonymousSessionId must match the cookie). Return 404, not 403, on ownership mismatch — never confirm the resource exists to a non-owner.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Write the Stage 2 system prompt with the full Transition context object included",
              "description": "The prompt must include the complete Stage 1 output. Mark the static portion with cache_control. Expect the prompt to be 1500–3000 tokens.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Add a Zod schema for the Stage 2 plan output and validate the AI response",
              "completed": false
            },
            {
              "order": 4,
              "title": "Persist the validated plan as a Project row with a foreign key to the source Transition",
              "description": "On stream completion: parse, validate, write to DB, return the Project ID.",
              "completed": false
            }
          ]
        },
        {
          "order": 3,
          "title": "Plan results render at /transitions/[id]/plan as a navigable, interactive page",
          "tasks": [
            {
              "order": 1,
              "title": "Render the fit evaluation section: stack coverage, scope verdict, and hiring signal with color-coded badges",
              "completed": false
            },
            {
              "order": 2,
              "title": "Render phases as an accordion: each phase expands to show milestones, tasks with checkboxes, and learning callouts",
              "description": "Use shadcn Accordion. Checkbox state is local (useState) for now — persistence comes in Phase 4.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Render the definition of done section: must-haves as a checklist, stretch goals as a secondary list",
              "completed": false
            }
          ]
        }
      ],
      "learningCallouts": [
        "Server/client boundary in Next.js — deepened here. /transitions/[id]/plan/new is your first deliberate composition of a Server Component (Transition data fetch via Prisma) wrapping a Client Component (interactive form). Get this pattern right and it will feel natural for the rest of the project.",
        "Authentication patterns: row-level authorization — first encountered in depth here. The Route Handler must verify the requesting user owns the Transition. This is ownership enforcement: fetch the row, compare userId to Clerk's auth(), return 404 if mismatch. The 404-not-403 choice is deliberate — see error handling in architecture.md."
      ]
    },
    {
      "order": 4,
      "name": "Persistence, Dashboard, and Anonymous Claim",
      "weekRange": "Week 9–10",
      "goal": "Users can return to the app and find their saved Transitions and Projects. Task completion state persists. Anonymous Transitions generated before sign-up are claimed on account creation.",
      "milestones": [
        {
          "order": 1,
          "title": "Dashboard lists all of a user's saved Transitions and Projects",
          "tasks": [
            {
              "order": 1,
              "title": "Build /dashboard as a Server Component that queries all Transitions for the current user via Prisma",
              "description": "Include the linked Project in the query. Order by createdAt DESC.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Render each Transition as a card: headline, target stack, created date, and a link to its plan if one exists",
              "completed": false
            }
          ]
        },
        {
          "order": 2,
          "title": "Task completion state persists across sessions",
          "tasks": [
            {
              "order": 1,
              "title": "Create a PATCH /api/tasks/[id]/toggle Route Handler that updates the completedTasks array on the Project row",
              "description": "Validate ownership (check the parent Transition's userId) before writing. Return 404 on mismatch.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Wire the checkbox onChange to a debounced fetch to the toggle endpoint",
              "description": "Debounce at 500ms. Update the checkbox state immediately (optimistic update), sync in the background. This is your first optimistic UI pattern.",
              "completed": false
            }
          ]
        },
        {
          "order": 3,
          "title": "Anonymous Transitions are claimed on sign-up",
          "tasks": [
            {
              "order": 1,
              "title": "Update the /api/webhooks/clerk handler to run the claim query on user.created",
              "description": "After inserting the User row, run: UPDATE transitions SET userId = newUserId, anonymousSessionId = null WHERE anonymousSessionId = <cookie value from request context>. Apply the same update to any linked Project rows. Clear the anonymous cookie.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Add a 'Save to your account' banner on /transitions/[id] for unauthenticated users",
              "description": "The banner prompts sign-up. On sign-up, the webhook claim runs automatically. No extra client-side logic needed.",
              "completed": false
            }
          ]
        }
      ],
      "learningCallouts": [
        "SQL and relational data modeling — deepened here. The dashboard query joins User → Transition → Project. Write the Prisma query with include to understand what the ORM is generating before accepting it.",
        "HTTP, REST, and statelessness — reinforced here. The PATCH /api/tasks/[id]/toggle endpoint is a clean REST partial-update example. The claim-on-signup flow demonstrates a different pattern: a server-to-server webhook triggering a database mutation on behalf of a user who just authenticated."
      ]
    },
    {
      "order": 5,
      "name": "Polish and Ship",
      "weekRange": "Week 11–12",
      "goal": "The app is deployed, documented, and ready to show in an interview. Error states are handled. Anonymous transition cleanup runs on a schedule. The README explains architectural decisions.",
      "milestones": [
        {
          "order": 1,
          "title": "Error handling covers all user-facing failure modes",
          "tasks": [
            {
              "order": 1,
              "title": "Add an error.tsx boundary to the app/router that catches unhandled exceptions and shows a user-readable message with a refresh action",
              "completed": false
            },
            {
              "order": 2,
              "title": "Handle AI API failures explicitly: timeout, malformed JSON, validation failure, and rate-limit hit each return a structured error body with a retry affordance",
              "description": "These are the four most common failure modes in production AI apps. The client should distinguish between 'try again' (timeout, rate limit) and 'something is wrong' (validation failure).",
              "completed": false
            },
            {
              "order": 3,
              "title": "Add loading.tsx skeletons for /dashboard and /transitions/[id]",
              "completed": false
            }
          ]
        },
        {
          "order": 2,
          "title": "Anonymous transition cleanup cron job running",
          "tasks": [
            {
              "order": 1,
              "title": "Add a POST /api/cron/cleanup-anonymous Route Handler that deletes Transitions and Projects where anonymousSessionId is non-null and createdAt is older than 30 days",
              "description": "Validate the request with a CRON_SECRET header check before processing — return 401 if missing or wrong.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Add the cron schedule to vercel.json: run daily",
              "description": "Vercel Cron calls the endpoint on schedule. Add CRON_SECRET to Vercel environment variables.",
              "completed": false
            }
          ]
        },
        {
          "order": 3,
          "title": "README written and production deploy verified",
          "tasks": [
            {
              "order": 1,
              "title": "Write a README covering: what the tool does, the tech stack and why each tool was chosen, the two-stage architecture, and how to run it locally",
              "description": "The 'why each tool was chosen' section is what hiring engineers read. Write it as if you're explaining your decisions in an interview. Reference decisions-log.md for the reasoning behind Prisma, Clerk, and Neon.",
              "completed": false
            },
            {
              "order": 2,
              "title": "Verify the production Vercel deploy works end-to-end: sign in, create a Transition, generate a Project plan, check that an anonymous Transition is claimable on sign-up",
              "description": "Run through the full happy path on production, not localhost. Fix any environment-specific issues.",
              "completed": false
            },
            {
              "order": 3,
              "title": "Record a 2–3 minute Loom walkthrough of the app for use in job applications",
              "description": "Demo the full flow. Mention one architectural decision you made and why. Keep it under 3 minutes.",
              "completed": false
            }
          ]
        }
      ],
      "learningCallouts": [
        "Web deployment: environment variables, hosting, and CI — completed here. The production verification step is deliberate: environment bugs only appear in production, and discovering them now rather than during an interview demo matters. The cron job is your first Vercel-specific infrastructure configuration.",
        "The browser as a runtime — completed here. By this point you've built streaming responses, optimistic UI updates, and anonymous session cookies. The summary concept from your bridge analysis should now be concrete: the browser is a stateless, event-driven runtime that communicates with your server over HTTP and renders UI from that state."
      ]
    }
  ],
  "definitionOfDone": {
    "mustHave": [
      "User can sign in with GitHub OAuth via Clerk and sign out",
      "Anonymous user can generate a Transition without signing in (rate-limited to 3/IP/day via Upstash)",
      "User can submit a Stage 1 form and receive a streamed bridge analysis from Claude Sonnet",
      "User can submit a Stage 2 form (with Transition context attached) and receive a streamed project plan",
      "Both Transitions and Projects are persisted to Postgres via Prisma and survive page refresh",
      "Dashboard shows all of a user's saved Transitions with links to their Projects",
      "Task checkboxes in the plan persist to the database via PATCH /api/tasks/[id]/toggle",
      "Anonymous Transitions are claimed and assigned to the user on sign-up via the Clerk webhook",
      "Route Handlers return 404 (not 403) on ownership mismatch",
      "Daily cron job deletes anonymous Transitions and Projects older than 30 days",
      "App is deployed on Vercel with a public URL",
      "All environment secrets are in Vercel config, not committed to the repo",
      "README explains the tech stack choices and two-stage architecture"
    ],
    "stretchIfTimePermits": [
      "Shareable public URLs for Transitions (is_public toggle with unauthenticated read support)",
      "Ability to regenerate a specific phase of a plan without re-running the full Stage 2 prompt",
      "Email/password auth as an alternative to GitHub OAuth (Clerk supports this without code changes — configuration only)",
      "A landing page with a sample Transition visible without sign-in to reduce friction for new users"
    ]
  }
}
```
