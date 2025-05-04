# Web Frontend Specification

## Technology Choices (Simple Stack)

Keeping simplicity in mind, we'll use:

- **Core Framework:** React with TypeScript
- **Build Tool:** Vite
- **Styling:** Tailwind CSS (rapid UI development)
- **Component Library:** Headless UI by Tailwind Labs (simple, accessible, works seamlessly with Tailwind)
- **Form Handling:** React Hook Form (simple but powerful)
- **Data Fetching:** Native fetch API initially (with clear upgrade path to TanStack Query when complexity grows)
- **Validation:** Zod (for type safety and shared validation with backend)
- **Testing:** 
  - Unit Tests: Vitest (integrates seamlessly with Vite)
  - E2E Tests: Playwright (cross-browser, modern API, accessibility checks recommended)

## Work tracking

Track work progress in [frontend-tasks.md](frontend-tasks.md).

## Visual Elements

### Header

The header of the website should contain:

- Hero Banner Image
    - If no URL is specified, use public/images/playa-plan-banner.png
- Overlay of Camp name
- Subtext of Camp description
- A collabsible "hamburger" menu if the menu is collapsed

Camp name, camp description, and camp banner URL come from the Core Configuration data API.

If the camp icon URL is not specified in configuration, use public/icons/playa-plan-icon.png.

### Menu

The menu should contain options for:

- Sign in / New user (Only if not signed in, and this would be the only menu item)
- Profile
- Camp Registration
- Work Schedule
- Reports
    - Registrations (Staff only)
    - Users (Staff only)
    - Payments (Admin only)
- Administration (Admin only)
    - Configuration
    - Jobs
    - Job Categories
    - Shifts
- Sign out

### Body

In the main body of the website should contain the camp home page blurb in the main area from the API, rendered as HTML.

#### Anonymous user

Display an action button that will invite the user to log in or register as a new user.

#### Logged in user

If registration is not yet open:

If early registration is open and the user is enabled for early registration, treat things as though registration is open.

Otherwise, display a message that registration is not currently open.

If registration is open:

If has no registration for the current year, display an action button inviting them to register.

If the user has already registered for the configured year, display a summary of their registration info, and any work shifts they signed up for.

### Footer

In the footer, display the camp name again. The in a subtle way, show "Powered by PlayaPlan" with a hyperlink to https://github.com/ChrisRomp/playa-plan.

