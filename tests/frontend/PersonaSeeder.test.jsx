// tests/frontend/PersonaSeeder.test.jsx
// Component tests for the PersonaSeeder sandbox card.
//
// Verifies:
//   - Renders all 6 persona buttons
//   - Each button has correct accessible label
//   - Clicking a button calls the seed API and shows success feedback
//   - Disabled state while loading prevents double-clicks
//   - API error surfaces via onToast with 'error' type

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PersonaSeeder from '../../frontend/src/pages/sandbox/components/PersonaSeeder.jsx';

// ── Mock global fetch ──────────────────────────────────────────────────────
beforeEach(() => {
  vi.resetAllMocks();
});

describe('PersonaSeeder', () => {

  // ── Rendering ──────────────────────────────────────────────────────────────
  describe('rendering', () => {
    it('renders the card heading', () => {
      render(<PersonaSeeder />);
      expect(screen.getByText('1-Click Account Setup')).toBeInTheDocument();
    });

    it('renders exactly 6 persona buttons', () => {
      render(<PersonaSeeder />);
      const buttons = screen.getAllByRole('listitem');
      expect(buttons).toHaveLength(6);
    });

    it('renders PAN Blocked button', () => {
      render(<PersonaSeeder />);
      expect(screen.getByLabelText('Seed PAN Blocked persona')).toBeInTheDocument();
    });

    it('renders AML Smurfer button', () => {
      render(<PersonaSeeder />);
      expect(screen.getByLabelText('Seed AML Smurfer persona')).toBeInTheDocument();
    });

    it('renders Dormant Account button', () => {
      render(<PersonaSeeder />);
      expect(screen.getByLabelText('Seed Dormant Account persona')).toBeInTheDocument();
    });

    it('renders Signature Mismatch button', () => {
      render(<PersonaSeeder />);
      expect(screen.getByLabelText('Seed Sign Mismatch persona')).toBeInTheDocument();
    });

    it('renders Clean HNW button', () => {
      render(<PersonaSeeder />);
      expect(screen.getByLabelText('Seed Clean HNW persona')).toBeInTheDocument();
    });

    it('renders Blank Slate button', () => {
      render(<PersonaSeeder />);
      expect(screen.getByLabelText('Seed Blank Slate persona')).toBeInTheDocument();
    });
  });

  // ── Successful seed ────────────────────────────────────────────────────────
  describe('successful seed', () => {
    it('calls POST /api/sandbox/seed/PAN_BLOCKED when button is clicked', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          persona_id: 'PAN_BLOCKED',
          account: { account_number: '1000000001' },
          transaction_count: 1,
        }),
      });

      render(<PersonaSeeder />);
      fireEvent.click(screen.getByLabelText('Seed PAN Blocked persona'));

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/sandbox/seed/PAN_BLOCKED',
          expect.objectContaining({ method: 'POST' })
        );
      });
    });

    it('calls onToast with success message after seeding', async () => {
      const onToast = vi.fn();
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          persona_id: 'PAN_BLOCKED',
          account: { account_number: '1000000001' },
          transaction_count: 1,
        }),
      });

      render(<PersonaSeeder onToast={onToast} />);
      fireEvent.click(screen.getByLabelText('Seed PAN Blocked persona'));

      await waitFor(() => {
        expect(onToast).toHaveBeenCalledOnce();
        // First arg is the message — should be success (no second 'error' arg)
        const [message, type] = onToast.mock.calls[0];
        expect(message).toMatch(/PAN Blocked/i);
        expect(type).not.toBe('error');
      });
    });

    it('marks the seeded button with a success indicator ring', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          persona_id: 'BLANK_SLATE',
          account: { account_number: '1000000006' },
          transaction_count: 0,
        }),
      });

      const { container } = render(<PersonaSeeder />);
      fireEvent.click(screen.getByLabelText('Seed Blank Slate persona'));

      await waitFor(() => {
        // After seed, the button should have the ring-2 class applied
        const btn = screen.getByLabelText('Seed Blank Slate persona');
        expect(btn.className).toContain('ring-2');
      });
    });
  });

  // ── Error handling ─────────────────────────────────────────────────────────
  describe('error handling', () => {
    it('calls onToast with error type when API returns non-ok', async () => {
      const onToast = vi.fn();
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        json: async () => ({ message: 'Database error' }),
      });

      render(<PersonaSeeder onToast={onToast} />);
      fireEvent.click(screen.getByLabelText('Seed PAN Blocked persona'));

      await waitFor(() => {
        expect(onToast).toHaveBeenCalledWith(
          expect.stringContaining('Database error'),
          'error'
        );
      });
    });

    it('calls onToast with error type when fetch rejects', async () => {
      const onToast = vi.fn();
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network failure'));

      render(<PersonaSeeder onToast={onToast} />);
      fireEvent.click(screen.getByLabelText('Seed PAN Blocked persona'));

      await waitFor(() => {
        expect(onToast).toHaveBeenCalledWith(
          expect.stringContaining('Network failure'),
          'error'
        );
      });
    });
  });

  // ── Loading state ──────────────────────────────────────────────────────────
  describe('loading state', () => {
    it('disables all buttons while a seed is in progress', async () => {
      // fetch that never resolves — keeps the component in loading state
      global.fetch = vi.fn().mockReturnValueOnce(new Promise(() => {}));

      render(<PersonaSeeder />);
      fireEvent.click(screen.getByLabelText('Seed PAN Blocked persona'));

      // All buttons should now be disabled
      const buttons = screen.getAllByRole('listitem');
      buttons.forEach((btn) => {
        expect(btn).toBeDisabled();
      });
    });

    it('sets aria-busy=true on the loading button', () => {
      global.fetch = vi.fn().mockReturnValueOnce(new Promise(() => {}));

      render(<PersonaSeeder />);
      const btn = screen.getByLabelText('Seed PAN Blocked persona');
      fireEvent.click(btn);

      expect(btn).toHaveAttribute('aria-busy', 'true');
    });
  });
});
