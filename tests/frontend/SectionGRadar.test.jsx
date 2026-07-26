// tests/frontend/SectionGRadar.test.jsx
// Component test: Verifies Section G renders idle state (no failures)
// and alert state (with failures) correctly, and that the CTA navigates to /kiosk.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import SectionGRadar from '../../frontend/src/pages/landing/components/SectionGRadar.jsx';

// Helper: mock fetch with given ledger response
function mockLedger(payload) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => payload,
  });
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  localStorage.clear();
});

describe('SectionGRadar — idle state', () => {
  it('shows green idle well when activeFailures is empty', async () => {
    mockLedger({ activeFailures: [] });

    render(
      <MemoryRouter>
        <SectionGRadar />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('radar-idle')).toBeInTheDocument();
    });

    expect(screen.getByText(/Zero unassisted customer roadblocks detected/i)).toBeInTheDocument();
    expect(screen.queryByTestId('radar-alert')).not.toBeInTheDocument();
  });
});

describe('SectionGRadar — alert state', () => {
  const FAILURES = [
    {
      account_number: '1000000001',
      name: 'Aravind Kumar',
      error_code: 'ERR_PAN_MISSING_OVER_50K',
      amount: 7500000,
    },
  ];

  it('shows pulsing amber alert when failures exist', async () => {
    mockLedger({ activeFailures: FAILURES });

    render(
      <MemoryRouter>
        <SectionGRadar />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('radar-alert')).toBeInTheDocument();
    });

    expect(screen.getByText(/Actionable Bottleneck Detected/i)).toBeInTheDocument();
    expect(screen.getByText(/1000000001/)).toBeInTheDocument();
    expect(screen.getByText(/ERR_PAN_MISSING_OVER_50K/)).toBeInTheDocument();
  });

  it('Execute Agentic Fix button saves target_account and navigates to /kiosk', async () => {
    const user = userEvent.setup();
    mockLedger({ activeFailures: FAILURES });

    render(
      <MemoryRouter>
        <SectionGRadar />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('execute-fix-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('execute-fix-btn'));

    expect(localStorage.getItem('target_account')).toBe('1000000001');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/kiosk');
    }, { timeout: 1000 });
  });
});
