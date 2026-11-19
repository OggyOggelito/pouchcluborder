/**
 * The one password rule, so both the form and the server agree.
 *
 * Length and nothing else. Composition rules ("one capital, one digit, one
 * symbol") push people towards Sommar2026! and are no longer what any current
 * guidance asks for; a long passphrase is both easier to remember and harder
 * to guess.
 */
export const MIN_PASSWORD_LENGTH = 12;

/** Returns a Swedish message, or null when the password is fine. */
export function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Lösenordet måste vara minst ${MIN_PASSWORD_LENGTH} tecken.`;
  }
  if (password.trim().length === 0) return "Lösenordet kan inte vara blanksteg.";
  return null;
}
