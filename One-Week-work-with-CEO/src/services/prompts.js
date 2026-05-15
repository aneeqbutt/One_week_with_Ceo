/**
 * Prompt templates for different code generation scenarios
 */

/**
 * BitBash README Generation Prompt
 */
export function buildBitBashReadmePrompt(scrapedData) {
  return `You are a GitHub Repository Documentation Generator.

I have scraped data from an Apify actor page. Your job is to transform this data into a GitHub-ready repository structure.

**Scraped Data:**
- **Title:** ${scrapedData.title}
- **Description:** ${scrapedData.description || 'Not available'}
- **Categories:** ${scrapedData.categories.join(', ') || 'Not available'}

**README Content (HTML):**
${scrapedData.readmeContent || 'Not available'}

**Features (HTML):**
${scrapedData.featuresContent || 'Not available'}

**Use Cases (HTML):**
${scrapedData.useCasesContent || 'Not available'}

**Pricing Info (HTML):**
${scrapedData.pricingContent || 'Not available'}

**Stats:**
${JSON.stringify(scrapedData.stats, null, 2)}

---

You are a GitHub Repository Documentation Generator.
You will be given one Apify Actor Web page scraped Data.
Your job is to transform that data into a GitHub-ready repository, consisting strictly of two main parts only:
Repo Info Block (metadata)
README.md (strict Markdown format)
Your output must be clean, GitHub-formatted Markdown, ready for direct publishing — no extra commentary, no meta text, and absolutely no more than two fenced code blocks total.no extra text even for json response or directory structure.
:jigsaw: OUTPUT REQUIREMENTS
Repo Info Block (first fenced block in pgsql):
Repo Name: <create SEO-friendly repo name: ALWAYS use format {full-tool-name}-scraper (e.g., "upcheck-monitor-scraper" not just "upcheck"). Use hyphens to separate words. Include the complete tool name from the title.>
Description: <main keyword + 2–3 descriptive words (under 6 words)>
Related Topics: <8–10 comma-separated topics including the keyword and 2–3 technical terms never add apify  >
README.md (second fenced block in markdown):
Everything related to the README must stay inside the same second fenced block — this includes introduction, features, data fields, example output, directory structure, use cases, FAQs, and performance sections.
:blue_book: README.md STRUCTURE
# <Project Title>
> Write 2–3 engaging sentences that describe what the project does, the core problem it solves, and the value it delivers.
> Keep it SEO-friendly, natural, and clear — include the main keyword once or twice.
## Introduction
Explain:
- What this project does
- What problem it solves
- Who it’s for
### <Contextual Subheading>
- Choose a relevant subheading (based on project purpose).
- List 3–5 concise, fact-driven bullet points explaining its key aspects or capabilities.
---
## Features
| Feature | Description |
|----------|-------------|
| Feature 1 | Explain the benefit and function clearly. |
| Feature 2 | Continue listing as many as are relevant. |
---
## What Data This Scraper Extracts
| Field Name | Field Description |
|-------------|------------------|
| field_name | Explain what data this field holds. |
| ... | ... |
---
## Example Output
<If available, include example data block. Skip this section if not present.>
<do not use \`\`\` , >
<write this output with tab space behind>
Example:
    [
          {
            "facebookUrl": "https://www.facebook.com/nytimes/",
            "pageId": "5281959998",
            "postId": "10153102374144999",
            "pageName": "The New York Times",
            "url": "https://www.facebook.com/nytimes/posts/pfbid02meAxCj1jLx1jJFwJ9GTXFp448jEPRK58tcPcH2HWuDoogD314NvbFMhiaint4Xvkl",
            "time": "Thursday, 6 April 2023 at 06:55",
            "timestamp": 1680789311000,
            "likes": 22,
            "comments": 2,
            "shares": null,
            "text": "Four days before the wedding they emailed family members a “save the date” invite. It was void of time, location and dress code — the couple were still deciding those details.",
            "link": "https://nyti.ms/3KAutlU"
          }
        ]
---
## Directory Structure Tree
<Assume it’s a complete working project. Show a detailed and realistic folder and file structure with correct extensions.
All directory structure code must remain inside this same fenced block.>
Example:
    facebook-posts-scraper/
    ├── src/
    │   ├── runner.py
    │   ├── extractors/
    │   │   ├── facebook_parser.py
    │   │   └── utils_time.py
    │   ├── outputs/
    │   │   └── exporters.py
    │   └── config/
    │       └── settings.example.json
    ├── data/
    │   ├── inputs.sample.txt
    │   └── sample.json
    ├── docs/
    │   └── README.md
    ├── requirements.txt
    ├── LICENSE
    └── README.md
---
## Use Cases
List 3–5 real-world use cases showing how users benefit:
- **[Who]** uses it to **[do what]**, so they can **[achieve what benefit].**
- Each bullet must be practical and outcome-oriented.
---
## FAQs
Write 2–4 relevant questions a user might ask.
Each should include a detailed, informative answer that adds clarity about setup, limitations, or supported operations.
---
## Performance Benchmarks and Results
Provide realistic, project-specific performance insights using measurable language:
- **Primary Metric:** e.g., average scraping speed or accuracy rate.
- **Reliability Metric:** e.g., success rate or stability.
- **Efficiency Metric:** e.g., throughput or resource usage.
- **Quality Metric:** e.g., data completeness or precision.
Each statement should sound grounded in real-world usage, not placeholders.
:compass: GENERAL RULES
Formatting
Output only two fenced code blocks total.
Do not break README sections into separate fences — everything stays inside one.
Do not include generator comments, meta text, or explanations.
Keep Markdown hierarchy clean and consistent.
use triple \`\`\` inside the readme code fence no problem.
Tone
Marketing-friendly yet professional.
Write as if introducing a quality open-source tool to developers.
Use natural, clear English — no robotic or filler language.
Content
Include every required section listed above.
Infer missing data logically and realistically.
Never reference Apify, scraping origins, or internal system details.
Quality
README should look like a fully polished GitHub project.
Keep the text detailed but concise, visually balanced, and human-like.
Naturally include the main keyword in key sections for SEO.
:no_entry_sign: ABSOLUTE RESTRICTIONS
Never open more than two fenced code blocks.
Never use triple backticks inside the second fenced block.
Never output explanation lines, summaries, or extra commentary.
Never label the blocks — only open and close them cleanly.`;
// NOTE: Inside the template literal above any triple backticks were escaped in-source to avoid
// prematurely closing the surrounding template. If you edit this template, ensure any
// backtick characters are escaped as \` (three backticks -> \`\`\`).
}

