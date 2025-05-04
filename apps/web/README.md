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