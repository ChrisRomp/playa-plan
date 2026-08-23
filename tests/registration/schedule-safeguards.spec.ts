import { DayOfWeek, PrismaClient } from '@prisma/client';
import { Locator, Page, TestInfo } from '@playwright/test';
import { test, expect } from '../helpers/fixtures';
import { loginViaUi, logoutViaUi } from '../helpers/auth';
import { getPrisma } from '../helpers/db';
import { walkRegistrationToJobs } from '../helpers/registration';
import { webUrl } from '../helpers/env';

interface TestJob {
  readonly id: string;
  readonly name: string;
  readonly shiftId: string;
}

interface TestSchedule {
  readonly jobs: readonly TestJob[];
  readonly shiftIds: readonly string[];
}

async function createTestSchedule(
  prisma: PrismaClient,
  prefix: string,
  definitions: ReadonlyArray<{
    readonly categoryName: string;
    readonly dayOfWeek: DayOfWeek;
    readonly startTime: string;
    readonly endTime: string;
  }>,
): Promise<TestSchedule> {
  const jobs: TestJob[] = [];
  const shiftIds: string[] = [];

  try {
    for (const [index, definition] of definitions.entries()) {
      const category = await prisma.jobCategory.findUniqueOrThrow({
        where: { name: definition.categoryName },
      });
      const shift = await prisma.shift.create({
        data: {
          name: `${prefix} Shift ${index + 1}`,
          description: 'Playwright schedule safeguard fixture',
          dayOfWeek: definition.dayOfWeek,
          startTime: definition.startTime,
          endTime: definition.endTime,
        },
      });
      shiftIds.push(shift.id);
      const job = await prisma.job.create({
        data: {
          name: `${prefix} Job ${index + 1}`,
          location: 'E2E',
          categoryId: category.id,
          shiftId: shift.id,
          maxRegistrations: 100,
        },
      });
      jobs.push(job);
    }
  } catch (error) {
    await prisma.job.deleteMany({ where: { id: { in: jobs.map(job => job.id) } } });
    await prisma.shift.deleteMany({ where: { id: { in: shiftIds } } });
    throw error;
  }

  return { jobs, shiftIds };
}

async function deleteTestSchedule(
  prisma: PrismaClient,
  schedule: TestSchedule,
  userId?: string,
): Promise<void> {
  if (userId) {
    const registrations = await prisma.registration.findMany({
      where: { userId },
      select: { id: true },
    });
    await prisma.adminAudit.deleteMany({
      where: {
        targetRecordId: {
          in: [
            ...registrations.map(registration => registration.id),
            ...schedule.jobs.map(job => job.id),
          ],
        },
      },
    });
    await prisma.registration.deleteMany({ where: { userId } });
  }
  await prisma.job.deleteMany({
    where: { id: { in: schedule.jobs.map(job => job.id) } },
  });
  await prisma.shift.deleteMany({ where: { id: { in: [...schedule.shiftIds] } } });
}

async function selectJob(
  page: Page,
  categoryName: string,
  jobName: string,
): Promise<void> {
  const checkbox = page.getByRole('checkbox', { name: new RegExp(jobName) });
  if (!(await checkbox.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: new RegExp(categoryName) }).click();
  }
  await checkbox.check();
}

async function revealJob(page: Page, categoryName: string, jobName: string): Promise<void> {
  const checkbox = page.getByRole('checkbox', { name: new RegExp(jobName) });
  if (!(await checkbox.isVisible().catch(() => false))) {
    await page.getByRole('button', { name: new RegExp(categoryName) }).click();
  }
}

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

