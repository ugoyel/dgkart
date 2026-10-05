import { ProductCondition } from '../catalog/product.entity';
import { guessFromFileName, toMappingRow, toProductRow } from './row-mappers';
import { parseCsv } from './sheet-reader';

describe('toProductRow', () => {
  it('maps aliases, prices with symbols, specs and images', () => {
    const r = toProductRow({
      product_code: ' dk-1 ', name: 'Polo', selling_price: '₹1,299', list_price: '1999', qty: '5',
      condition: 'Open box', specs: 'Colour=Red; Size=M', spec_fabric: 'Cotton',
      images: 'https://x.test/a.jpg | front.JPG, back.png', free_shipping: 'no',
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({
      sku: 'DK-1', title: 'Polo', price: 1299, mrp: 1999, stock: 5, condition: ProductCondition.OPEN_BOX,
      freeShipping: false, specs: { Colour: 'Red', Size: 'M', Fabric: 'Cotton' },
      imageUrls: ['https://x.test/a.jpg'], imageFiles: ['front.jpg', 'back.png'],
    });
  });

  it('rejects rows with missing sku or bad price', () => {
    expect(toProductRow({ title: 'x', price: '1' })).toEqual({ ok: false, error: 'sku is required' });
    expect(toProductRow({ sku: 'a', title: 'x', price: 'abc' }).ok).toBe(false);
    expect(toProductRow({ sku: 'a', title: 'x', price: '1', condition: 'broken' }).ok).toBe(false);
  });
});

describe('image mapping', () => {
  it('normalises file names and sku', () => {
    expect(toMappingRow({ filename: 'C:\\pics\\Shoe_1.JPG', product_id: 'ab-1', position: '2' }))
      .toEqual({ ok: true, value: { fileName: 'shoe_1.jpg', sku: 'AB-1', position: 2 } });
  });

  it('guesses sku and position from the file name', () => {
    expect(guessFromFileName('AB-12_3.jpg')).toEqual([{ sku: 'AB-12_3', position: 0 }, { sku: 'AB-12', position: 3 }]);
  });
});

describe('parseCsv', () => {
  it('handles quotes, commas and CRLF', () => {
    expect(parseCsv('a,b\r\n"x, y","he said ""hi"""\r\n')).toEqual([['a', 'b'], ['x, y', 'he said "hi"']]);
  });
});
