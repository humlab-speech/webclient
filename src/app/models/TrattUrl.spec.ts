import { trattOrigin, trattSubdomain } from './TrattUrl';

describe('TrattUrl', () => {
  it('uses the configured subdomain', () => {
    expect(trattSubdomain({ trattSubdomain: 'octra' })).toBe('octra');
    expect(trattOrigin({ protocol: 'https:', hostname: 'visp.example.org' }, { trattSubdomain: 'octra' }))
      .toBe('https://octra.visp.example.org');
  });

  it('falls back to tratt when nothing usable is configured', () => {
    expect(trattSubdomain(undefined)).toBe('tratt');
    expect(trattSubdomain({})).toBe('tratt');
    expect(trattSubdomain({ trattSubdomain: 'evil.example.org/x' })).toBe('tratt');
  });
});
