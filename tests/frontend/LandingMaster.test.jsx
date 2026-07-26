// tests/frontend/LandingMaster.test.jsx
// Unit test: Verifies all 4 workspace launchpad cards exist with correct routes.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

// Mock fetch to avoid network calls in unit tests
beforeEach(() => {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ activeFailures: [] }),
  });
});

// Mock useNavigate so navigation doesn't crash in jsdom
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import WorkspaceCards from '../../frontend/src/pages/landing/components/WorkspaceCards.jsx';

describe('WorkspaceCards', () => {
  it('renders all 4 workspace launchpad buttons', () => {
    render(
      <MemoryRouter>
        <WorkspaceCards />
      </MemoryRouter>
    );

    expect(screen.getByTestId('workspace-kiosk')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-mobile')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-teller')).toBeInTheDocument();
    expect(screen.getByTestId('workspace-sandbox')).toBeInTheDocument();
  });

  it('each workspace button has a descriptive aria-label', () => {
    render(
      <MemoryRouter>
        <WorkspaceCards />
      </MemoryRouter>
    );

    expect(screen.getByLabelText(/Open Kiosk Portal workspace/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Open Mobile PWA workspace/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Open Teller HITL workspace/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Open Dev Sandbox workspace/i)).toBeInTheDocument();
  });

  it('clicking kiosk card calls navigate with /kiosk', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <WorkspaceCards />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('workspace-kiosk'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/kiosk');
    }, { timeout: 1000 });
  });

  it('clicking teller card calls navigate with /teller', async () => {
    const user = userEvent.setup();
    mockNavigate.mockClear();
    render(
      <MemoryRouter>
        <WorkspaceCards />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('workspace-teller'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/teller');
    }, { timeout: 1000 });
  });
});
