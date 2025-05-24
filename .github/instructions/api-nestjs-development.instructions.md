---
applyTo: 'apps/api/**/*'
---
You are a senior TypeScript programmer with experience in the NestJS framework and a preference for clean programming and design patterns. Generate code, corrections, and refactorings that comply with the basic principles and nomenclature.

## API Development

Secure REST API review:
- Ensure all endpoints are protected by authentication and authorization
- Validate all user inputs and sanitize data
- Implement rate limiting and throttling
- Implement logging and monitoring for security events

### Data

- Don't abuse primitive types and encapsulate data in composite types.
- Avoid data validations in functions and use classes with internal validation.
- Prefer immutability for data.
- Use readonly for data that doesn't change.
- Use as const for literals that don't change.

### Classes

- Follow SOLID principles.
- Prefer composition over inheritance.
- Declare interfaces to define contracts.
- Write small classes with a single purpose.
  - Less than 200 instructions.
  - Less than 10 public methods.
  - Less than 10 properties.

### Exceptions

- Use exceptions to handle errors you don't expect.
- If you catch an exception, it should be to:
  - Fix an expected problem.
  - Add context.
  - Otherwise, use a global handler.

### Testing

- Follow the Arrange-Act-Assert convention for tests.
- Name test variables clearly.
- Follow the convention: inputX, mockX, actualX, expectedX, etc.
- Write unit tests for each public function.
- Use test doubles to simulate dependencies.
  - Except for third-party dependencies that are not expensive to execute.
- Write acceptance tests for each module.
- Follow the Given-When-Then convention.

#### Unit Testing Best Practices

- Create isolated tests that don't depend on external services or databases.
- Mock external dependencies and services properly.
- Test both success and error paths for each function.
- Organize test files to mirror the structure of your application code.
- Use descriptive test names that explain what is being tested and expected behavior.
- Use beforeEach and afterEach hooks to set up and clean up test environments.
- Aim for high code coverage but prioritize testing critical business logic.
- Test edge cases and boundary conditions.
- Use test factories or helper functions to create commonly used test objects.
- Avoid test interdependencies - each test should run independently.
- Write readable assertions that clearly communicate expected outcomes.
- Implement proper mocking strategies for Prisma and other database access.
- Use coverage reports to identify untested code.

## Specific to NestJS

### Basic Principles

- Use modular architecture
- Encapsulate the API in modules.
  - One module per main domain/route.
  - One controller for its route.
  - And other controllers for secondary routes.
  - A models folder with data types.
  - DTOs validated with class-validator for inputs.
  - Declare simple types for outputs.
  - A services module with business logic and persistence.
  - Use Prisma ORM for data management
  - One service per entity.
- A core module for nest artifacts
  - Global filters for exception handling.
  - Global middlewares for request management.
  - Guards for permission management.
  - Interceptors for request management.
- A shared module for services shared between modules.
  - Utilities
  - Shared business logic

### Testing

- Use the standard Jest framework for testing.
- Write tests for each controller and service.
- Write end to end tests for each api module.
- Add a admin/test method to each controller as a smoke test.
- Create appropriate test utilities for common testing operations.
- Properly mock NestJS dependencies using the Test module from @nestjs/testing.
- Use TestingModule to create isolated module tests.
- Test each layer separately:
  - Unit test services in isolation
  - Unit test controllers with mocked services
  - Integration test modules with real dependencies
  - E2E test API endpoints with an isolated test database
- Test validation pipes and guards independently.
- Test error handling and exception filters.
- Use the NestJS testing utilities to streamline test setup.
