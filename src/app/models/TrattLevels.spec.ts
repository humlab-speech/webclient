import { preferredTrattLevel, trattLevelOptions } from './TrattLevels';

describe('trattLevelOptions', () => {
  const levels = [
    { name: 'Word', type: 'ITEM' },
    { name: 'Phonetic', type: 'SEGMENT' },
    { name: 'Transcription', type: 'SEGMENT' },
    { name: 'Notes', type: 'segment' },
    { name: 'Clicks', type: 'EVENT' },
  ];
  const links = [{ superLevel: 'Word', subLevel: 'Phonetic', type: 'ONE_TO_MANY' }];

  it('offers unlinked SEGMENT levels only, with a reason for the rest', () => {
    const options = trattLevelOptions(levels, links);
    expect(options.filter(o => o.usable).map(o => o.name)).toEqual(['Transcription', 'Notes']);
    expect(options.find(o => o.name === 'Word')?.reason).toContain('SEGMENT');
    expect(options.find(o => o.name === 'Clicks')?.reason).toContain('EVENT');
    expect(options.find(o => o.name === 'Phonetic')?.reason).toBe('Linked to Word');
  });

  it('handles a project without levels or links', () => {
    expect(trattLevelOptions(undefined, undefined)).toEqual([]);
    expect(trattLevelOptions([{ name: 'Transcription', type: 'SEGMENT' }], undefined)[0].usable).toBeTrue();
  });
});

describe('preferredTrattLevel', () => {
  const options = trattLevelOptions(
    [
      { name: 'Notes', type: 'SEGMENT' },
      { name: 'Transcription', type: 'SEGMENT' },
      { name: 'Phonetic', type: 'SEGMENT' },
    ],
    [{ superLevel: 'Word', subLevel: 'Phonetic' }],
  );

  it('prefers the remembered level, then Transcription, then the first usable one', () => {
    expect(preferredTrattLevel(options, 'Notes')).toBe('Notes');
    expect(preferredTrattLevel(options, null)).toBe('Transcription');
    expect(preferredTrattLevel(options, 'Phonetic')).toBe('Transcription'); // remembered but linked now
    expect(preferredTrattLevel(options.filter(o => o.name !== 'Transcription'), null)).toBe('Notes');
  });

  it('is null when nothing is usable', () => {
    expect(preferredTrattLevel(options.filter(o => !o.usable), 'Phonetic')).toBeNull();
  });
});
