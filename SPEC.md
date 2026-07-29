# SPEC.md

## Goal

An interactive static website which visualises core concepts of Large Language Models in a manner that is easy to understand for a non-technical audience.

The UX and UI design must be modern and beautiful, evoking the simplicty and elegance of UX benchmarks such as `Apple`.


## Technical Constraints

- Must be a static website able to be deployed on services such as `Github Pages`, `Vercel`, etc.

## Minimum Viable Product

- User can select different UI elements to navigate to different sections or pages within the website - each section should interactively visualise different concepts related to LLMs such as:
    - Core concepts such as:
        - Data necessary to train an LLM
        - Tokenisation
        - Model Parameters and update process
    - Training stages of a LLM:
        - Pre-training
        - Supervised fine-tuning
        - Preference fine-tuning
    - Foundations for Agentic use:
        - Tool calling
        - Skills
        - MCP servers
        - Demo of an AI agent
- Visualisations must be eye catching but ultimately must help teach the user
- Every element in the UI which the user can interact with must have associated unit tests, and every transition state in the UI must be validated with screenshots
- **The Golden Rule: Make learning about LLMs fun, not intimidating!**

## References

Use these additional links for domain specific information.

- `LLM Training Course:` https://github.com/mlabonne/llm-course
