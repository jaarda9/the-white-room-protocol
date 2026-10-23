# The White Room Protocol

A Solo Leveling–style self-improvement System. Your real life is the dungeon: daily directives, workouts, study sessions, habits, and long-term goals earn EXP, raise your Hunter Rank (E → S), and shape your stats. **THEIA**, the System's AI analyst, assesses goals, generates training, grades reports, and assigns penalties.

Installable as a PWA. Progress syncs across devices through a 6-character **Subject ID**.

## Core systems

| System | What it does | Code |
|---|---|---|
| **Status & Vitals** | Level, EXP, six attributes (STR AGI VIT INT PER WIS), and HP / MP / STM / Fatigue. Physical work drains STM, mental work drains MP, and rest regenerates them over real time. Pushing past zero triggers Overdrive. | `src/lib/storage.ts` |
| **Daily Quests** | Spiritual, deep-work, reading, study, and physical directives built from your calibrated protocol and weekly gym split. | `src/lib/storage.ts`, `SoloDailyQuestWindow.tsx` |
| **Penalty Quests** | A missed day assigns an AI-generated Penalty Quest. Three in a row escalate to a Detox Protocol. While active, it blocks the quest HUD and reduces EXP. | `src/lib/penalty-system.ts` |
| **Gates** | Long-term goals split into Waves and tasks, rank-assessed by THEIA, with a boss condition, deadline, and clear rewards. | `src/lib/gates.ts` |
| **Chain-Gates** | THEIA autonomously spawns short learning Gates, verified by written reports or quizzes. Effort sets the rest window before the next one. | `src/lib/chain-gates.ts` |
| **Seals** | Bad-habit suppression built on cue → craving → response: Integrity (not a fragile streak), Threat Rank, wards, and an urge timer. | `src/lib/seals.ts` |
| **Titles** | Equippable titles with real mechanical effects (regen, Gate EXP, Overdrive strain). | `src/lib/titles.ts` |
| **Labs** | Physical, Mental, Nutrition (macros + AI meal plans), Spiritual, Knowledge/Kinnu (AI topics and quizzes), Chess, Social. | `src/pages/*Lab.tsx` |
| **Records** | Achievements with a tier-weighted score, weekly/monthly challenges, Skill Tree, Hunter Codex (monthly AI recap), leaderboard, messages, calendar. | `src/lib/achievements.ts`, `codex.ts`, `skill-ledger.ts` |

Every AI feature has a fallback that doesn't call the model: the System always assigns something, even when no LLM is reachable.

## Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind, shadcn/ui, React Router
- **Backend:** Vercel serverless functions in `api/`, plus an Express server (`server.ts`) for local dev
- **Data:** `localStorage` is the live source of truth, synced to MongoDB Atlas as one document per Subject ID (`src/lib/sync-manager.ts` ↔ `api/sync.ts`)
- **AI:** server-side gateway `api/ai.ts`. Gemini first, with OpenRouter / DeepSeek / any OpenAI-compatible provider as fallback. Players can also supply their own Gemini key.

## Running locally

Requires Node 20.12+.

```sh
npm install
npm run dev        # http://localhost:3001 (or whatever PORT is set to)
```

Create `.env.local` in the project root. It's gitignored, so never commit it.

```sh
MONGODB_URI=mongodb+srv://...     # Vercel → Storage → atlas-amber-house → .env.local tab
PORT=3001                         # optional; defaults to 3000
GEMINI_API_KEY=...                # optional, needed for AI features locally
```

Without `MONGODB_URI`, the API logs an error and falls back to an in-memory store, so nothing persists. See `.env.example` for every supported variable.

`/chatgpt-test` is an AI provider test console. It's only available in local dev and is excluded from production builds.

## Deployment

Pushing to `main` deploys to Vercel. Environment variables live in the Vercel project settings. `MONGODB_URI` is managed by the MongoDB Atlas integration, so rotate it with **Rotate Integration Secrets** and then redeploy.

## More docs

- [CHATGPT_INTEGRATION.md](CHATGPT_INTEGRATION.md): AI gateway, providers, env vars
- [MONGODB_SYNC_GUIDE.md](MONGODB_SYNC_GUIDE.md): how sync works
- [docs/PROFILE_CREATION_AND_SYNC.md](docs/PROFILE_CREATION_AND_SYNC.md): Subject ID login and profile sync
- [PWA_SETUP.md](PWA_SETUP.md): installing as an app
- [ideas.txt](ideas.txt): design notes behind the vitals and EXP systems
