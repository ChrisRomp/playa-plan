import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasskeysSection from './PasskeysSection';
import { usePasskeys } from '../../hooks/usePasskeys';
import type { Passkey } from '../../lib/api/passkeys';

vi.mock('../../hooks/usePasskeys');

const mockUsePasskeys = vi.mocked(usePasskeys);

const samplePasskey: Passkey = {
  id: 'pk-1',
  nickname: 'My Phone',
  transports: ['internal'],
  backedUp: true,
  deviceType: 'multiDevice',
  lastUsedAt: null,
  createdAt: new Date('2026-04-01T12:00:00'),
};

const defaultHookValue = {
  passkeys: [] as Passkey[],
  isLoading: false,
  error: null,
  supported: true,
  refresh: vi.fn(),
  register: vi.fn(),
  rename: vi.fn(),
  remove: vi.fn(),
};

const setNavigatorHints = (): void => {
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15',
    configurable: true,
  });
  Object.defineProperty(window.navigator, 'platform', {
    value: 'MacIntel',
    configurable: true,
  });
};

describe('PasskeysSection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T12:00:00'));
    setNavigatorHints();
    mockUsePasskeys.mockReturnValue(defaultHookValue);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('prefills a required editable default passkey name', () => {
    render(<PasskeysSection />);

    const input = screen.getByLabelText(/passkey name/i) as HTMLInputElement;

    expect(input).toBeRequired();
    expect(input.value).toBe(`Safari on macOS - ${new Date().toLocaleDateString()}`);
  });

  it('selects the default passkey name when focused', () => {
    render(<PasskeysSection />);

    const input = screen.getByLabelText(/passkey name/i) as HTMLInputElement;
    fireEvent.focus(input);

    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  it('submits the trimmed passkey name', () => {
    const register = vi.fn().mockImplementation(() => new Promise<Passkey>(() => undefined));
    mockUsePasskeys.mockReturnValue({ ...defaultHookValue, register });

    render(<PasskeysSection />);
    fireEvent.change(screen.getByLabelText(/passkey name/i), {
      target: { value: '  My laptop  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create passkey/i }));

    expect(register).toHaveBeenCalledWith('My laptop');
  });

  it('requires a non-blank passkey name before adding', () => {
    render(<PasskeysSection />);

    fireEvent.change(screen.getByLabelText(/passkey name/i), {
      target: { value: '   ' },
    });

    expect(screen.getByRole('button', { name: /create passkey/i })).toBeDisabled();
  });

  it('hides the add passkey form when passkeys already exist', () => {
    mockUsePasskeys.mockReturnValue({
      ...defaultHookValue,
      passkeys: [samplePasskey],
    });

    render(<PasskeysSection />);

    expect(screen.queryByLabelText(/passkey name/i)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^add passkey$/i })).toBeInTheDocument();
  });

  it('shows the add passkey form after clicking Add passkey', () => {
    mockUsePasskeys.mockReturnValue({
      ...defaultHookValue,
      passkeys: [samplePasskey],
    });

    render(<PasskeysSection />);
    fireEvent.click(screen.getByRole('button', { name: /^add passkey$/i }));

    expect(screen.getByLabelText(/passkey name/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create passkey/i })).toBeInTheDocument();
  });

  it('requires a non-blank name when renaming', () => {
    const rename = vi.fn();
    mockUsePasskeys.mockReturnValue({
      ...defaultHookValue,
      passkeys: [samplePasskey],
      rename,
    });

    render(<PasskeysSection />);
    fireEvent.click(screen.getByRole('button', { name: /rename/i }));
    fireEvent.change(screen.getByDisplayValue('My Phone'), {
      target: { value: '   ' },
    });

    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled();
    expect(rename).not.toHaveBeenCalled();
  });

  it('does not show synced status text for backed-up passkeys', () => {
    mockUsePasskeys.mockReturnValue({
      ...defaultHookValue,
      passkeys: [samplePasskey],
    });

    render(<PasskeysSection />);

    expect(screen.getByText('My Phone')).toBeInTheDocument();
    expect(screen.queryByText(/synced/i)).not.toBeInTheDocument();
  });
});
