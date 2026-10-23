export function normalizePhone(raw: string): string {
  // Strip all non-digit characters
  const digits = raw.replace(/\D/g, '');
  if (!digits) return '';

  // If 10 digits entered (standard Indian mobile), prefix with country code 91
  if (digits.length === 10) {
    return `91${digits}`;
  }

  // If 11 digits starting with 0, replace leading 0 with 91
  if (digits.length === 11 && digits.startsWith('0')) {
    return `91${digits.slice(1)}`;
  }

  return digits;
}

export function formatPhone(phone: string): string {
  if (phone.length === 12 && phone.startsWith('91')) {
    return `+91 ${phone.slice(2, 7)} ${phone.slice(7)}`;
  }
  return `+${phone}`;
}
