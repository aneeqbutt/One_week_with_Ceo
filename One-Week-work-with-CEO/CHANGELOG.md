# Changelog

All notable changes to AI Automation Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Planned
- Export campaign reports to CSV/JSON
- Retry queue for failed repositories
- Desktop notifications for completion
- Multiple ChatGPT account support
- Scheduled campaigns (cron-like)
- Template library for common repo types
- Bulk operations (delete, archive)
- Analytics dashboard with charts

---

## [0.1.0] - 2025-10-14

### Added
- Initial release of AI Automation Dashboard
- Electron + React + TailwindCSS desktop application
- GitHub Repository Generator module
- Campaign management system with CRUD operations
- Real-time log viewer with auto-scroll
- Puppeteer-based ChatGPT web automation
- GitHub API integration (create repo, README, topics, issues)
- Google Sheets integration (placeholder for read/write)
- Modern glassmorphism UI with dark mode
- Sidebar navigation with routing
- IPC communication between main and renderer processes
- Local JSON-based data persistence
- Campaign status tracking (Idle, Running, Completed, Failed)
- Framer Motion animations
- Lucide React icons
- Cross-platform support (macOS, Windows, Linux)
- electron-builder configuration for packaging
- Comprehensive documentation:
  - README.md with full feature overview
  - SETUP_GUIDE.md with detailed setup instructions
  - GOOGLE_SHEETS_TEMPLATE.md for sheet structure
  - CONTRIBUTING.md for contributor guidelines
  - Example environment configuration

### Technical Features
- Vite for fast React development with HMR
- TailwindCSS for utility-first styling
- Modular service architecture
- Event-driven campaign management
- Error handling and logging
- Context isolation in Electron
- Secure preload script with context bridge

### UI Components
- Sidebar with navigation
- Dashboard overview page
- GitHub Repo Generator page
- Campaign creation modal
- Campaign list with status indicators
- Real-time log viewer
- Settings page with app info
- Logs page for campaign debugging

### Services
- `campaignManager.js` - Campaign orchestration and execution
- `chatgptScraper.js` - Puppeteer automation for ChatGPT
- `githubService.js` - GitHub API client
- `googleSheets.js` - Google Sheets integration (placeholder)
- `storage.js` - Local JSON persistence

### Configuration
- Electron builder for multi-platform packaging
- PostCSS + Autoprefixer
- Tailwind config with custom colors
- Vite config for renderer and preload
- Example environment variables

---

## Version History

### Version Format
- **MAJOR** version for incompatible API changes
- **MINOR** version for new functionality (backwards compatible)
- **PATCH** version for bug fixes (backwards compatible)

### Release Notes Structure
- **Added**: New features
- **Changed**: Changes to existing functionality
- **Deprecated**: Soon-to-be removed features
- **Removed**: Removed features
- **Fixed**: Bug fixes
- **Security**: Security improvements

---

## Upgrade Guide

### From Initial Setup to v0.1.0
This is the initial release. No upgrade needed.

### Future Upgrades
When upgrading to future versions:
1. Check the changelog for breaking changes
2. Backup your `state.json` file
3. Update dependencies: `npm install`
4. Rebuild the app: `npm run build`

---

## Support

For issues or questions about any release:
- Check the [README.md](README.md) for general information
- Review the [SETUP_GUIDE.md](SETUP_GUIDE.md) for setup help
- Open an issue on GitHub

---

[Unreleased]: https://github.com/your-repo/ai-automation-dashboard/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/your-repo/ai-automation-dashboard/releases/tag/v0.1.0
