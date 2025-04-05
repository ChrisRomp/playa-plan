# PlayPlan planned project folder structure

## Top-level planned project structure

```text
playplan/
├── apps/
│   ├── api/                    # NestJS backend (PlayPlan API)
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── test/
│   │   └── ...
│   └── web/                    # React frontend (PlayPlan UI)
│       ├── src/
│       └── public/
├── libs/                       # Shared libraries between frontend and backend
│   ├── types/                  # Shared TypeScript types/interfaces (e.g., DTOs)
│   ├── constants/              # Shared constants (e.g., role enums)
│   ├── validation/             # Shared validation schemas
│   └── utils/                  # Shared utility functions
├── docker/                     # Docker and compose files (if using)
├── .github/                    # GitHub workflows (CI/CD)
├── package.json                # Root dependencies and scripts
├── tsconfig.base.json          # Shared TypeScript config
├── README.md
└── .env                        # Root environment variables (or use .env files per app)
```

## NestJS Backend Detail `/apps/api`

```text
api/
├── src/
│   ├── main.ts
│   ├── app.module.ts
│   ├── users/
│   ├── auth/
│   ├── camps/
│   ├── jobs/
│   ├── shifts/
│   ├── signups/
│   ├── payments/
│   ├── notifications/
│   └── common/                 # Global guards, interceptors, decorators
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/                       # e2e or integration tests
└── package.json
```

## Web frontend detail `/apps/web`

```text
web/
├── src/
│   ├── components/
│   ├── pages/
│   ├── hooks/
│   ├── auth/
│   ├── api/                    # API utilities or React Query configs
│   ├── types/                  # Local or imported shared types
│   └── styles/
├── public/
├── package.json
└── tailwind.config.js
```

## Shared libraries `/libs`

```text
libs/
├── types/
│   └── index.ts                # Shared interfaces (User, Job, etc.)
├── constants/
│   └── roles.ts                # e.g., export enum UserRole { ADMIN, STAFF, PARTICIPANT }
├── validation/
│   └── signup.schema.ts        # Zod or class-validator shared schemas
├── utils/
│   └── dateHelpers.ts          # Time/formatting helpers shared across apps
```
