import { hash, verify, isHashed } from './credentials';

// WebCrypto and TextEncoder are polyfilled for jsdom in src/setupTests.js.

describe('hash', () => {
  it('actually hashes — guards against silently taking the plaintext fallback', async () => {
    // This is not a redundant assertion. The fallback path exists for browsers
    // without WebCrypto, and if it is ever taken by mistake every other test here
    // still passes while storing plaintext.
    expect(await hash('hunter2')).toMatch(/^pbkdf2\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it('does not return the password', async () => {
    const stored = await hash('hunter2');
    expect(stored).not.toContain('hunter2');
    expect(isHashed(stored)).toBe(true);
  });

  it('salts, so the same password hashes differently every time', async () => {
    const [a, b] = await Promise.all([hash('hunter2'), hash('hunter2')]);
    expect(a).not.toBe(b);
    expect((await verify('hunter2', a)).valid).toBe(true);
    expect((await verify('hunter2', b)).valid).toBe(true);
  });

  it('keeps "no password" distinguishable from a hash', async () => {
    expect(await hash('')).toBe('');
    expect(isHashed('')).toBe(false);
  });
});

describe('verify', () => {
  it('accepts the right password and rejects the wrong one', async () => {
    const stored = await hash('correct horse');
    expect((await verify('correct horse', stored)).valid).toBe(true);
    expect((await verify('correct hors', stored)).valid).toBe(false);
    expect((await verify('', stored)).valid).toBe(false);
  });

  it('does not flag a freshly hashed credential for upgrade', async () => {
    const stored = await hash('hunter2');
    expect((await verify('hunter2', stored)).needsUpgrade).toBe(false);
  });

  describe('legacy plaintext', () => {
    /**
     * Existing accounts have plaintext passwords in Firestore. They must keep
     * working, and quietly upgrade the first time they are used correctly, or
     * this change would lock people out of their own scoreboards.
     */
    it('still accepts a stored plaintext password', async () => {
      const result = await verify('1234', '1234');
      expect(result.valid).toBe(true);
      expect(result.needsUpgrade).toBe(true);
    });

    it('rejects a wrong password against stored plaintext', async () => {
      const result = await verify('9999', '1234');
      expect(result.valid).toBe(false);
      expect(result.needsUpgrade).toBe(false);
    });

    it('does not ask to upgrade an empty stored value', async () => {
      expect(await verify('', '')).toEqual({ valid: true, needsUpgrade: false });
    });
  });
});
