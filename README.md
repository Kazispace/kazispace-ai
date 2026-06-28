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
