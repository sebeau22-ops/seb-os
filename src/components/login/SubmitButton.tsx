'use client';

import { useFormStatus } from 'react-dom';

export function SubmitButton() {
  const { pending } = useFormStatus();
  return (
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
  );
}
