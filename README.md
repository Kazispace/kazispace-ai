# KaziSpace AI Web App

A Next.js 14 web application for KaziSpace - the AI-native growth engine for the Global South.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: shadcn/ui
- **i18n**: next-intl (en, ru, kk, uz)
- **State Management**: Zustand
- **API Client**: TanStack Query

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone https://github.com/Kazispace/kazispace-ai.git
cd kazispace-ai

# Install dependencies
npm install

# Copy environment variables
cp .env.local.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## API contract (KAZI-3)

Machine-readable types come from the backend OpenAPI snapshot. Human integration notes live in `kazispace-backend/docs/INTEGRATION.md`.

```bash
# Refresh snapshot from backend main (sibling clone)
npm run sync:openapi

# Generate TypeScript paths (after npm install)
npm run gen:api

# Both steps
npm run gen:api:full
```

- Committed snapshot: `docs/openapi.json` (sync from `kazispace-backend` after backend API changes)
- Generated output: `src/types/api.generated.ts` (run `gen:api` after install; commit with API updates)
- Staging API: `https://bot.kazispace.ai`

## Smoke tests (FE health gate)

Automated checks live in this repo; **UAT docs and execution reports** live in [kazispace-test](https://github.com/Kazispace/kazispace-test).

```bash
# Full FE smoke (vitest + health + routes + CV upload proxy)
npm run smoke

# Deploy preview
SMOKE_HOST=https://owen--kazispace.netlify.app npm run smoke

# Include eslint
SMOKE_LINT=1 npm run smoke
```

| Script | What it checks |
| --- | --- |
| `npm test` | Unit tests (session-nav, hub-agent-open, leave-dedicated-hub, …) |
| `npm run smoke:health` | Site reachable + `GET /health` on API |
| `npm run smoke:routes` | `/chat`, `/cv`, `/interview`, `/jobs`, `/mine`, `/login` non-5xx |
| `npm run smoke:cv-upload` | FE `/api/cv/upload` proxy forwards to backend |
| `npm run smoke` | All of the above |

Manual post-deploy UAT: [kazispace-test/docs/frontend/DEPLOY-SMOKE-TEST.md](https://github.com/Kazispace/kazispace-test/blob/main/docs/frontend/DEPLOY-SMOKE-TEST.md)

## Project Structure

```
src/
├── app/
│   ├── [locale]/           # i18n routes
│   │   ├── chat/           # Chat page
│   │   ├── login/          # Login (OTP) page
│   │   ├── mine/           # Profile page
│   │   ├── profile/        # Edit profile page
│   │   ├── subscription/   # Subscription page
│   │   ├── credits/        # Credits page
│   │   └── ledger/         # Transaction history
│   ├── layout.tsx          # Root layout
│   └── globals.css         # Global styles
├── components/
│   ├── layout/             # Header, BottomNav
│   ├── chat/               # Chat components
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── api-client.ts      # API client
│   ├── auth.ts             # Auth utilities
│   ├── store.ts            # Zustand store
│   ├── constants.ts        # Constants
│   └── i18n/               # Translations
└── types/                  # TypeScript types
```

## Features

- 🌐 **Multi-language Support**: English, Russian, Kazakh, Uzbek
- 💬 **AI Chat**: Powered by KaziSpace Bot API
- 📄 **CV Builder**: AI-powered resume generation
- 🎤 **Mock Interviews**: Practice with AI feedback
- 💳 **Credits System**: Purchase and manage credits
- 📱 **Mobile-First**: Responsive design with bottom navigation

## API Integration

The app integrates with the KaziSpace Bot API:

- Base URL: `https://bot.kazispace.ai`
- Authentication: Bearer Token / X-Device-ID
- Endpoints: Auth (OTP), Chat, CV, Interview, Billing

## Design System

- **Primary Color**: Orange `#F47920`
- **Dark Colors**: Navy `#0D1B2A`, `#132237`
- **Background**: White `#FFFFFF`, Light Gray `#F5F7FA`
- **Font**: Inter (Google Fonts)

## Reference Files

The `_reference/` directory contains Owen's original HTML prototypes for reference during development.

## License

© 2026 KaziSpace. All rights reserved.
