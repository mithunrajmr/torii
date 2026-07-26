// tests/frontend/CopilotWidget.test.jsx
// Component test: Verifies Copilot orb toggle, drawer visibility, and action chip routing.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

import CopilotOrb from '../../frontend/src/pages/landing/copilot/CopilotOrb.jsx';

afterEach(() => {
  vi.clearAllMocks();
});

describe('CopilotOrb toggle', () => {
  it('drawer is hidden before orb is clicked', () => {
    render(
      <MemoryRouter>
        <CopilotOrb />
      </MemoryRouter>
    );

    expect(screen.queryByTestId('copilot-drawer')).not.toBeInTheDocument();
  });

  it('clicking orb opens the drawer', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CopilotOrb />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('copilot-orb'));
    expect(screen.getByTestId('copilot-drawer')).toBeInTheDocument();
  });

  it('clicking orb again closes the drawer', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CopilotOrb />
      </MemoryRouter>
    );

    const orb = screen.getByTestId('copilot-orb');
    await user.click(orb); // open
    expect(screen.getByTestId('copilot-drawer')).toBeInTheDocument();

    await user.click(orb); // close
    expect(screen.queryByTestId('copilot-drawer')).not.toBeInTheDocument();
  });

  it('closing via X button inside drawer hides the drawer', async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CopilotOrb />
      </MemoryRouter>
    );

    await user.click(screen.getByTestId('copilot-orb'));
    expect(screen.getByTestId('copilot-drawer')).toBeInTheDocument();

    await user.click(screen.getByLabelText('Close Copilot'));
    expect(screen.queryByTestId('copilot-drawer')).not.toBeInTheDocument();
  });
});
