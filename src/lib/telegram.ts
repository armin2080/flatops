// Thin wrapper around Telegram.WebApp and the Serverless endpoint bridge.

/* eslint-disable @typescript-eslint/no-explicit-any */

interface TelegramWebApp {
  ready?: () => void;
  expand?: () => void;
  close?: () => void;
  initDataUnsafe?: { user?: { id?: number } };
  colorScheme?: string;
  Serverless?: {
    call: (name: string, inputOrCb: any, maybeCb?: any) => void;
  };
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function isTelegram(): boolean {
  return Boolean(getWebApp());
}

function normalizeError(err: any): Error {
  if (err instanceof Error) return err;
  if (err && typeof err === 'object') {
    const message = err.message || err.description || JSON.stringify(err);
    const e = new Error(message);
    (e as any).type = err.type;
    (e as any).status = err.status;
    (e as any).parameters = err.parameters;
    return e;
  }
  return new Error(String(err));
}

/**
 * Call a Serverless endpoint. Returns a promise of the endpoint's result.
 */
export function serverlessCall<T = any>(name: string, input?: any): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const wa = getWebApp();
    if (!wa || !wa.Serverless || typeof wa.Serverless.call !== 'function') {
      reject(new Error('Telegram Serverless is not available in this context.'));
      return;
    }
    const cb = (err: any, result: T) => {
      if (err) reject(normalizeError(err));
      else resolve(result);
    };
    if (input === undefined) {
      wa.Serverless.call(name, cb);
    } else {
      wa.Serverless.call(name, input, cb);
    }
  });
}

export function initTelegram() {
  const wa = getWebApp();
  if (!wa) return;
  try {
    wa.ready?.();
    wa.expand?.();
  } catch {
    /* ignore */
  }
}
