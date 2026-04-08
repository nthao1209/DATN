export const isValidPhoneNumber = (value: string) => {
  const normalized = value.trim();
  return /^0[0-9]{9}$/.test(normalized);
};

export const normalizePhoneNumber = (value: string) => value.replace(/\s+/g, '').trim();
