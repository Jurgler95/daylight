import { pickBackupFolder } from '../autoFolder';
import {
  exportErrorMessage,
  FolderPickerError,
  FolderWriteError,
  pickDirectory,
  saveBase64ToPickedDirectory,
  saveBinaryToPickedDirectory,
  saveToPickedDirectory,
  ShareUnavailableError,
} from '../files';

/** The picker outcome for the next call: a folder, a cancel (as expo-file-system rejects it) or a failure. */
const mockPick = jest.fn();
const mockWrites: string[] = [];
const mockCreateFile = jest.fn();
const mockDeleted: string[] = [];

jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: unknown[]) {
      this.uri = parts.map((part) => (typeof part === 'string' ? part : (part as { uri: string }).uri)).join('/');
    }
    get exists() {
      return false;
    }
    write() {}
    bytesSync() {
      return new Uint8Array([1, 2, 3]);
    }
    delete() {
      mockDeleted.push(this.uri);
    }
  }
  class Directory {
    uri: string;
    constructor(uri: string) {
      this.uri = uri;
    }
    static pickDirectoryAsync = () => mockPick();
    createFile(name: string, mimeType: string) {
      return mockCreateFile(name, mimeType);
    }
  }
  return { File, Directory, Paths: { cache: { uri: 'file:///cache' } } };
});
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-document-picker', () => ({}));

const FOLDER = 'content://com.android.externalstorage.documents/tree/primary%3ADownload';
const folder = () => {
  const { Directory } = jest.requireMock('expo-file-system');
  return new Directory(FOLDER);
};
const cancelled = () => Object.assign(new Error('The file picker was cancelled by the user'), { code: 'ERR_PICKER_CANCELLED' });
const unregistered = () =>
  Object.assign(new Error('Attempting to launch an unregistered ActivityResultLauncher'), { code: 'ERR_UNEXPECTED' });

beforeEach(() => {
  mockPick.mockReset();
  mockCreateFile.mockReset();
  mockCreateFile.mockImplementation((name: string) => ({ write: () => mockWrites.push(name) }));
  mockWrites.length = 0;
  mockDeleted.length = 0;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('pickDirectory', () => {
  it('returns the picked folder', async () => {
    mockPick.mockResolvedValue(folder());
    expect((await pickDirectory())?.uri).toBe(FOLDER);
  });

  it('returns null when the user cancels', async () => {
    mockPick.mockRejectedValue(cancelled());
    await expect(pickDirectory()).resolves.toBeNull();
  });

  it('returns null for the cancel of a release build, whose code R8 has shortened', async () => {
    mockPick.mockRejectedValue(
      Object.assign(
        new Error("Call to function 'FileSystem.pickDirectoryAsync' has been rejected.\n→ Caused by: The file picker was cancelled by the user"),
        { code: 'ERR_Z' },
      ),
    );
    await expect(pickDirectory()).resolves.toBeNull();
  });

  it('throws FolderPickerError when the picker fails to open', async () => {
    mockPick.mockRejectedValue(unregistered());
    await expect(pickDirectory()).rejects.toBeInstanceOf(FolderPickerError);
  });

  it('treats a rejection without the cancel code as a failure', async () => {
    mockPick.mockRejectedValue(new Error('cancelled'));
    await expect(pickDirectory()).rejects.toBeInstanceOf(FolderPickerError);
  });
});

describe('saving into a picked folder', () => {
  const savers = [
    ['text', () => saveToPickedDirectory('daylight-export.json', 'application/json', '{}')],
    ['base64', () => saveBase64ToPickedDirectory('daylight-bericht.pdf', 'application/pdf', 'JVBERi0x')],
    ['binary', () => saveBinaryToPickedDirectory('daylight-backup.zip', 'application/zip', (write) => write(new Uint8Array([1])))],
  ] as const;

  it.each(savers)('%s: writes the file and returns true', async (_, save) => {
    mockPick.mockResolvedValue(folder());
    await expect(save()).resolves.toBe(true);
    expect(mockWrites).toHaveLength(1);
  });

  it.each(savers)('%s: returns false and writes nothing on cancel', async (_, save) => {
    mockPick.mockRejectedValue(cancelled());
    await expect(save()).resolves.toBe(false);
    expect(mockWrites).toHaveLength(0);
  });

  it.each(savers)('%s: throws FolderPickerError when the picker fails', async (_, save) => {
    mockPick.mockRejectedValue(unregistered());
    await expect(save()).rejects.toBeInstanceOf(FolderPickerError);
    expect(mockWrites).toHaveLength(0);
  });

  it.each(savers)('%s: throws FolderWriteError when the folder refuses the file', async (_, save) => {
    mockPick.mockResolvedValue(folder());
    mockCreateFile.mockImplementation(() => {
      throw new Error('Permission denied');
    });
    await expect(save()).rejects.toBeInstanceOf(FolderWriteError);
  });

  it('binary: removes the cache copy even when writing fails', async () => {
    mockPick.mockResolvedValue(folder());
    mockCreateFile.mockImplementation(() => {
      throw new Error('Permission denied');
    });
    await expect(savers[2][1]()).rejects.toBeInstanceOf(FolderWriteError);
    expect(mockDeleted).toEqual(['file:///cache/daylight-backup.zip']);
  });
});

describe('pickBackupFolder', () => {
  it('returns the URI, null on cancel, and throws on failure', async () => {
    mockPick.mockResolvedValueOnce(folder()).mockRejectedValueOnce(cancelled()).mockRejectedValueOnce(unregistered());
    await expect(pickBackupFolder()).resolves.toBe(FOLDER);
    await expect(pickBackupFolder()).resolves.toBeNull();
    await expect(pickBackupFolder()).rejects.toBeInstanceOf(FolderPickerError);
  });
});

describe('exportErrorMessage', () => {
  const t = (key: string) => `t:${key}`;

  it('translates the known causes', () => {
    expect(exportErrorMessage(new FolderPickerError(unregistered()), t)).toBe('t:common.folderPickerFailed');
    expect(exportErrorMessage(new FolderWriteError(new Error('x')), t)).toBe('t:common.folderWriteFailed');
    expect(exportErrorMessage(new ShareUnavailableError(), t)).toBe('t:common.shareUnavailable');
  });

  it('falls back to the message', () => {
    expect(exportErrorMessage(new Error('disk full'), t)).toBe('disk full');
    expect(exportErrorMessage('odd', t)).toBe('odd');
  });
});
