/**
 * Field Mastery study material (Phase C) — the file side.
 *
 * The player's files never leave the device as files: text is extracted here (PDF page by page,
 * or pasted text split into numbered sections) and stored in IndexedDB on this device only.
 * Only short excerpts (the pages being quizzed) are ever sent to THEIA. Progress — bookmark,
 * pace, sections, mastery — is small and synced separately (study-progress.ts), so another
 * device keeps the progress and only needs the file re-attached to continue.
 */

const DB_NAME = 'wrp-study';
const STORE = 'materials';
export const MAX_MATERIALS = 3;
export const MAX_PAGES = 600;
const MAX_CHARS_PER_PAGE = 6000;
/** Pasted text is split into "pages" of about this size so the bookmark still works. */
const PASTE_PAGE_CHARS = 1800;

export interface MaterialText {
  id: string;
  name: string;
  kind: 'pdf' | 'text';
  pages: string[];
  createdAt: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('This browser has no local file storage.'));
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE, { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Local file storage unavailable.'));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const req = run(t.objectStore(STORE));
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

export const getMaterialText = (id: string) => tx<MaterialText | undefined>('readonly', (s) => s.get(id));
export const saveMaterialText = (m: MaterialText) => tx<IDBValidKey>('readwrite', (s) => s.put(m));
export const deleteMaterialText = (id: string) => tx<undefined>('readwrite', (s) => s.delete(id));

const cleanPage = (t: string) =>
  t
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, MAX_CHARS_PER_PAGE);

/** Same file on another device → same id, so synced progress re-attaches to it. */
export function fingerprint(name: string, pages: string[]): string {
  const sample = `${name}|${pages.length}|${pages.slice(0, 3).join('').slice(0, 3000)}`;
  let h = 2166136261;
  for (let i = 0; i < sample.length; i++) {
    h ^= sample.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `m-${(h >>> 0).toString(36)}-${pages.length}`;
}

/** PDF → text per page, on the device. pdf.js is loaded only when a PDF is attached. */
export async function extractPdfPages(file: File, onProgress?: (done: number, total: number) => void): Promise<string[]> {
  const pdfjs: any = await import('pdfjs-dist/legacy/build/pdf');
  const { default: workerUrl } = await import('pdfjs-dist/legacy/build/pdf.worker.min.js?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data, isEvalSupported: false }).promise;
  try {
    if (doc.numPages > MAX_PAGES) throw new Error(`This PDF has ${doc.numPages} pages; the limit is ${MAX_PAGES}. Split it into parts.`);
    const pages: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      let text = '';
      for (const item of content.items as any[]) {
        if (typeof item.str !== 'string') continue;
        text += item.str + (item.hasEOL ? '\n' : ' ');
      }
      pages.push(cleanPage(text));
      page.cleanup?.();
      onProgress?.(i, doc.numPages);
    }
    const withText = pages.filter((p) => p.length > 40).length;
    if (withText < Math.max(1, Math.ceil(pages.length * 0.3))) {
      throw new Error('This PDF has almost no selectable text (it is probably scanned images). Paste the text instead.');
    }
    return pages;
  } finally {
    doc.destroy?.();
  }
}

/** Pasted text → numbered sections of about PASTE_PAGE_CHARS, split on paragraph breaks. */
export function splitPastedText(raw: string): string[] {
  const paragraphs = String(raw || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
  const pages: string[] = [];
  let current = '';
  for (const p of paragraphs) {
    if (current && current.length + p.length > PASTE_PAGE_CHARS) {
      pages.push(cleanPage(current));
      current = '';
    }
    // A single huge paragraph is cut on sentence boundaries.
    if (p.length > PASTE_PAGE_CHARS) {
      const sentences = p.match(/[^.!?]+[.!?]*\s*/g) || [p];
      for (const s of sentences) {
        if (current.length + s.length > PASTE_PAGE_CHARS && current) {
          pages.push(cleanPage(current));
          current = '';
        }
        current += s;
      }
    } else {
      current += (current ? '\n\n' : '') + p;
    }
  }
  if (current.trim()) pages.push(cleanPage(current));
  return pages.slice(0, MAX_PAGES);
}

/** Text of pages [from, to] (1-based, inclusive), with page markers, capped. */
export function excerpt(pages: string[], from: number, to: number, maxChars: number): string {
  const out: string[] = [];
  let total = 0;
  for (let p = Math.max(1, from); p <= Math.min(pages.length, to); p++) {
    const chunk = `[Page ${p}]\n${pages[p - 1] || ''}`;
    if (total + chunk.length > maxChars) {
      out.push(chunk.slice(0, Math.max(0, maxChars - total)));
      break;
    }
    out.push(chunk);
    total += chunk.length;
  }
  return out.join('\n\n');
}
