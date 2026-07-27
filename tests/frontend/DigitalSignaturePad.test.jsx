// tests/frontend/DigitalSignaturePad.test.jsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DigitalSignaturePad from '../../frontend/src/components/DigitalSignaturePad.jsx';

describe('Phase 3 — Digital Signature Pad Component', () => {
  it('renders canvas signature pad element', () => {
    render(<DigitalSignaturePad onSave={vi.fn()} />);
    expect(screen.getByTestId('digital-signature-pad')).toBeInTheDocument();
    expect(screen.getByText(/Digital Customer Signature/i)).toBeInTheDocument();
  });

  it('allows switching to type signature mode', () => {
    render(<DigitalSignaturePad onSave={vi.fn()} initialName="ARJUN SHARMA" />);
    const switchBtn = screen.getByText(/Type Signature/i);
    fireEvent.click(switchBtn);

    expect(screen.getByPlaceholderText(/Type your full legal name/i)).toBeInTheDocument();
  });

  it('invokes onSave callback when user types signature', () => {
    const onSaveMock = vi.fn();
    render(<DigitalSignaturePad onSave={onSaveMock} />);
    const switchBtn = screen.getByText(/Type Signature/i);
    fireEvent.click(switchBtn);

    const input = screen.getByPlaceholderText(/Type your full legal name/i);
    fireEvent.change(input, { target: { value: 'Arjun Sharma' } });

    expect(onSaveMock).toHaveBeenCalled();
  });
});
