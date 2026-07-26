// tests/frontend/CopilotRouting.test.jsx
// Integration test: Verifies that an AI response with an actionChip
// renders the ActionChip button and routes the user when clicked.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import CopilotDrawer from '../../frontend/src/pages/landing/copilot/CopilotDrawer.jsx';

afterEach(() => {
  vi.clearAllMocks();
});

describe('CopilotDrawer action chip routing', () => {
  it('renders an action chip when AI response includes actionChip', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'I can help unblock your card. Click below to start:',
        actionChip: { label: 'Launch Security Triage', route: '/kiosk' },
      }),
    });

    render(
      <MemoryRouter>
        <CopilotDrawer onClose={() => {}} />
      </MemoryRouter>
    );

    await user.type(screen.getByTestId('copilot-input'), 'my card is blocked');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Launch Security Triage/i)).toBeInTheDocument();
    });
  });

  it('clicking action chip navigates to the chip route', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: 'Click below to start triage:',
        actionChip: { label: 'Launch Security Triage', route: '/kiosk' },
      }),
    });

    render(
      <MemoryRouter>
        <CopilotDrawer onClose={() => {}} />
      </MemoryRouter>
    );

    await user.type(screen.getByTestId('copilot-input'), 'blocked card');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Launch Security Triage/i)).toBeInTheDocument();
    });

    await user.click(screen.getByText(/Launch Security Triage/i));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/kiosk');
    }, { timeout: 1000 });
  });

  it('renders a fallback chip on API error', async () => {
    const user = userEvent.setup();

    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(
      <MemoryRouter>
        <CopilotDrawer onClose={() => {}} />
      </MemoryRouter>
    );

    await user.type(screen.getByTestId('copilot-input'), 'need help');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText(/Open Kiosk Triage/i)).toBeInTheDocument();
    });
  });
});
