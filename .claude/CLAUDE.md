# Coding Standards

- Enterprise production-level code
- Follow DRY and SOLID principles
- No excessive documentation - only when necessary

# Memory Bank

Location: `.claude/memory-bank/`

**How it works:**
- Each subject has its own file: `{subject}.md`
- Read relevant files at conversation start for context
- When user says "update context" → update relevant `{subject}.md` file(s)
- Suggest context updates when significant decisions or discoveries are made
- **NEVER store API keys, secrets, or sensitive config** - these go in `.env.local` only

**Core files:**
- `project.md` - Project overview, tech stack, goals
- `firebase.md` - Firebase config, collections, auth logic
- `monday.md` - Monday.com API, board structure, column mappings
- `architecture.md` - Code structure, patterns, decisions 
