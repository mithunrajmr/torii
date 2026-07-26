// tests/e2e/landing_showcase_seed.spec.js
// E2E: Clicking Card A (Compliance) seeds PAN_BLOCKED and causes Section G
// to transform to active alert state.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import DomainShowcase from '../../frontend/src/pages/landing/components/DomainShowcase.jsx';
import SectionGRadar from '../../frontend/src/pages/landing/components/SectionGRadar.jsx';
import React, { useState } from 'react';

// Wrapper that mirrors LandingMaster's radar refresh coordination
function TestHarness() {
  const [refreshKey, setRefreshKey] = React.useState(0);
  return (
    <div>
      <SectionGRadar refreshKey={refreshKey} />
      <DomainShowcase onSeedComplete={() => setRefreshKey((k) => k + 1)} />
    </div>
  );
}

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

describe('Landing Showcase → Section G integration', () => {
  it('seeding PAN_BLOCKED via Card A transforms Section G to alert state', async () => {
    const user = userEvent.setup();

    let ledgerCallCount = 0;
    global.fetch = vi.fn().mockImplementation((url, opts) => {
      // Initial ledger call: idle (no failures)
      // After seed: return failure
      if (url.includes('/api/sandbox/seed/PAN_BLOCKED') && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: async () => ({ account: { account_number: '1000000001' } }),
        });
      }
      if (url.includes('/api/sandbox/ledger')) {
        ledgerCallCount++;
        const failures =
          ledgerCallCount === 1
            ? []
            : [
                {
                  account_number: '1000000001',
                  name: 'Aravind Kumar',
                  error_code: 'ERR_PAN_MISSING_OVER_50K',
                },
              ];
        return Promise.resolve({
          ok: true,
          json: async () => ({ activeFailures: failures }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => ({}) });
    });

    render(
      <MemoryRouter>
        <TestHarness />
      </MemoryRouter>
    );

    // Wait for initial idle state
    await waitFor(() => {
      expect(screen.getByTestId('radar-idle')).toBeInTheDocument();
    });

    // Click the compliance domain test button
    const complianceBtn = screen.getByTestId('seed-PAN_BLOCKED');
    await user.click(complianceBtn);

    // After seed, refreshKey increments → Section G re-fetches → alert state
    await waitFor(
      () => {
        expect(screen.getByTestId('radar-alert')).toBeInTheDocument();
      },
      { timeout: 3000 }
    );

    expect(screen.getByText(/1000000001/)).toBeInTheDocument();
    expect(screen.getAllByText(/ERR_PAN_MISSING_OVER_50K/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId('execute-fix-btn')).toBeInTheDocument();
  });
});
