/**
 * Common utilities for testing NestJS components
 */
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

/**
 * Type for provider overrides in testing modules
 */
type ProviderOverrides = Record<string, unknown>;

/**
 * Creates a testing module with optional overrides.
 * Useful for creating test modules with mocked dependencies.
 */
export async function createTestingModule(
  metadata: ModuleMetadata,
  overrides: ProviderOverrides = {}
): Promise<TestingModule> {
  const builder = Test.createTestingModule(metadata);

  // Apply all provided overrides to the module
  Object.entries(overrides).forEach(([token, mockValue]) => {
    builder.overrideProvider(token).useValue(mockValue);
  });

  return builder.compile();
}

/**
 * Creates a mock for any class or provider
 * @param mockProperties - Properties to add to the mock
 * @returns A mock object with the specified properties
 */
export function createMock<T>(mockProperties: Partial<T> = {}): jest.Mocked<T> {
  return mockProperties as jest.Mocked<T>;
}

/**
 * Interface for Prisma model mock methods
 */
interface PrismaModelMock {
  findUnique: jest.Mock;
  findMany: jest.Mock;
  findFirst: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  count: jest.Mock;
}

/**
 * Interface for the complete Prisma mock
 */
interface PrismaMock {
  $connect: jest.Mock;
  $disconnect: jest.Mock;
  $transaction: jest.Mock;
  user: PrismaModelMock;
  camp: PrismaModelMock;
  job: PrismaModelMock;
  shift: PrismaModelMock;
  registration: PrismaModelMock;
  payment: PrismaModelMock;
  notification: PrismaModelMock;
  [key: string]: unknown;
}

/**
 * Creates a mock for PrismaService with specified method mocks
 * @param mockMethods - Methods to mock on the PrismaService
 */
export function createPrismaMock(mockMethods: Record<string, unknown> = {}): PrismaMock {
  // Create a base mock with common prisma structure
  const baseMock = {
    $connect: jest.fn().mockResolvedValue(undefined),
    $disconnect: jest.fn().mockResolvedValue(undefined),
    // Add commonly used Prisma models with standard CRUD operations
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    camp: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    job: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    shift: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    registration: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    payment: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    notification: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    // Add transaction methods
    $transaction: jest.fn(),
  };

  // Override with any specific mock implementations
  return { ...baseMock, ...mockMethods };
}