/**
 * BitBash Code Generation Prompt
 */
export function buildBitBashCodePrompt(readme) {
  // Escape backticks in the prompt to avoid template literal issues
  const promptText = `You are a **senior full-stack software engineer**.
Your task is to generate **complete, runnable code** for **every file listed in the directory structure** extracted from the target repository's **README**.

---

## INPUT

* The repository's README contains a **Directory Structure** section (a fenced code block or tree listing).

---

## WHAT YOU MUST DO

### 1) Discover the Directory Structure
* Open the provided repository URL.
* Locate the **README** (root README.md unless otherwise stated).
* **Parse the "Directory Structure" section** from the README:
  * If multiple trees exist, use the **primary** one (the most complete / top-level project tree).
  * Treat the tree as the **source of truth** for file names and folder paths.
* If the README's structure block includes comments like (file), (dir), or placeholders, **resolve them into concrete files**.
* Ignore binary assets (images, fonts, etc.). If the tree lists them, create a **.keep** or **README.txt** placeholder to keep folder integrity.

### 2) Generate Real, Runnable Source Code
For **every file** in the parsed directory tree:
* Produce **complete, production-grade code** (no stubs, no TODOs).
* Use the **language implied by the file extension** (.js, .ts, .tsx, .jsx, .py, .go, .rb, .java, .cs, .php, .rs, .sh, .yml, etc.).
* Ensure the entire project is **runnable end-to-end** with standard commands (e.g., npm start, npm run dev, node src/index.js, python main.py, etc.).
* **Wire all imports/exports** so the app runs **without modification**.
* Create and fill **manifest files** where appropriate:
  * JavaScript/TypeScript: package.json with scripts and dependencies/devDependencies.
  * Python: requirements.txt (and pyproject.toml if needed), plus an entry point (e.g., main.py).
  * Other ecosystems: provide the standard manifest/build files (e.g., go.mod, Cargo.toml, composer.json, pom.xml, build.gradle, Gemfile, etc.).
* If a **tests** directory (or any *.test.* / *_test.*) is present in the tree, include **at least one unit test** for critical functionality and a way to run tests (e.g., npm test, pytest, etc.).
* Add minimal but effective **error handling and logging**.
* Provide **sensible defaults** and lightweight **config stubs** (e.g., .env.example, config.sample.json) if the structure suggests configuration.
* **Do not** generate any README.md (explicitly forbidden).

### 3) Quality & Consistency Rules
* All code must be **syntactically valid** and **executable**.
* Keep architecture **modular** with clear single responsibility per file.
* Handle **async**/await or concurrency correctly.
* Keep comments **concise and useful** only where necessary.
* Ensure **imports resolve** across the entire project.
* Use **realistic implementations** (no "placeholder function" behavior).

---

## OUTPUT FORMAT (STRICT)

Output **only** a sequence of file blocks in this exact pattern for **every file** in the parsed directory tree:

### path/to/filename.ext
${'```'}<language>
<complete code here>
${'```'}

### path/to/nextfile.ext
${'```'}<language>
<complete code here>
${'```'}

Rules:
- path/to/ must reflect repo-name/ (top-level folder using the repository name) followed by directories and the exact file name from the tree.
- Use the **correct language tag** after the opening backticks (e.g., js, ts, tsx, jsx, json, py, go, rb, php, java, cs, rs, sh, yaml, etc.).
- **No extra text** anywhere outside these blocks. **No notes, no commentary, no explanations.**
- Do **not** output any README.md.

---

## FAILURE HANDLING
- If the README's directory structure block is **missing or ambiguous**, infer it from the repository's top-level layout (common folders like src/, app/, lib/, tests/, etc.) and proceed. Still **do not** include README.md.
- If a listed file is **binary or non-code**, place a minimal placeholder (e.g., .keep) with a single-line comment explaining its purpose (inside a code fence labeled text).

---

## FINAL TASK
After I give you the repository link, **fetch the directory structure from its README**, then **generate complete, runnable source code for every file**, following the **exact output format** above and **without any commentary**.

---

## PROJECT README

${readme}

`;
  
  console.log('✅ Prompt built successfully');
  console.log('📏 Prompt length:', promptText.length, 'characters');
  
  return promptText;
}

/**
 * Appilot README Generation Prompt
 */
export function buildAppilotReadmePrompt(scrapedData) {
  return `You are an AI specialized in creating production-ready GitHub repositories. Analyze this data and create a professional repository.

**Input Data:**
- Title: ${scrapedData.title || 'N/A'}
- Description: ${scrapedData.description || 'N/A'}
- Content: ${scrapedData.content ? scrapedData.content.substring(0, 3000) : 'N/A'}
- Source: ${scrapedData.url || 'N/A'}

**Create a repository with:**

1. **Repository Name**: Modern, descriptive, SEO-friendly (lowercase-with-hyphens)
2. **Description**: Compelling one-liner (max 100 chars)
3. **Topics**: 8-12 trending, relevant tags
4. **README.md**: Comprehensive documentation including:
   - Hero section with badges and logo
   - Features with emojis
   - Quick start guide
   - Detailed usage examples
   - Architecture overview
   - Project structure (tree format)
   - API documentation (if applicable)
   - Screenshots/demos section
   - Contributing guide
   - License and credits

**Style Guidelines:**
- Use modern markdown with emojis
- Include badges for build status, version, license
- Add visual hierarchy with proper headings
- Include code examples with syntax highlighting
- Make it scannable and engaging

**MUST INCLUDE:**
- Detailed directory structure in tree format
- At least 1000 words of content
- Multiple code examples
- Clear installation steps

**JSON OUTPUT:**
\`\`\`json
{
  "repo_name": "awesome-project-name",
  "description": "One-line description here",
  "topics": ["modern", "production", "ready"],
  "readme": "# 🚀 Project Title\\n\\n[Complete README]"
}
\`\`\`

Create the repository:`;
}