async function attachElementScreenshot(
  locator: Locator,
  testInfo: TestInfo,
  name: string,
): Promise<void> {
  const path = testInfo.outputPath(`${name}.png`);
  await locator.screenshot({ path });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

test.describe.serial(
  'Registration schedule safeguards',
  { tag: ['@registration', '@admin', '@reports', '@schedule'] },
  () => {
    test.use({ storageState: { cookies: [], origins: [] } });

    test(
      'requires confirmation before submitting extra shifts',
      async ({ page, freshDeferredParticipant }, testInfo) => {
        const prisma = getPrisma();
        const prefix = `Extra ${freshDeferredParticipant.id.slice(0, 8)}`;
        const schedule = await createTestSchedule(prisma, prefix, [
          {
            categoryName: 'Art Car Driver',
            dayOfWeek: DayOfWeek.MONDAY,
            startTime: '08:00',
            endTime: '09:00',
          },
          {
            categoryName: 'Art Car Driver',
            dayOfWeek: DayOfWeek.TUESDAY,
            startTime: '08:00',
            endTime: '09:00',
          },
          {
            categoryName: 'Teardown',
            dayOfWeek: DayOfWeek.CLOSING_SUNDAY,
            startTime: '08:00',
            endTime: '09:00',
          },
        ]);

        try {
          await walkRegistrationToJobs(page);
          await selectJob(page, 'Art Car Driver', schedule.jobs[0].name);
          await selectJob(page, 'Art Car Driver', schedule.jobs[1].name);
          await selectJob(page, 'Teardown', schedule.jobs[2].name);
          await page.getByRole('button', { name: 'Continue' }).click();

          await expect(
            page.getByText('You selected 3 shifts, but the requirement is 2 shifts.'),
          ).toBeVisible();
          await page.getByRole('checkbox', { name: /i accept the terms/i }).check();
          await page.getByRole('button', { name: 'Review & Pay' }).click();
          await expect(
            page.getByText('Confirm that you intend to take the additional shifts.'),
          ).toBeVisible();
          await attachScreenshot(page, testInfo, 'extra-shift-confirmation');

          await page
            .getByRole('checkbox', {
              name: 'I understand and intend to take these additional shifts.',
            })
            .check();
          await page.getByRole('button', { name: 'Review & Pay' }).click();
          await expect(page.getByRole('heading', { name: 'Payment' })).toBeVisible();
          await page.getByRole('button', { name: /pay dues later/i }).click();
          await expect(page).toHaveURL(/#\/dashboard/);

          const registration = await prisma.registration.findFirstOrThrow({
            where: { userId: freshDeferredParticipant.id },
            include: { jobs: true },
            orderBy: { createdAt: 'desc' },
          });
          expect(registration.status).toBe('CONFIRMED');
          expect(registration.jobs).toHaveLength(3);
        } finally {
          await deleteTestSchedule(prisma, schedule, freshDeferredParticipant.id);
        }
      },
    );

    test(
      'disables a shift that conflicts with a selected shift',
      async ({ page, freshParticipant }, testInfo) => {
        const prisma = getPrisma();
        const prefix = `Conflict ${freshParticipant.id.slice(0, 8)}`;
        const schedule = await createTestSchedule(prisma, prefix, [
          {
            categoryName: 'Art Car Driver',
            dayOfWeek: DayOfWeek.THURSDAY,
            startTime: '10:00',
            endTime: '12:00',
          },
          {
            categoryName: 'Manifest Assistant',
            dayOfWeek: DayOfWeek.THURSDAY,
            startTime: '10:30',
            endTime: '11:30',
          },
        ]);

        try {
          await walkRegistrationToJobs(page);
          await selectJob(page, 'Art Car Driver', schedule.jobs[0].name);
          await revealJob(page, 'Manifest Assistant', schedule.jobs[1].name);

          const conflictingJob = page.getByRole('checkbox', {
            name: new RegExp(schedule.jobs[1].name),
          });
          await expect(conflictingJob).toBeDisabled();
          await expect(
            page.getByText(`Conflicts with ${schedule.jobs[0].name}`).first(),
          ).toBeVisible();
          await attachScreenshot(page, testInfo, 'participant-conflict-blocked');
        } finally {
          await deleteTestSchedule(prisma, schedule, freshParticipant.id);
        }
      },
    );

    test(
      'admin can override a conflict that appears in the exceptions report',
      async ({ page, freshParticipant }, testInfo) => {
        test.setTimeout(60_000);
        const prisma = getPrisma();
        const prefix = `Override ${freshParticipant.id.slice(0, 8)}`;
        const schedule = await createTestSchedule(prisma, prefix, [
          {
            categoryName: 'Art Car Driver',
            dayOfWeek: DayOfWeek.FRIDAY,
            startTime: '09:00',
            endTime: '12:00',
          },
          {
            categoryName: 'Manifest Assistant',
            dayOfWeek: DayOfWeek.FRIDAY,
            startTime: '10:00',
            endTime: '11:00',
          },
        ]);
        await prisma.registration.create({
          data: {
            userId: freshParticipant.id,
            year: new Date().getFullYear(),
            status: 'CONFIRMED',
            jobs: {
              create: [{ jobId: schedule.jobs[0].id }],
            },
          },
        });

        try {
          await logoutViaUi(page);
          await loginViaUi(page, 'e2e-admin@test.playaplan.local');
          await page.goto(webUrl('/admin/manage-registrations'));
          await expect(
            page.getByRole('heading', { name: 'Manage Registrations' }),
          ).toBeVisible();
          const search = page.getByRole('textbox', {
            name: /filter table data|search/i,
          });
          await search.fill(freshParticipant.email);
          await expect(page.getByText(freshParticipant.email)).toBeVisible();
          await page.getByTitle('Edit registration').click();
          await expect(page.getByRole('heading', { name: 'Edit Registration' })).toBeVisible();

          await page
            .getByRole('checkbox', { name: new RegExp(schedule.jobs[1].name) })
            .check();
          await expect(
            page.getByText('This assignment contains schedule conflicts:'),
          ).toBeVisible();
          await page.getByRole('button', { name: 'Save Changes' }).click();
          const overrideValidation = page.getByText(
            'Confirm that you intend to override the schedule conflicts.',
          );
          await expect(overrideValidation).toBeVisible();
          const conflictPanel = overrideValidation.locator(
            'xpath=ancestor::div[contains(@class, "rounded-md")][1]',
          );
          await attachElementScreenshot(conflictPanel, testInfo, 'admin-conflict-override');

          await page
            .getByRole('checkbox', {
              name: 'I understand and want to override these schedule conflicts.',
            })
            .check();
          await page.getByRole('button', { name: 'Save Changes' }).click();
          await expect(
            page.getByText(/has been updated successfully/i),
          ).toBeVisible();

          await page.goto(webUrl('/reports/schedule-exceptions'));
          await expect(
            page.getByRole('heading', { name: 'Schedule Exceptions Report' }),
          ).toBeVisible();
          const reportRow = page
            .getByRole('row')
            .filter({ hasText: freshParticipant.email });
          await expect(reportRow).toContainText('1 conflict');
          await expect(reportRow).toContainText(schedule.jobs[0].name);
          await expect(reportRow).toContainText(schedule.jobs[1].name);
          await attachScreenshot(page, testInfo, 'schedule-exceptions-report');
        } finally {
          await deleteTestSchedule(prisma, schedule, freshParticipant.id);
        }
      },
    );
  },
);
