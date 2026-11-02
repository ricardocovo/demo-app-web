import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api';
import { ResourceForm } from './ResourceForm';
import { data } from '../tests/unit-data';

describe('accessible resource forms', () => {
  it('shows field errors, focuses the first invalid input and sends a trimmed name', async () => {
    const user = userEvent.setup();
    const create = vi.spyOn(api, 'create').mockResolvedValue({ id: 5, name: 'Junior Cup', year: 2026 });
    const saved = vi.fn();
    render(<ResourceForm resource="championships" data={data} onClose={vi.fn()} onSaved={saved} />);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true');
    expect(create).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveFocus());
    await user.type(screen.getByLabelText('Name'), '  Junior Cup  ');
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(create).toHaveBeenCalledWith('championships', { name: 'Junior Cup', year: new Date().getFullYear() });
    expect(saved).toHaveBeenCalledOnce();
  });
  it('preserves an existing away team when the home selection changes', async () => {
    const user = userEvent.setup();
    render(<ResourceForm resource="games" entity={data.games[0]} data={data} onClose={vi.fn()} onSaved={vi.fn()} />);
    await user.selectOptions(screen.getByLabelText('Home team'), '3');
    expect(screen.getByLabelText('Away team')).toHaveValue('2');
    expect(screen.getByRole('option', { name: /Current selection/ })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByText('Choose a different team in the same championship.')).toBeVisible();
  });
  it('renders server field errors and conflict details without closing', async () => {
    const user = userEvent.setup();
    const saved = vi.fn();
    const update = vi.spyOn(api, 'update').mockRejectedValue(new ApiError('Please check your input.', 400, { name: ['Name rejected by API'] }));
    render(<ResourceForm resource="teams" entity={data.teams[0]} data={data} onClose={vi.fn()} onSaved={saved} />);
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Name rejected by API')).toBeVisible();
    update.mockRejectedValue(new ApiError('Cannot move a team that has games to another championship.', 409));
    await user.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(await screen.findByText('Cannot move a team that has games to another championship.')).toBeVisible();
    expect(saved).not.toHaveBeenCalled();
  });
  it('does not silently replace an unavailable current player on a changed game', () => {
    render(<ResourceForm resource="player-stats" entity={{ id: 1, gameId: 1, playerId: 2, position: 'Forward', minutesPlayed: 10, starter: true, goals: 1, assists: 0 }} data={data} onClose={vi.fn()} onSaved={vi.fn()} />);
    expect(screen.getByLabelText('Player')).toHaveValue('2');
    fireEvent.submit(screen.getByRole('button', { name: 'Save changes' }).closest('form')!);
    expect(screen.getByText(/Choose an available player from/)).toBeVisible();
  });
});
