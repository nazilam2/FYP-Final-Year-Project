import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App'; // make sure path is correct

test('renders login form', () => {
  render(<App />);
  expect(screen.getByText(/login/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/enter your email/i)).toBeInTheDocument();
  expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
});
