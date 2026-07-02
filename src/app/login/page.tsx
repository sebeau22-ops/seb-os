interface Props {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams;
  const errorMsg =
    error === '1'        ? 'Mot de passe incorrect.'
    : error === 'config' ? 'Configuration serveur manquante.'
    : null;

  return (
    <main className="min-h-screen bg-ink-0 flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl bg-ink-1 border border-ink-2 px-8 py-10">
        <h1 className="font-display text-2xl text-ink-4 tracking-tight text-center mb-8">
          Seb OS
        </h1>

        <form method="POST" action="/api/auth/login-form" className="flex flex-col gap-4">
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
              errorMsg ? 'border-danger' : 'border-ink-2',
            ].join(' ')}
          />

          {errorMsg && (
            <p className="text-danger text-xs">{errorMsg}</p>
          )}

          <button
            type="submit"
            className="rounded-lg bg-accent text-ink-0 font-medium py-3 text-sm hover:bg-accent-glow transition-colors"
          >
            Entrer
          </button>
        </form>
      </div>
    </main>
  );
}
