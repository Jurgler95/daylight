import { deleteCachedCopies, discardFile } from '../files';

/** What the cache keeps after "Alle Daten löschen", and the printer's PDF once it is read. */
const mockDeleted: string[] = [];
const mockExisting = new Set<string>();
jest.mock('expo-file-system', () => {
  class Entry {
    uri: string;
    constructor(path: string) {
      this.uri = path;
    }
    get name() {
      return this.uri.split('/').pop()!;
    }
    get exists() {
      return mockExisting.has(this.uri);
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  }
  class File extends Entry {}
  class Directory extends Entry {}
  const item = (kind: typeof Entry, name: string) => new kind(`file:///cache/${name}`);
  return {
    File,
    Directory,
    Paths: {
      cache: {
        list: () => [
          item(File, 'daylight-bericht-2026-11-26.pdf'),
          item(File, 'daylight-export-2026-11-26.json'),
          item(File, 'other.txt'),
          item(Directory, 'Print'),
          item(Directory, 'DocumentPicker'),
          item(Directory, 'ImagePicker'),
          item(Directory, 'ImageManipulator'),
          item(Directory, 'http-cache'),
        ],
      },
    },
  };
});
jest.mock('expo-document-picker', () => ({}));
jest.mock('expo-sharing', () => ({}));

beforeEach(() => {
  mockDeleted.length = 0;
  mockExisting.clear();
});

describe('deleteCachedCopies', () => {
  it('clears our exports and every folder of copies, the printed PDFs among them', () => {
    deleteCachedCopies();
    expect(mockDeleted.map((uri) => uri.replace('file:///cache/', '')).sort()).toEqual([
      'DocumentPicker',
      'ImageManipulator',
      'ImagePicker',
      'Print',
      'daylight-bericht-2026-11-26.pdf',
      'daylight-export-2026-11-26.json',
    ]);
  });
});

describe('discardFile', () => {
  it('deletes a file that is there and ignores one that is not', () => {
    mockExisting.add('file:///cache/Print/a.pdf');
    discardFile('file:///cache/Print/a.pdf');
    discardFile('file:///cache/Print/gone.pdf');
    expect(mockDeleted).toEqual(['file:///cache/Print/a.pdf']);
  });
});
