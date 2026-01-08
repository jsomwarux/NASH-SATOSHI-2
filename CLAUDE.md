# Claude Code Working Agreement

This file establishes guidelines for Claude Code agents working on this project. Follow these instructions to maintain consistency across sessions.

---

## Session Startup Protocol

### Step 1: Gather Context (MANDATORY)
Before making any changes, read these files in order:
1. **`PROJECT_CONTEXT.md`** - Understand the app architecture, tech stack, and key implementation details
2. **`CHANGELOG.md`** - Review recent changes, what's working, and what's still broken

### Step 2: Understand the Request
For each set of instructions:
1. **Parse the goal** - What outcome does the user want?
2. **Identify scope** - Which files/systems are involved?
3. **Spot dependencies** - What might break? What needs to stay consistent?

### Step 3: Clarify Before Coding
If the request is ambiguous or has multiple valid approaches:
- Ask clarifying questions BEFORE implementing
- Present options with trade-offs when relevant
- Don't assume - verify intent for anything non-obvious

---

## Working Style

### Think Deeply Before Acting
- Consider edge cases and failure modes
- Check how changes affect related systems
- Look for existing patterns in the codebase and follow them

### Make Minimal, Focused Changes
- Only modify what's necessary to achieve the goal
- Don't refactor unrelated code
- Don't add features that weren't requested
- Don't add comments/docstrings to code you didn't change

### Verify Your Work
- Run `npx tsc --noEmit` after TypeScript changes
- Test that the app still builds/runs when relevant
- Check for console errors in browser if making frontend changes

---

## Code Style Guidelines

### TypeScript
- Use explicit types over `any`
- Prefer `const` over `let`
- Use async/await over raw Promises

### React
- Use functional components with hooks
- Colocate related state
- Use TanStack Query for server state

### File Organization
- Keep components in appropriate directories under `client/src/components/`
- API logic goes in `server/routes.ts`
- Database operations go in `server/storage.ts`
- Shared types go in `shared/schema.ts`

---

## Critical Systems - Handle With Care

### Gumloop Integration (`server/routes.ts`)
- `user_id` and `saved_item_id` are **URL query params**, not body
- Input uses `pipeline_inputs` array with `{ input_name, value }` objects
- Input node name is **"Token Input"** (exact, case-sensitive)
- Token value has **NO $ prefix**

### Stripe Integration (`server/stripe.ts`)
- Test mode vs live mode keys matter
- Webhook signature verification is critical
- Don't modify pricing logic without explicit request

### Authentication (`server/auth.ts`)
- Uses Supabase Auth
- `requireAuth` middleware for protected routes
- `optionalAuth` for routes that work with or without auth

---

## Session Wrap-Up Protocol

Before ending a session, update `CHANGELOG.md` with:
1. **Summary** - 1-2 sentences on what was accomplished
2. **Changes Made** - 5-10 bullet points of specific changes
3. **Files Modified** - List with brief descriptions
4. **Commands Run** - Any build/test commands executed
5. **Current State** - What's working now
6. **Still Broken** - Known issues or incomplete work

---

## Communication Style

- Be direct and concise
- Explain the "why" for non-obvious decisions
- If something seems wrong with the user's request, say so respectfully
- Don't use excessive praise or filler language
- No emojis unless the user uses them first

---

## When Stuck

1. Re-read `PROJECT_CONTEXT.md` for architectural context
2. Check `CHANGELOG.md` for recent related changes
3. Search the codebase for similar patterns
4. Ask the user for clarification rather than guessing
