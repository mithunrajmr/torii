import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import KioskTriage from '../../frontend/src/pages/kiosk/KioskTriage.jsx';

describe('KioskTriage Component', () => {
  it('renders triage view with active session header and FAQ input', () => {
    sessionStorage.setItem('kiosk_jwt', 'mock-jwt-token');
    render(
      <BrowserRouter>
        <KioskTriage />
      </BrowserRouter>
    );

    // Header is always visible
    expect(screen.getByText('Active Session')).toBeInTheDocument();
    // FAQ prompt is always visible (welcome state)
    expect(screen.getByText('How can I help you today?')).toBeInTheDocument();
    // Mobile Handoff panel is conditional (showQR=false initially) — not tested here
  });
});
