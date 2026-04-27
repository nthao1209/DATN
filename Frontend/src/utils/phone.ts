export const isValidPhoneNumber = (value: string) => {
  const normalized = normalizePhoneNumber(value);
  return /^0[0-9]{9}$/.test(normalized);
};

export const normalizePhoneNumber = (value: string) => value.replace(/\D/g, '').trim();
