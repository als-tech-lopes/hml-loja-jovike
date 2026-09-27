import { describe, expect, it } from 'vitest';
import { isWithinDateRange } from './dateRange';

describe('isWithinDateRange', () => {
  const morning = new Date(2026, 8, 27, 8, 30);
  const evening = new Date(2026, 8, 27, 23, 59);

  it('includes the complete start and end day', () => {
    expect(isWithinDateRange(morning, '2026-09-27', '2026-09-27')).toBe(true);
    expect(isWithinDateRange(evening, '2026-09-27', '2026-09-27')).toBe(true);
  });

  it('supports a single date boundary', () => {
    expect(isWithinDateRange(morning, '2026-09-28', '')).toBe(false);
    expect(isWithinDateRange(morning, '', '2026-09-26')).toBe(false);
    expect(isWithinDateRange(morning, '2026-09-01', '')).toBe(true);
  });

  it('rejects invalid dates', () => {
    expect(isWithinDateRange('invalid', '', '')).toBe(false);
  });
});
