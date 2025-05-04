# Web Frontend Specification

## Visual Elements

### Header

The header of the website should contain:

- Hero Banner Image
    - If no URL is specified, use src/assets/images/playa-plan-banner.png
- Overlay of Camp name
- Subtext of Camp description
- A collabsible "hamburger" menu if the menu is collapsed

Camp name, camp description, and camp banner URL come from the Core Configuration data API.

If the camp icon URL is not specified in configuration, use src/assets/images/playa-plan-icon.png.

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

