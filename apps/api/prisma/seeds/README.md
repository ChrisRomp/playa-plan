# Database Seeds

This directory contains database seeding scripts for the Playa Plan application.

## Files

### `seed.ts`
The main seed file that creates the base application data:
- Job categories
- Camping options
- Shifts  
- Jobs
- Core configuration (with default/placeholder values)

This file is committed to git and should NOT contain secrets or API keys.

**Usage:**
```bash
npm run seed:dev          # Normal seed
npm run seed:dev:force    # Force reseed (clears existing data)
npm run seed:test         # Seed test database
npm run seed:test:force   # Force reseed test database
```

### `seed.local.ts` (Optional - Not in Git)
A template for local development configuration that can contain secrets and API keys.

**Setup:**
1. Copy `seed.local.template.ts` to `seed.local.ts`
2. Update the values with your actual local configuration  
3. The file will be ignored by git and can safely contain secrets

**Usage:**
```bash
npm run seed:local        # Run local configuration seed
```

**Common workflow:**
```bash
# First seed the base data
npm run seed:dev:force

# Then apply your local configuration
npm run seed:local
```

## What to Put in seed.local.ts

- **API Keys**: Stripe test keys, SendGrid API keys, PayPal credentials
- **SMTP Configuration**: Email server settings
- **Test Users**: Users with known passwords for testing
- **Development Configuration**: Any settings specific to your local environment
- **Webhook URLs**: Local webhook endpoints for testing

## Security Note

Never commit actual API keys or secrets to the main seed file. Always use the local seed file for sensitive configuration. 