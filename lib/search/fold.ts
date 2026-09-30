/**
 * Case- and accent-insensitive folding for search. Folding happens per character and keeps an
 * index map, so a hit in the folded text can be pointed back at the original string even where
 * folding changes the length ("ß" becomes "ss").
 */

function foldChar(char: string): string {
  if (char === 'ß') return 'ss';
  return char.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

export function fold(value: string): string {
  let out = '';
  for (const char of value) out += foldChar(char);
  return out;
}

export interface FoldedText {
  folded: string;
  /** For every character of `folded`, its index in the original string. */
  map: number[];
}

export function foldWithMap(value: string): FoldedText {
  let folded = '';
  const map: number[] = [];
  let index = 0;
  for (const char of value) {
    for (const piece of foldChar(char)) {
      folded += piece;
      map.push(index);
    }
    index += char.length;
  }
  return { folded, map };
}
