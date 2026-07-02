'use client';

import { useState, type FormEvent } from 'react';

export default function LoginPage() {
  const [error, setError]     = useState('');
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError('');

    const password = new FormData(e.currentTarget).get('password') as string;

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      window.location.href = '/';
    } else {
      setError('Mot de passe incorrect.');
      setPending(false);
    }
  }

  return (
    <main className="min-h-screen bg-ink-0 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-ink-1 border border-ink-2 px-8 py-10">
        <h1 className="font-display text-2xl text-ink-4 tracking-tight text-center mb-8">
          Seb OS
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            name="password"
            placeholder="Mot de passe"
            required
            autoComplete="current-password"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            className={[
              'w-full rounded-lg bg-ink-0 border px-4 py-3 text-sm text-ink-4',
              'placeholder:text-ink-3 outline-none transition-colors',
              'focus:border-accent',
              error ? 'border-danger' : 'border-ink-2',
            ].join(' ')}
          />

          {error && (
            <p className="text-danger text-xs">{error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className={[
              'rounded-lg bg-accent text-ink-0 font-medium py-3 text-sm',
              'hover:bg-accent-glow transition-colors',
              'disabled:opacity-50 disabled:cursor-not-allowed',
            ].join(' ')}
          >
            {pending ? 'Vérification…' : 'Entrer'}
          </button>
        </form>
      </div>
    </main>
  );
}
