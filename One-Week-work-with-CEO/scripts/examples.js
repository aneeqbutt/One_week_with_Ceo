// examples.js - Example scenarios for testing

/*
 * EXAMPLE SCENARIOS FOR GOLOGIN GITHUB AUTOMATION
 * 
 * This file contains example inputs for testing different scenarios
 */

// ============================================
// SCENARIO 1: Star a Popular React Library
// ============================================
/*
Folder: Development Profiles
Mode: 1 (Keyword Search)
Keyword: react hooks library
Target URL: facebook/react

Expected: Script will search for "react hooks library" and navigate to
the official React repository to star it.
*/

// ============================================
// SCENARIO 2: Star Trending AI Repos
// ============================================
/*
Folder: AI Research Profiles
Mode: 1 (Keyword Search)
Keyword: langchain python
Target URL: langchain-ai/langchain

Expected: Finds and stars the LangChain repository
*/

// ============================================
// SCENARIO 3: Star from Blog Posts
// ============================================
/*
Folder: General Profiles
Mode: 2 (Blog Links)
Blog Links:
- https://dev.to/some-article-with-repos
- https://medium.com/@author/cool-github-projects
- https://blog.openai.com/gpt-4-tools

Expected: Each profile randomly picks one blog, extracts GitHub repo
links, and stars the first valid repo found.
*/

// ============================================
// SCENARIO 4: Star Next.js Related Repos
// ============================================
/*
Folder: Web Dev Profiles
Mode: 1 (Keyword Search)
Keyword: nextjs app router
Target URL: vercel/next.js

Expected: Stars the Next.js repository
*/

// ============================================
// SCENARIO 5: Star from Developer Blogs
// ============================================
/*
Folder: Active Accounts
Mode: 2 (Blog Links)
Blog Links:
- https://kentcdodds.com/blog/
- https://overreacted.io/
- https://www.joshwcomeau.com/

Expected: Extracts repos mentioned in popular developer blogs
*/

// ============================================
// TEST TIPS
// ============================================
/*
1. Start with a small folder (2-3 profiles) for testing
2. Verify GitHub login on at least one profile before running
3. Check logs after each run
4. Test Mode 1 first (easier to debug)
5. Use well-known repos for initial tests
6. Check "Already Starred" detection by running twice on same repo
7. Test error handling by using a profile without GitHub login

Common Test Repos:
- facebook/react
- microsoft/vscode
- torvalds/linux
- vercel/next.js
- openai/openai-python
*/

// ============================================
// DEBUGGING SCENARIOS
// ============================================
/*
TEST CASE 1: Not Logged In
- Use a profile without GitHub login
- Expected: Script should detect, log error, skip profile

TEST CASE 2: Invalid Blog URL
- Use a blog URL that doesn't exist or has no repos
- Expected: Script should log "no repos found" and skip

TEST CASE 3: Already Starred
- Run script twice on same repo
- Expected: Second run should detect "already starred"

TEST CASE 4: Invalid Search Keyword
- Use keyword that returns no results
- Expected: Script logs "repository not found"
*/

// ============================================
// REAL-WORLD USAGE EXAMPLES
// ============================================

const realWorldExamples = {
    example1: {
        description: "Star your company's open source library",
        folder: "Company Accounts",
        mode: 1,
        keyword: "your-company-name library",
        targetUrl: "your-company/your-repo"
    },

    example2: {
        description: "Star competitors' tools for research",
        folder: "Research Profiles",
        mode: 1,
        keyword: "competitor-tool-name",
        targetUrl: "competitor/tool-repo"
    },

    example3: {
        description: "Support open source projects from blogs",
        folder: "Community Accounts",
        mode: 2,
        blogLinks: [
            "https://github.blog/",
            "https://stackoverflow.blog/",
            "https://news.ycombinator.com/"
        ]
    },

    example4: {
        description: "Star educational repositories",
        folder: "Learning Accounts",
        mode: 1,
        keyword: "learn python tutorial",
        targetUrl: "jakevdp/PythonDataScienceHandbook"
    }
};

// Export examples if needed
module.exports = realWorldExamples;
