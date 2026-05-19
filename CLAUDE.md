# Global AI Business Intelligence Radar - Project Rules

This document outlines the core architecture, constraints, and operational guidelines for Claude Code. Adhere strictly to these rules during code generation, refactoring, and debugging.

---

## 🧭 Project Vision & Architecture
A 100% serverless, zero-cost, GitOps-driven market intelligence platform that aggregates global multi-industry news and social sentiment, analyzes it via DeepSeek V4, and renders an Apple-style minimalist dashboard.

### 🔄 The GitOps Data Pipeline (3x Daily)
`GitHub Actions (Cron Trigger)` -> `Fetch News/Social APIs` -> `DeepSeek V4 Inference` -> `Write local JSON` -> `Git Commit/Push to Repo` -> `Vercel Static Rebuild`

---

## 🚫 Critical Constraints & Anti-Patterns (DO NOT VIOLATE)
*   **NO DATABASES / NO ORMs**: Do not install or configure Supabase, Prisma, MongoDB, PostgreSQL, or any external database clients. The GitHub repository itself acts as the flat-file JSON database.
*   **NO STATE IN NEXT.JS API ROUTES**: Do not create dynamic serverless backend endpoints for data mutation. All data processing must happen in isolated automation scripts runner.
*   **NO HARDCODED CREDENTIALS**: Never append API keys or passwords directly into files. Use `process.env.DEEPSEEK_API_KEY` and `process.env.NEWS_API_KEY`.
*   **ISOLATION**: Keep automation scripts completely separated from Next.js frontend code. All orchestration logic lives under `scripts/`.

---

## 🛠️ Tech Stack Spec
*   **Frontend**: Next.js 15+ (App Router), TypeScript, Tailwind CSS, shadcn/ui.
*   **Data Visualization**: Recharts (for clean, high-contrast graphs).
*   **Scripting Runtime**: Node.js (with `axios`, `rss-parser`).
*   **LLM Provider**: DeepSeek V4 Flash via OpenAI-compatible SDK (Endpoint: `api.deepseek.com`, Model: `deepseek-v4-flash`).

---

## 📂 File Structure Conventions
Data must be written and archived exclusively under the following paths:
*   **Latest Cache**: `src/data/latest.json` (Overwritten every run, tied directly to the frontend home view).
*   **Historical Archive**: `src/data/history/YYYY-MM-DD.json` (Appended every run for long-term historical tracking).

---

## 💻 Standard Commands for Claude Code
*   **Run Local Pipeline**: `npm run pipeline` (Triggers `node scripts/main.js`)
*   **Frontend Development**: `npm run dev`
*   **Frontend Build Check**: `npm run build`

---

## 🤖 DeepSeek V4 JSON Output Contract
All automated analysis prompts sent to DeepSeek must enforce `response_format: { type: "json_object" }` and map strictly to the UI schema:
*   `macroMetrics`: `{ economicConfidence: number, regulatoryPressure: number, marketSentiment: number }`
*   `industryRadar`: `Array<{ subject: string, hotness: number, sentiment: number }>`
*   `economicForecast`: `string` (High-density market deduction essay)
*   `catalystFactors`: `Array<string>` (Chain-reaction bullet points)
*   `articles`: `Array<{ title: string, source: string, category: string, url: string, summary: Array<string> }>`