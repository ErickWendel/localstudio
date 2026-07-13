import { test } from '@playwright/test';

test.skip(
  process.env.E2E_COVERAGE_REPORT_ONLY !== '1',
  'Coverage report aggregation runs only in the dedicated CI job.',
);

test('generates an aggregate coverage report from downloaded raw coverage', () => {
  // The existing Playwright global teardown reads E2E_COVERAGE_INPUT_DIR and writes the report.
});
