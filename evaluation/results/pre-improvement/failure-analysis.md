# Failure Analysis

Generated at 2026-04-24T22:54:34.982Z.

## Failure case: analyst keyword gap

- Hypothesis: Before the keyword extraction improvement, analyst-specific signals are under-detected, so the analysis may skew generic or under-score the fit.
- Score: 72 (Good match)
- Rubric total: 14/20 (acceptable)
- Failure flagged: yes
- Extracted keywords: SQL, Communication, Python
- Summary: The candidate shows strong alignment with visualization and business reporting requirements across the sample set, particularly for roles emphasizing Power BI, Tableau, and Excel. However, a significant gap exists in SQL proficiency, which is a core requirement in the majority of these listings.
- Missing signals: Explicit mention of SQL proficiency (required by COSMO and Central Business Solutions); Deep Python experience (specifically requested by Central Business Solutions); Data cleaning and governance methodologies; Source-of-truth dataset curation
- Resume suggestions: Clarify SQL skills immediately, as it is a baseline requirement for roles like da-1 and da-4.; Detail specific outcomes from previous dashboards, such as time saved or decisions influenced, to match the 'strategic decision-making' needs of TheAILabb.; If 'light Python' includes libraries like Pandas or Matplotlib, list them specifically to improve the match for da-4.; Mention specific data cleaning techniques to align with the 'clean data' requirement in the Junior Data Analyst role.

## Failure case: backend sample bias

- Hypothesis: The software bundle contains some frontend-heavy postings, so the analysis may over-penalize the missing UI stack instead of recognizing strong backend alignment.
- Score: 70 (Good match)
- Rubric total: 17/20 (strong)
- Failure flagged: yes
- Extracted keywords: React, TypeScript, Git, API, Testing, JavaScript, Node.js, SQL, AWS, Docker, Agile, Python, Communication
- Summary: The candidate demonstrates strong alignment with backend and cloud-infrastructure requirements, particularly for platform-oriented roles. However, there is a significant skill gap regarding frontend technologies like React and TypeScript, which are common in several of the sampled full-stack and software development roles.
- Missing signals: React expertise; TypeScript/JavaScript proficiency; Python skills; Specific unit testing frameworks (e.g., JUnit, Mockito); Git (implied but not explicit)
- Resume suggestions: Explicitly mention Git and version control practices; List specific testing frameworks used for backend services to satisfy 'testing' requirements; Detail specific accomplishments in production support with metrics if possible; Consider adding any cross-functional collaboration experience to align with 'Agile' and 'Communication' keywords

