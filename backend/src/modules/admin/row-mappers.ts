import { ProductCondition } from '../catalog/product.entity';
import { SheetRow, pick } from './sheet-reader';

export interface ProductRow {
  sku: string;
  title: string;
  description: string;
  brand: string | null;
  category: string | null;
  price: number;
  mrp: number | null;
  stock: number;
  condition: ProductCondition;
  freeShipping: boolean;
  specs: Record<string, string>;
  /** http(s) URLs to attach directly, and file names to register in the image mapping. */
  imageUrls: string[];
  imageFiles: string[];
}

export interface MappingRow {
  fileName: string;
  sku: string;
  position: number | null;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const num = (s: string): number => Number(s.replace(/[₹,\s]/g, ''));

export const normalizeFileName = (f: string) => f.trim().toLowerCase().split(/[\\/]/).pop()!;

export const normalizeSku = (s: string) => s.trim().toUpperCase();

const CONDITIONS: Record<string, ProductCondition> = {
  new: ProductCondition.NEW,
  'brand new': ProductCondition.NEW,
  open_box: ProductCondition.OPEN_BOX,
  'open box': ProductCondition.OPEN_BOX,
  refurbished: ProductCondition.REFURBISHED,
  used: ProductCondition.USED,
  'pre-owned': ProductCondition.USED,
};

/**
 * Products sheet columns (case-insensitive; aliases in brackets):
 * sku [product_id, product_code, id] *, title [name, product_name] *, price [selling_price, sale_price] *,
 * mrp [list_price, original_price], stock [qty, quantity, inventory], brand, category, description,
 * condition (New / Open box / Refurbished / Used), free_shipping (yes/no),
 * images (comma or | separated URLs or file names), specs ("Color=Red; Size=M"), and any "spec_<name>" column.
 */
export function toProductRow(r: SheetRow): Parsed<ProductRow> {
  const sku = normalizeSku(pick(r, 'sku', 'product_id', 'product_code', 'id'));
  const title = pick(r, 'title', 'name', 'product_name', 'product_title');
  const priceRaw = pick(r, 'price', 'selling_price', 'sale_price');
  if (!sku) return { ok: false, error: 'sku is required' };
  if (sku.length > 80) return { ok: false, error: 'sku is longer than 80 characters' };
  if (!title) return { ok: false, error: 'title is required' };
  const price = num(priceRaw);
  if (!priceRaw || !Number.isFinite(price) || price < 0) return { ok: false, error: `price "${priceRaw}" is not a valid number` };
  const mrpRaw = pick(r, 'mrp', 'list_price', 'original_price');
  const mrp = mrpRaw ? num(mrpRaw) : null;
  if (mrp !== null && !Number.isFinite(mrp)) return { ok: false, error: `mrp "${mrpRaw}" is not a valid number` };
  const stockRaw = pick(r, 'stock', 'qty', 'quantity', 'inventory');
  const stock = stockRaw ? Math.max(0, Math.floor(num(stockRaw))) : 0;
  if (!Number.isFinite(stock)) return { ok: false, error: `stock "${stockRaw}" is not a valid number` };

  const condRaw = pick(r, 'condition').toLowerCase().replace(/_/g, ' ');
  const condition = condRaw ? CONDITIONS[condRaw] ?? CONDITIONS[condRaw.replace(/ /g, '_')] : ProductCondition.NEW;
  if (!condition) return { ok: false, error: `condition "${condRaw}" must be New, Open box, Refurbished or Used` };

  const specs: Record<string, string> = {};
  for (const part of pick(r, 'specs', 'specifications', 'item_specifics').split(/[;\n]/)) {
    const [k, ...v] = part.split('=');
    if (k?.trim() && v.length) specs[k.trim()] = v.join('=').trim();
  }
  for (const [k, v] of Object.entries(r)) {
    if (k.startsWith('spec_') && v) specs[titleCase(k.slice(5))] = v;
  }

  const imageUrls: string[] = [];
  const imageFiles: string[] = [];
  for (const raw of pick(r, 'images', 'image_urls', 'image', 'image_files').split(/[|,\n]/)) {
    const v = raw.trim();
    if (!v) continue;
    if (/^https?:\/\//i.test(v)) imageUrls.push(v);
    else imageFiles.push(normalizeFileName(v));
  }

  const fs = pick(r, 'free_shipping', 'free_delivery').toLowerCase();
  return {
    ok: true,
    value: {
      sku,
      title: title.slice(0, 300),
      description: pick(r, 'description', 'details'),
      brand: pick(r, 'brand') || null,
      category: pick(r, 'category', 'category_name') || null,
      price,
      mrp,
      stock,
      condition,
      freeShipping: fs === '' ? true : ['yes', 'y', 'true', '1'].includes(fs),
      specs,
      imageUrls,
      imageFiles,
    },
  };
}

/** Mapping sheet columns: image_file_name [file_name, filename, image, image_name] *, sku [product_id] *, position (optional). */
export function toMappingRow(r: SheetRow): Parsed<MappingRow> {
  const fileName = normalizeFileName(pick(r, 'image_file_name', 'file_name', 'filename', 'image', 'image_name', 'file'));
  const sku = normalizeSku(pick(r, 'sku', 'product_id', 'product_code'));
  if (!fileName) return { ok: false, error: 'image file name is required' };
  if (!sku) return { ok: false, error: 'sku is required' };
  const posRaw = pick(r, 'position', 'order', 'sequence', 'sort');
  const position = posRaw ? parseInt(posRaw, 10) : null;
  if (posRaw && !Number.isFinite(position)) return { ok: false, error: `position "${posRaw}" is not a number` };
  return { ok: true, value: { fileName, sku, position } };
}

/**
 * Fallback when an uploaded file has no row in the mapping sheet:
 * "ABC123.jpg" → ABC123 position 0, "ABC123_2.jpg" / "ABC123-2.jpg" → ABC123 position 2.
 */
export function guessFromFileName(fileName: string): { sku: string; position: number }[] {
  const stem = normalizeFileName(fileName).replace(/\.[a-z0-9]+$/, '');
  const guesses = [{ sku: normalizeSku(stem), position: 0 }];
  const m = stem.match(/^(.+?)[_\- ](\d{1,3})$/);
  if (m) guesses.push({ sku: normalizeSku(m[1]), position: parseInt(m[2], 10) });
  return guesses;
}

const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

export const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
