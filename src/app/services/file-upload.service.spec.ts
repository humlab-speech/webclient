import { FileUploadService } from './file-upload.service';

// storedName mirrors sanitize() in api.php (see the comment in file-upload.service.ts):
// it decides the name an upload gets on disk, so the webclient's de-duplication and
// server-side delete must normalize a name exactly the way the server stored it.
// JS .trim()/\s+ eat U+00A0 and the Unicode spaces, PHP's trim()/\s (no /u) are
// ASCII-only -- that mismatch used to make "a<NBSP>b.pdf" and "a b.pdf" collide here
// while api.php kept them apart. Vectors are mirrored from
// external/session-manager/test/sanitizeEquivalence.test.js wherever the two agree.

describe('FileUploadService.storedName', () => {
  const vectors: Array<[string, string, string]> = [
    ['a\u00a0b', 'a\u00a0b', 'keeps NBSP mid-word'],
    ['a\u2028b', 'a\u2028b', 'keeps U+2028 line separator'],
    ['a\ufeffb', 'a\ufeffb', 'keeps a BOM'],
    ['a\u3000b', 'a\u3000b', 'keeps an ideographic space'],
    ['a\u200b\u00a0b', 'a\u200b\u00a0b', 'keeps zero-width space and NBSP'],
    ['a\u00a0\u00a0b', 'a\u00a0\u00a0b', 'two NBSP: nothing collapses'],
    ['\u2028a\u2029a\u2029', '\u2028a\u2029a\u2029', 'line and paragraph separators survive'],
    ['\u00a0consent report', '\u00a0consent_report', 'leading NBSP kept, ASCII space collapsed'],
    ['a \u00a0 b', 'a_\u00a0_b', 'ASCII spaces collapse alone, NBSP does not join'],
    ['a\fb', 'a_b', 'form feed is whitespace -> collapse'],
    ['a\vb', 'a_b', 'vertical tab is whitespace -> collapse'],
    ['a \t\n b', 'a_b', 'ASCII whitespace run collapses'],
    ['a\r\nb', 'a_b', 'CRLF run collapses'],
    ['a\t\tb', 'a_b', 'tab run collapses'],
    ['\va', 'a', 'leading vertical tab trimmed'],
    ['\ra', 'a', 'leading CR trimmed'],
    ['\x00a', 'a', 'leading NUL trimmed'],
    ['  spaced  ', 'spaced', 'ASCII spaces trimmed at both ends'],
    ['\fa', '_a', 'leading form feed reaches the collapse'],
    ['\f', '_', 'form-feed-only name collapses to one underscore'],
    [' \f ', '_', 'trimmed around, then collapsed'],
    ['', '', 'empty stays empty'],
    ['consent report (v1).pdf', 'consent_report_v1.pdf', 'strips parens, collapses space'],
    ['a\\b', 'ab', 'strips a backslash'],
    ['my*file?.txt', 'myfile.txt', 'strips asterisk and question mark'],
  ];

  for (const [input, expected, label] of vectors) {
    it(`normalizes ${JSON.stringify(input)} -> ${label}`, () => {
      expect(FileUploadService.storedName(input)).toBe(expected);
    });
  }

  it('keeps NBSP and an ASCII space distinct (the bug this mirrors collapsed them)', () => {
    expect(FileUploadService.storedName('a\u00a0b.pdf')).toBe('a\u00a0b.pdf');
    expect(FileUploadService.storedName('a b.pdf')).toBe('a_b.pdf');
    expect(FileUploadService.storedName('a\u00a0b.pdf'))
      .not.toBe(FileUploadService.storedName('a b.pdf'));
  });

  it('names the uploadKey the same for two spellings that normalize alike (doubling)', () => {
    const paren = FileUploadService.storedName('file (1).wav');
    const underscore = FileUploadService.storedName('file_1.wav');
    expect(paren).toBe('file_1.wav');
    expect(underscore).toBe('file_1.wav');
    expect(paren).toBe(underscore);

    expect(FileUploadService.storedName('my  file.wav'))
      .toBe(FileUploadService.storedName('my file.wav'));
    expect(FileUploadService.storedName('my file.wav')).toBe('my_file.wav');
  });

  it('pins the two known divergences from PHP strip_tags to storedName real output', () => {
    // api.php runs strip_tags first, which drops NUL bytes anywhere and, on an
    // unterminated '<', eats to end-of-string. storedName's regex mirror does
    // neither: an interior NUL survives and a dangling '<...>' is stripped only up
    // to the last '>'. These assert storedName's ACTUAL output (verified under node);
    // they document the divergence, they do not claim byte-for-byte parity.
    expect(FileUploadService.storedName('a\x00b')).toBe('a\x00b');
    expect(FileUploadService.storedName('a<b>c<d')).toBe('acd');
  });
});
