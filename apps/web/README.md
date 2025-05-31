# PlayaPlan Frontend

## Default Images and Icons

According to the frontend specification, the application uses the following default images when not specified in the camp configuration:

- **Default Banner Image**: `/public/images/playa-plan-banner.png`
  - Used when no banner URL is specified in camp configuration
  - Should be a high-quality image that works well as a hero banner

- **Default Camp Icon**: `/public/icons/playa-plan-icon.png`
  - Used when no icon URL is specified in camp configuration
  - Should be a square image that works well as a small icon

## Accessibility

Both images have fallback alt text, but for best accessibility practices, administrators should provide descriptive alt text when configuring custom images.

## Local Development

To start the development server:

```bash
npm run dev
```

This will start the Vite development server with hot module replacement.

## Building for Production

To build the application for production:

```bash
npm run build
```

The built files will be in the `dist` directory.

# Web Application

## Dynamic Document Metadata

The application automatically updates the page title and meta description based on the camp configuration from the API.

### Implementation

- **Hook**: `useDocumentMetadata()` in `src/hooks/useDocumentMetadata.ts`
- **Usage**: Called in the main `App.tsx` component
- **Fallback**: Default title "PlayaPlan" and description if API fails

### Features

- **Dynamic Title**: Updates to `{campName} - Camp Registration`
- **Sanitized Meta Description**: Strips HTML tags and limits to 160 characters for SEO
- **Error Handling**: Gracefully handles API failures without breaking the app
- **Performance**: Only runs once on app initialization

### Example

```typescript
// When camp config has campName: "Burning Man 2024"
document.title = "Burning Man 2024 - Camp Registration"

// When camp config has campDescription with HTML
// "<p>Amazing <strong>desert</strong> experience</p>"
// Becomes: "Amazing desert experience"
``` 