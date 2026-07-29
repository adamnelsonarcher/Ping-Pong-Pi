import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import SaveStatus from './SaveStatus';
import dataService from '../services/dataService';

jest.mock('../config/firebase', () => ({
  auth: { currentUser: { getIdToken: async () => 'fake-token' } },
  authReady: Promise.resolve(null),
}));

afterEach(() => {
  dataService.lastSaveError = null;
  dataService._disposed = false;
  dataService._saveTimer = null;
  dataService._emit();
});

describe('SaveStatus', () => {
  it('shows nothing while saves are healthy', () => {
    dataService.lastSaveError = null;
    const { container } = render(<SaveStatus />);
    expect(container).toBeEmptyDOMElement();
  });

  it('appears when a cloud save has failed', () => {
    render(<SaveStatus />);
    act(() => {
      dataService.lastSaveError = new Error('Save failed (500)');
      dataService._emit();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(/not yet synced/i)).toBeInTheDocument();
  });

  it('retries and clears once the save succeeds', async () => {
    dataService.setLocalMode(false);
    dataService.currentUser = 'someone@example.com';
    render(<SaveStatus />);

    act(() => {
      dataService.lastSaveError = new Error('Save failed (500)');
      dataService._emit();
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();

    // Next save succeeds.
    global.fetch = async () => ({ ok: true, status: 200, json: async () => ({ revision: 1 }) });
    fireEvent.click(screen.getByText('Retry'));

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });
});
