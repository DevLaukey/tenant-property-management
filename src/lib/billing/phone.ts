/**
 * Normalise a Kenyan mobile number to the 2547XXXXXXXX / 2541XXXXXXXX format
 * M-Pesa expects. Accepts 07.., 01.., 7.., 1.., +254.., 254.. with spaces/dashes.
 * Returns null if the number is not a valid Kenyan mobile number.
 */
export function normalizeKenyanPhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digits = input.replace(/[^\d]/g, '');

  let local: string;
  if (digits.startsWith('254')) local = digits.slice(3);
  else if (digits.startsWith('0')) local = digits.slice(1);
  else local = digits;

  if (!/^[17]\d{8}$/.test(local)) return null;
  return `254${local}`;
}

/** 254712345678 -> 0712 345 678 */
export function formatKenyanPhone(phone: string | null | undefined): string {
  const normalized = normalizeKenyanPhone(phone);
  if (!normalized) return phone ?? '';
  const local = `0${normalized.slice(3)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
}
