import * as bcrypt from 'bcrypt';

// Cost factor for bcrypt. Higher = slower = harder to brute-force. 12 is a good default.
const BCRYPT_ROUNDS = 12;

// Hash a plaintext password (bcrypt embeds a per-user salt in the output).
export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

// Compare a plaintext password against a stored bcrypt hash.
export function comparePassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
