export function validarPassword(password: string): string | null {
  if (!password || password.length < 6) {
    return 'La contraseña debe tener al menos 6 caracteres';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra';
  }
  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un número';
  }
  return null; // válida
}
