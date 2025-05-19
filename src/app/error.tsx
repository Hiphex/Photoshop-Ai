'use client';

import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error('Uncaught error in App Router:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center p-4 bg-neutral-900 text-white">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold">Something went wrong</h1>
          <p className="opacity-75">{error.message}</p>
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-700"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
} 