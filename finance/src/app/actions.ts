'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/db/client';
import { setDisplayCurrency, setFxMode } from '@/lib/settings';
import { assertCurrencyCode } from '@/config/currencies';

/**
 * Display currency is a global UI filter over the same native-currency data.
 * Changing it re-renders every figure in the app; it never rewrites anything.
 */
export async function changeDisplayCurrency(formData: FormData): Promise<void> {
  setDisplayCurrency(getDb(), assertCurrencyCode(String(formData.get('currency'))));
  revalidatePath('/');
}

export async function changeFxMode(formData: FormData): Promise<void> {
  const mode = String(formData.get('mode')) === 'constant' ? 'constant' : 'period-correct';
  setFxMode(getDb(), mode);
  revalidatePath('/');
}
