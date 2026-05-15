# Contributing to AI Automation Dashboard

Thank you for considering contributing to AI Automation Dashboard! This document outlines the process for contributing to the project.

---

## 🤝 How to Contribute

### Reporting Bugs

1. Check if the bug has already been reported in [Issues](https://github.com/your-repo/issues)
2. If not, create a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Screenshots (if applicable)
   - Your environment (OS, Node version, etc.)

### Suggesting Enhancements

1. Check existing issues for similar suggestions
2. Create a new issue with the tag `enhancement`
3. Describe the feature and its benefits
4. Provide examples or mockups if possible

### Pull Requests

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Ensure code follows the style guidelines
5. Test thoroughly
6. Commit with clear messages: `git commit -m "Add amazing feature"`
7. Push to your fork: `git push origin feature/amazing-feature`
8. Open a Pull Request

---

## 🏗️ Development Setup

### Prerequisites
- Node.js 18+
- npm/pnpm/yarn

### Setup
```bash
git clone https://github.com/your-repo/ai-automation-dashboard.git
cd ai-automation-dashboard
npm install
npm run dev:renderer  # Terminal 1
npm run dev           # Terminal 2
```

---

## 📐 Code Style Guidelines

### JavaScript/JSX
- Use ES6+ features
- Prefer const/let over var
- Use arrow functions for callbacks
- Follow React best practices
- Use meaningful variable names

### React Components
- Functional components with hooks
- PropTypes or TypeScript for type checking
- Keep components small and focused
- Extract reusable logic into custom hooks

### CSS/Tailwind
- Use Tailwind utility classes
- Follow the existing color scheme
- Maintain responsive design
- Keep dark mode in mind

### File Organization
```
src/
├── main/          # Electron main process
├── renderer/      # React UI
│   ├── components/  # Reusable components
│   ├── pages/       # Route pages
│   └── ...
├── services/      # Business logic
└── utils/         # Helper functions
```

---

## 🧪 Testing

### Before Submitting
- [ ] Code runs without errors
- [ ] No console warnings
- [ ] Responsive design works
- [ ] Dark mode looks good
- [ ] Tested on target platforms (if possible)

### Manual Testing
```bash
npm run dev  # Test in dev mode
npm run build  # Test production build
```

---

## 🎯 Adding New Automation Modules

To add a new automation module (e.g., "Jira Ticket Creator"):

### 1. Create Service Layer
```javascript
// src/services/jiraService.js
export async function createJiraTicket({ ticket }) {
  // Implementation
}
```

### 2. Update Campaign Manager
```javascript
// src/services/campaignManager.js
// Add new campaign type handling
```

### 3. Add IPC Handlers
```javascript
// src/main/ipcHandlers.js
ipcMain.handle('jira:create-ticket', async (_e, payload) => {
  return await createJiraTicket(payload);
});
```

### 4. Create UI Components
```jsx
// src/renderer/pages/JiraModule.jsx
export default function JiraModule() {
  // Component implementation
}
```

### 5. Update Routes
```jsx
// src/renderer/main.jsx
<Route path="/jira-module" element={<JiraModule />} />
```

### 6. Add to Sidebar
```jsx
// src/renderer/components/Sidebar.jsx
<NavLink to="/jira-module" className={navItemClass}>
  <TicketIcon className="w-4 h-4" /> Jira Tickets
</NavLink>
```

---

## 📝 Commit Message Guidelines

Use conventional commits format:

```
type(scope): subject

body

footer
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

### Examples
```
feat(github): add support for private repositories
fix(ui): resolve modal close button not working
docs(readme): update setup instructions
```

---

## 🔍 Code Review Process

1. Maintainers will review your PR
2. Address any requested changes
3. Once approved, PR will be merged
4. Your contribution will be credited

---

## 🎨 UI/UX Guidelines

### Design Principles
- **Minimalism**: Clean, uncluttered interface
- **Consistency**: Follow existing patterns
- **Feedback**: Provide visual feedback for actions
- **Accessibility**: Consider keyboard navigation and screen readers

### Color Palette
- Background: `neutral-950`
- Text: `neutral-100`
- Borders: `white/10`
- Accents: Use `emerald`, `sky`, `rose` for status
- Interactive: `white` for primary buttons

### Spacing
- Use Tailwind spacing scale (4, 8, 16, 24, 32px)
- Maintain consistent padding and margins
- Ensure adequate whitespace

---

## 🐛 Debugging Tips

### Electron DevTools
```javascript
// In main.js, add:
mainWindow.webContents.openDevTools();
```

### IPC Debugging
```javascript
// In ipcHandlers.js
ipcMain.handle('test', async (_e, payload) => {
  console.log('IPC called with:', payload);
  return { success: true };
});
```

### Puppeteer Debugging
```javascript
const browser = await puppeteer.launch({
  headless: false,  // See browser
  slowMo: 100,      // Slow down actions
  devtools: true    // Open DevTools
});
```

---

## 📦 Release Process

1. Update version in `package.json`
2. Update `CHANGELOG.md`
3. Create git tag: `git tag v1.0.0`
4. Push tag: `git push origin v1.0.0`
5. Build release: `npm run build`
6. Create GitHub release with assets

---

## 📚 Additional Resources

- [Electron Documentation](https://www.electronjs.org/docs)
- [React Documentation](https://react.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
- [GitHub API Documentation](https://docs.github.com/en/rest)

---

## 🙏 Thank You

Every contribution, no matter how small, is valued and appreciated. Thank you for helping make AI Automation Dashboard better!

---

## 📧 Questions?

Feel free to open an issue with the `question` label or reach out to the maintainers.

---

<div align="center">

**Happy Contributing! 🎉**

</div>
