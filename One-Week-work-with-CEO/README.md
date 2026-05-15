# One Week Review with CEO

This repo contains everything you need to complete your one-week intern task when working with CEO. Read this README first, then follow the instructions in the task allocation PDF.

## Repo Structure

```
.
├── discord-bot/               # 🤖 Job Hunter Bot — live Upwork scraper powering all campaigns
├── electron-app/              # ⚡ Main App (START HERE) — the full desktop platform you'll be working in
├── Intern_Task_Allocation.pdf # 📋 Your Mission Brief — read this before touching any code
└── README.md
```

## What's Inside

### 1. 🤖 Job Hunter Bot (`discord-bot/`)
The live Upwork scraper that hunts and fetches real job listings based on search queries — in real time. This is the engine behind every campaign run. When a campaign fires, this bot is what goes out and grabs the jobs. Without it, the app has no data.

### 2. ⚡ Main App — The Core Platform (`electron-app/`)
**This is the main codebase you'll be working in.** A full-featured desktop application built with Electron (JavaScript) that ties everything together — campaign creation, job filtering, ChatGPT viability checks, and the Upwork SEO Board. This is where the product lives.

### 3. Task Allocation PDF (`Intern_Task_Allocation.pdf`)
Your complete task document containing:
- Project overview (what the existing codebase does)
- Loom video links (watch ALL of them)
- Module 1 to-do list (Upwork SEO Bot tasks)
- Module 2 to-do list (Listing Website tasks)
- Deliverables
- FAQs
- First meeting agenda

## Getting Started

1. **Read the PDF first** — Open `Intern_Task_Allocation.pdf` and read it cover to cover
2. **Watch all Loom videos** — Links are in the PDF under Resources & Reference Links
3. **Explore the codebase** — Look through `discord-bot/` and `electron-app/` to understand the existing code
4. **Prepare your questions** — Write down anything unclear before the first meeting
5. **Meeting** — You will explain the project back to the CEO. The 1-week deadline starts from this meeting.

## Tech Stack

- **Electron App**: JavaScript
- **Discord Bot**: JavaScript
- **Upwork SEO Board**: Python
- **Database**: MongoDB (currently) — your task is to migrate to PostgreSQL

## Important Rules

- **Do NOT** start from scratch or introduce a new tech stack — build on top of what exists
- **Do NOT** touch any modules outside of what is assigned in the PDF
- **Do NOT** wait until the deadline to ask questions — ask early
- Your scope is ONLY the live Upwork query module and the listing website

## Questions?

Re-watch the Loom videos first. If still stuck, document your specific question (what you tried, what error you got, what you expected) and reach out. Vague messages like "it's not working" will not get a response.

---

# 🚀 AI Automation Dashboard

<div align="center">

**A powerful Electron-based desktop application for automating GitHub repository creation at scale**

