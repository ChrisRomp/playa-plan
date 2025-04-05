# PlayaPlan planned project folder structure

## Top-level planned project structure

```text
playaplan/
├── apps/
│   ├── api/                    # NestJS backend (PlayaPlan API)
│   │   ├── src/
│   │   ├── prisma/
│   │   ├── test/
│   │   └── ...
│   └── web/                    # React frontend (PlayaPlan UI)
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
│   ├── users/                  # Example feature module
│   │   ├── users.module.ts
│   │   ├── controllers/
│   │   │   ├── user.controller.ts
│   │   │   └── user.controller.spec.ts  # Unit tests for controller
│   │   ├── services/
│   │   │   ├── user.service.ts
│   │   │   └── user.service.spec.ts     # Unit tests for service
│   │   ├── dto/
│   │   │   └── create-user.dto.ts
│   │   └── entities/
│   │       └── user.entity.ts
│   ├── auth/
│   ├── camps/
│   ├── jobs/
│   ├── shifts/
│   ├── registrations/
│   ├── payments/
│   ├── notifications/
│   └── common/                 # Global guards, interceptors, decorators
│       ├── guards/
│       │   ├── auth.guard.ts
│       │   └── auth.guard.spec.ts       # Unit tests for guards
│       ├── filters/
│       │   ├── http-exception.filter.ts
│       │   └── http-exception.filter.spec.ts
│       ├── interceptors/
│       │   ├── logging.interceptor.ts
│       │   └── logging.interceptor.spec.ts
│       ├── middleware/
│       ├── pipes/
│       │   ├── validation.pipe.ts
│       │   └── validation.pipe.spec.ts
│       ├── testing/                     # Testing utilities
│       │   ├── test-utils.ts
│       │   ├── mocks/                   # Mock factories
│       │   │   ├── prisma.mock.ts
│       │   │   └── user.mock.ts
│       │   └── fixtures/                # Test data fixtures
│       │       └── user.fixture.ts
│       └── prisma/                      # Prisma service
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── test/                       # e2e or integration tests
│   ├── jest-e2e.json
│   ├── app.e2e-spec.ts         # Application-wide e2e tests
│   ├── users/                  # Feature-specific e2e tests
│   │   └── users.e2e-spec.ts
│   └── auth/
│       └── auth.e2e-spec.ts
└── package.json
```

## Test-Driven Development Structure

For TDD approach across the application, follow these patterns:

### Unit Testing Structure

```text
feature-module/
├── controllers/
│   ├── controller.ts
│   └── controller.spec.ts      # Controller tests (mock the service)
├── services/
│   ├── service.ts
│   └── service.spec.ts         # Service tests (mock external dependencies)
├── guards/
│   ├── guard.ts
│   └── guard.spec.ts           # Guard tests
├── pipes/
│   ├── pipe.ts
│   └── pipe.spec.ts            # Pipe tests
└── filters/
    ├── filter.ts
    └── filter.spec.ts          # Filter tests
```

### Integration Testing Structure

```text
test/
├── jest-e2e.json               # Configuration for e2e tests
├── setup.ts                    # Test setup/teardown hooks
└── feature-module/
    ├── feature-create.e2e-spec.ts  # Test specific feature operations
    ├── feature-update.e2e-spec.ts
    └── feature-delete.e2e-spec.ts
```

### Test Utilities and Helpers

```text
common/testing/
├── test-utils.ts               # Shared testing utilities
├── mocks/                      # Mock factories
│   ├── service.mock.ts
│   ├── repository.mock.ts
│   └── external-api.mock.ts
└── fixtures/                   # Test data
    ├── user.fixture.ts
    ├── camp.fixture.ts
    └── job.fixture.ts
```

## Web frontend detail `/apps/web`

```text
web/
├── src/
│   ├── components/
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx          # Component unit tests
│   │   │   └── Button.stories.tsx       # Component stories (if using Storybook)
│   │   └── Form/
│   │       ├── Form.tsx
│   │       └── Form.test.tsx
│   ├── pages/
│   │   ├── Home/
│   │   │   ├── Home.tsx
│   │   │   └── Home.test.tsx            # Page component tests
│   │   └── Profile/
│   │       ├── Profile.tsx
│   │       └── Profile.test.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useAuth.test.ts              # Custom hook tests
│   ├── auth/
│   ├── api/                             # API utilities or React Query configs
│   │   ├── users.api.ts
│   │   └── users.api.test.ts            # API call tests
│   ├── types/                           # Local or imported shared types
│   └── styles/
│   └── __tests__/
│       └── integration/                 # Integration tests with component interactions
│           └── auth-flow.test.tsx
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
│   ├── signup.schema.ts        # Zod or class-validator shared schemas
│   └── signup.schema.spec.ts   # Tests for validation schemas
├── utils/
│   ├── dateHelpers.ts          # Time/formatting helpers shared across apps
│   └── dateHelpers.spec.ts     # Tests for utility functions
└── testing/                    # Shared testing utilities
    ├── test-setup.ts           # Common test setup for libs
    └── mocks/                  # Shared mocks
        └── api-response.mock.ts
```
