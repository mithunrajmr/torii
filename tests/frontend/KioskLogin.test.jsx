import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import KioskLogin from '../../frontend/src/pages/kiosk/KioskLogin.jsx';

describe('KioskLogin Component', () => {
  it('renders numeric keypad and Torii logo slogan header', () => {
    render(
      <BrowserRouter>
        <KioskLogin />
      </BrowserRouter>
    );

    expect(screen.getByText('Legacy Behind. Resolution Ahead.')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 2: Account Lookup')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
  });
});
