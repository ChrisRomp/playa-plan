## Technology Choices (Simple Stack)

Keeping simplicity in mind, we'll use:

- **Core Framework:** React with TypeScript
- **Build Tool:** Vite (faster, simpler than CRA)
- **Styling:** Tailwind CSS (rapid UI development)
- **Component Library:** Headless UI by Tailwind Labs (simple, accessible, works seamlessly with Tailwind)
- **Form Handling:** React Hook Form (simple but powerful)
- **Data Fetching:** Native fetch API initially (with clear upgrade path to TanStack Query when complexity grows)
- **Validation:** Zod (for type safety and shared validation with backend)
- **Testing:** 
  - Unit Tests: Vitest (integrates seamlessly with Vite)
  - E2E Tests: Playwright (cross-browser, modern API, accessibility checks recommended)

## Development

- Use [Web-tasks.md](../../Web-tasks.md) to track work, checking off items as we progress.
- Unit test modules before completing the tasks
- Create git commits after each task; do not push