/**
 * Appilot Code Generation Prompt
 */
export function buildAppilotCodePrompt(readme) {
  return `You are an expert full-stack developer. Generate a complete, production-ready codebase based on this README.

**README:**
${readme}

**Your Task:**
1. Parse the directory structure from the README
2. Generate ALL files with complete, production-quality code
3. Include:
   - All source files with full implementation
   - Configuration files (package.json, tsconfig.json, .env.example, etc.)
   - Test files with actual test cases
   - Documentation files (CONTRIBUTING.md, etc.)
   - CI/CD configs (.github/workflows/)
   - Docker files if applicable

**Code Quality Requirements:**
- Follow industry best practices
- Add comprehensive comments
- Include error handling
- Use modern syntax and patterns
- Make it maintainable and scalable

**Output Format:**
Use this format for each file:

### path/to/file.ext
\`\`\`language
[complete file contents]
\`\`\`

**Example:**

### src/server.js
\`\`\`javascript
import express from 'express';
import helmet from 'helmet';

const app = express();
app.use(helmet());

// Full implementation here
\`\`\`

### package.json
\`\`\`json
{
  "name": "project",
  "version": "1.0.0",
  "dependencies": {}
}
\`\`\`

**REQUIREMENTS:**
- Generate EVERY file from the structure
- Use full paths (src/components/Button.jsx)
- Complete implementation (no TODOs or placeholders)
- Add JSDoc/docstrings
- Include proper imports and exports

Begin code generation:`;
}

/**
 * Get README prompt based on campaign type
 */
export function getReadmePrompt(campaignType, data, promptType = 'bitbash') {
  // All campaigns use the same BitBash or Appilot prompts
  // The data format is adapted to work with these prompts
  return promptType === 'bitbash' 
    ? buildBitBashReadmePrompt(data)
    : buildAppilotReadmePrompt(data);
}

/**
 * Get code generation prompt based on prompt type
 */
export function getCodePrompt(readme, promptType = 'bitbash') {
  return promptType === 'bitbash'
    ? buildBitBashCodePrompt(readme)
    : buildAppilotCodePrompt(readme);
}
