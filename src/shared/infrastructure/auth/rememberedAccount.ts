import { cookies } from 'next/headers';

const COOKIE_NAME = 'escuchainterna_account';
const THIRTY_DAYS_SECONDS = 60 * 60 * 24 * 30;

/** Solo recuerda el correo en este dispositivo; nunca contiene una contraseña. */
export async function readRememberedAccount(): Promise<string> {
  const value = (await cookies()).get(COOKIE_NAME)?.value ?? '';
  return value.length <= 254 && value.includes('@') ? value : '';
}

export async function rememberAccount(email: string, remember: boolean): Promise<void> {
  const store = await cookies();
  if (!remember) {
    store.delete(COOKIE_NAME);
    return;
  }
  store.set(COOKIE_NAME, email, {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: THIRTY_DAYS_SECONDS,
    secure: process.env.APP_URL?.startsWith('https://') ?? false,
  });
}
