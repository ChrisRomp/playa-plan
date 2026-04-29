import { useState } from 'react';
import { usePasskeys } from '../../hooks/usePasskeys';
import type { Passkey } from '../../lib/api/passkeys';

const NICKNAME_MAX_LENGTH = 20;

const formatDate = (d: Date | null): string =>
  d ? d.toLocaleDateString() : 'never';

/**
 * "Sign-in passkeys" section for the user profile page. Lists all
 * registered passkeys, supports adding a new one, renaming, and
 * deleting. Hides itself when the browser does not support WebAuthn.
 */
const PasskeysSection: React.FC = () => {
  const { passkeys, isLoading, error, supported, register, rename, remove } =
    usePasskeys();

  const [newNickname, setNewNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (!supported) return null;

  const handleAdd = async () => {
    if (newNickname.length > NICKNAME_MAX_LENGTH) return;
    setBusy(true);
    const created = await register(newNickname.trim() || undefined);
    setBusy(false);
    if (created) setNewNickname('');
  };

  const startRename = (p: Passkey) => {
    setRenamingId(p.id);
    setRenameValue(p.nickname ?? '');
  };

  const submitRename = async () => {
    if (!renamingId) return;
    if (renameValue.length > NICKNAME_MAX_LENGTH) return;
    setBusy(true);
    await rename(renamingId, renameValue.trim());
    setBusy(false);
    setRenamingId(null);
  };

  const confirmRemove = async (p: Passkey) => {
    const label = p.nickname || 'this passkey';
    if (!window.confirm(`Remove ${label}? You will no longer be able to sign in with it.`)) {
      return;
    }
    setBusy(true);
    await remove(p.id);
    setBusy(false);
  };

  return (
    <section
      aria-labelledby="passkeys-heading"
      className="bg-white shadow-md rounded-lg p-6 mt-6"
    >
      <h2 id="passkeys-heading" className="text-xl font-semibold mb-4">
        Sign-in passkeys
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Passkeys let you sign in without an email code. They are stored on your
        device or in your browser's password manager.
      </p>

      {error && (
        <div role="alert" className="mb-4 p-3 bg-red-50 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="mb-6 flex flex-col sm:flex-row gap-2 sm:items-end">
        <label className="flex-1">
          <span className="block text-sm font-medium text-gray-700 mb-1">
            Nickname (optional, up to {NICKNAME_MAX_LENGTH} chars)
          </span>
          <input
            type="text"
            value={newNickname}
            onChange={(e) => setNewNickname(e.target.value)}
            maxLength={NICKNAME_MAX_LENGTH}
            placeholder="e.g. My laptop"
            className="w-full border rounded px-3 py-2"
            disabled={busy}
          />
        </label>
        <button
          type="button"
          onClick={handleAdd}
          disabled={busy || newNickname.length > NICKNAME_MAX_LENGTH}
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
        >
          {busy ? 'Working…' : 'Add passkey'}
        </button>
      </div>

      {isLoading ? (
        <div>Loading…</div>
      ) : passkeys.length === 0 ? (
        <p className="text-sm text-gray-500">No passkeys registered yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {passkeys.map((p) => (
            <li key={p.id} className="py-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                {renamingId === p.id ? (
                  <div className="flex gap-2 items-center">
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      maxLength={NICKNAME_MAX_LENGTH}
                      className="flex-1 border rounded px-2 py-1"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={submitRename}
                      disabled={busy || renameValue.length > NICKNAME_MAX_LENGTH}
                      className="text-blue-600 hover:underline"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingId(null)}
                      className="text-gray-500 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="font-medium truncate">
                      {p.nickname || <em className="text-gray-500">Unnamed passkey</em>}
                    </div>
                    <div className="text-xs text-gray-500">
                      Added {formatDate(p.createdAt)} · Last used {formatDate(p.lastUsedAt)}
                      {p.backedUp && ' · Synced'}
                    </div>
                  </>
                )}
              </div>
              {renamingId !== p.id && (
                <div className="flex gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => startRename(p)}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmRemove(p)}
                    disabled={busy}
                    className="text-red-600 hover:underline text-sm"
                  >
                    Remove
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default PasskeysSection;
