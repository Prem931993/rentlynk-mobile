// Mirrors the server's PIN policy so users get instant feedback.
const COMMON = new Set([
  "1234", "1111", "0000", "1212", "7777", "1004", "2000", "4444", "2222", "6969", "9999", "3333", "5555", "6666",
  "1122", "1313", "8888", "4321", "2001", "1010", "2580", "0852", "1470", "3690", "1379", "1478", "2468", "1357",
  "0123", "9876", "1231", "1123", "1984", "1987", "1990", "2020", "2021", "2022", "2023", "2024", "2025", "2026",
]);

export const pinProblem = (pin: string): string | null => {
  if (!/^\d{4}$/.test(pin)) return "PIN must be 4 digits";
  if (/^(\d)\1{3}$/.test(pin)) return "Avoid repeating the same digit";
  const d = pin.split("").map(Number);
  if (d.every((v, i) => i === 0 || v === (d[i - 1] + 1) % 10) || d.every((v, i) => i === 0 || v === (d[i - 1] + 9) % 10)) return "Avoid sequences like 1234";
  if (/^(\d\d)\1$/.test(pin)) return "Avoid repeating pairs like 1212";
  if (COMMON.has(pin)) return "This PIN is too easy to guess";
  return null;
};
