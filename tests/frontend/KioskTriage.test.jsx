import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import KioskTriage from '../../frontend/src/pages/kiosk/KioskTriage.jsx';

describe('KioskTriage Component', () => {
  it('renders triage view and active session header with logo slogan', () => {
    sessionStorage.setItem('kiosk_jwt', 'mock-jwt-token');
    render(
      <BrowserRouter>
        <KioskTriage />
      </BrowserRouter>
    );

    expect(screen.getByText('Active Session')).toBeInTheDocument();
    expect(screen.getByText('Mobile Handoff')).toBeInTheDocument();
  });
});