[![Electron](https://img.shields.io/badge/Electron-32.2.0-47848F?logo=electron&logoColor=white)](https://electronjs.org)
[![React](https://img.shields.io/badge/React-18.3.1-61DAFB?logo=react&logoColor=white)](https://reactjs.org)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.4.14-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

</div>

---

## 📖 Overview

AI Automation Dashboard is a modular desktop application that automates the entire GitHub repository creation workflow. It integrates Google Sheets for data management, uses Puppeteer to interact with ChatGPT's web interface (no API key required), and leverages the GitHub API to create fully-configured repositories with README files, topics, and issues.

Perfect for:
- 🏢 **Dev shops** creating multiple demo projects
- 📚 **Educators** setting up student repositories
- 🔬 **Researchers** organizing code artifacts
- 💼 **Product teams** bootstrapping microservices

---

## ✨ Features

### 🎯 Core Functionality
- **Campaign Management**: Organize automation tasks into campaigns
- **Google Sheets Integration**: Read keywords from spreadsheets
- **AI-Powered Generation**: ChatGPT creates repo names, descriptions, README, tags, and issues
- **GitHub Automation**: Full repo creation with initial content
- **Real-Time Monitoring**: Live log viewer with status updates

### 🎨 User Experience
- **Modern UI**: Glassmorphism design inspired by Vercel and Linear
- **Sidebar Navigation**: Easy access to all modules
- **Responsive Layout**: Works on all screen sizes
- **Smooth Animations**: Framer Motion for fluid transitions
- **Dark Mode**: Eye-friendly interface

### 🔧 Technical
- **Modular Architecture**: Easy to extend with new automation modules
- **IPC Communication**: Secure Electron main/renderer process separation
- **Local Storage**: JSON-based campaign and log persistence
- **Error Handling**: Comprehensive retry and error reporting
- **Cross-Platform**: macOS, Windows, and Linux support

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, TailwindCSS, Framer Motion, Lucide Icons |
| **Desktop Framework** | Electron 32 with IPC |
| **Build Tools** | Vite, electron-builder |
| **Automation** | Puppeteer (ChatGPT scraping) |
| **APIs** | GitHub REST API, Google Sheets API |
| **State Management** | React Hooks, Zustand (optional) |
| **Data Persistence** | Local JSON storage |

---

## 📁 Project Structure

```
ai-automation-dashboard/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── main.js              # App entry point
│   │   ├── ipcHandlers.js       # IPC communication handlers
│   │   └── menu.js              # Application menu
│   ├── renderer/                # React UI
│   │   ├── components/          # Reusable UI components
│   │   │   ├── Sidebar.jsx
│   │   │   ├── CampaignList.jsx
│   │   │   ├── CreateCampaignModal.jsx
│   │   │   └── LogViewer.jsx
│   │   ├── pages/               # Route pages
│   │   │   ├── Dashboard.jsx
│   │   │   ├── GitHubRepoGenerator.jsx
│   │   │   ├── Settings.jsx
│   │   │   └── Logs.jsx
│   │   ├── App.jsx              # Root component
│   │   ├── main.jsx             # React entry point
│   │   └── styles.css           # Global styles
│   ├── services/                # Business logic
│   │   ├── campaignManager.js   # Campaign orchestration
│   │   ├── chatgptScraper.js    # Puppeteer automation
│   │   ├── githubService.js     # GitHub API client
│   │   ├── googleSheets.js      # Sheets integration
│   │   └── storage.js           # Local data persistence
│   ├── utils/                   # Helper functions
│   │   └── parser.js
│   └── config/
│       └── example.env          # Environment template
├── main.js                      # Electron entry wrapper
├── preload.js                   # Preload script (context bridge)
├── package.json
├── tailwind.config.js
├── vite.renderer.config.ts
└── electron-builder.yml
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org/))
- **GitHub Personal Access Token** ([Create one](https://github.com/settings/tokens))
- **ChatGPT Plus Account** (for web automation)
- **Google Sheet** (see [GOOGLE_SHEETS_TEMPLATE.md](GOOGLE_SHEETS_TEMPLATE.md))

### Installation

```bash
# Clone or navigate to the project
cd ai-automation-dashboard

# Install dependencies
npm install
# or
pnpm install
```

### Development

```bash
# Terminal 1: Start Vite dev server
npm run dev:renderer

# Terminal 2: Launch Electron app
npm run dev
```

The app will open with hot-reload enabled at `http://localhost:5173`.

### Building

```bash
# Build for production
npm run build

# Output will be in dist/ folder
# - macOS: .dmg
# - Windows: .exe installer
# - Linux: .AppImage and .deb
```

---

## 📚 Documentation

- **[SETUP_GUIDE.md](SETUP_GUIDE.md)** - Detailed setup instructions
- **[GOOGLE_SHEETS_TEMPLATE.md](GOOGLE_SHEETS_TEMPLATE.md)** - Sheet structure and API setup
- **[src/config/example.env](src/config/example.env)** - Environment variables

---

## 🎯 How It Works

### Workflow

```mermaid
graph LR
    A[Google Sheets] -->|Read Keywords| B[Campaign Manager]
    B -->|Send Prompt| C[ChatGPT via Puppeteer]
    C -->|Return JSON| B
    B -->|Create Repo| D[GitHub API]
    D -->|Repo URL| B
    B -->|Update Status| A
```

### Step-by-Step Process

1. **Read Data**: Fetch pending keywords from Google Sheets
2. **Generate Metadata**: Send keyword to ChatGPT with structured prompt
3. **Parse Response**: Extract JSON with repo name, description, README, tags, issues
4. **Create Repository**: Use GitHub API to create repo
5. **Add Content**: Upload README, set topics, create initial issues
6. **Update Sheet**: Mark row as "Done" with repo URL or "Failed" with error

---

## 🔧 Configuration

### Environment Variables

Create `.env` file (optional):

```env
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
CHATGPT_SESSION_TOKEN=__Secure-next-auth.session-token-value
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
```

Or configure per-campaign in the UI.

### Google Sheets Setup

See [GOOGLE_SHEETS_TEMPLATE.md](GOOGLE_SHEETS_TEMPLATE.md) for:
- Required column structure
- API authentication setup
- Example data format

### ChatGPT Session Cookie

1. Log in to [ChatGPT](https://chatgpt.com)
2. Open DevTools (F12) → Application → Cookies
3. Copy `__Secure-next-auth.session-token` value
4. Paste in campaign creation modal

---

## 🎨 UI Screenshots

### Dashboard
Modern, clean interface with campaign management:

```
┌─────────────────────────────────────────────────────┐
│  🤖 AI Automation Dashboard                         │
├──────────┬──────────────────────────────────────────┤
│          │  GitHub Repository Automation            │
│ 📊 Dash  │  ┌─────────────────────────────────────┐ │
│ 🐙 Repos │  │ + Create Campaign                   │ │
│ ⚙️  Set  │  └─────────────────────────────────────┘ │
│ 📄 Logs  │  ┌─────────────────────────────────────┐ │
│          │  │ Campaign List                       │ │
│          │  │ • My Campaign 1 [Running]           │ │
│          │  │ • Test Campaign [Completed]         │ │
│          │  └─────────────────────────────────────┘ │
└──────────┴──────────────────────────────────────────┘
```

---

## 🔒 Security Notes

⚠️ **Important Security Considerations:**

- **Never commit credentials** to version control
- **Session cookies expire** - refresh them periodically
- **Rate limits apply** - GitHub API has usage quotas
- **Use service accounts** for production Google Sheets access
- **Store secrets securely** - consider using system keychain

---

## 🐛 Troubleshooting

### Common Issues

**ChatGPT Session Expired**
```
Solution: Get a fresh session cookie from ChatGPT
```

**GitHub Rate Limit**
```
Solution: Wait for reset or use multiple accounts
```

**Puppeteer Launch Failed**
```bash
# Install Chrome dependencies (Linux)
sudo apt-get install -y chromium-browser
```

**Google Sheets Permission Denied**
```
Solution: Share sheet with service account email
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed troubleshooting.

---

## 🚧 Roadmap

- [ ] Export campaign reports to CSV/JSON
- [ ] Retry queue for failed repositories
- [ ] Desktop notifications for completion
- [ ] Multiple ChatGPT account support
- [ ] Scheduled campaigns (cron-like)
- [ ] Template library for common repo types
- [ ] Bulk operations (delete, archive)
- [ ] Analytics dashboard with charts

---

## 🤝 Contributing

Contributions are welcome! To add a new automation module:

1. Create service in `src/services/`
2. Add IPC handlers in `src/main/ipcHandlers.js`
3. Create UI components in `src/renderer/components/`
4. Add route in `src/renderer/main.jsx`
5. Update sidebar in `src/renderer/components/Sidebar.jsx`

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Electron** - Desktop app framework
- **React** - UI library
- **TailwindCSS** - Styling
- **Puppeteer** - Browser automation
- **Lucide** - Icon library
- **Framer Motion** - Animations

---

## 📧 Support

For issues, questions, or feature requests, please open an issue on GitHub.

---

<div align="center">

**Built with ❤️ for the automation community**

⭐ Star this repo if you find it helpful!

</div>
