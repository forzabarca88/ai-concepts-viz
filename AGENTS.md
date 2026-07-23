# AGENTS.md

## Core Principles

- Keep AGENTS.md minimal - **only** keep information which will be required every time you look at this project. Do not modify `Core Principles`, but review and remove anything else from the document which is not required.
- Your code **must** meet production deployment standards.
- Write the bare minimum of tests - follow **ARRANGE, ACT, ASSERT**. You must test the end result, NOT the implmentation details.
- If you start the application (e.g. for testing), you must validate that the application is stopped before marking the task complete.
- Use mocks for testing sparingly - if the code requires excessive mocking, then redesign the implementation to be easier to test.
- You **must** validate the UI by checking screenshots and test front-end using a framework such as `Playwright`.
