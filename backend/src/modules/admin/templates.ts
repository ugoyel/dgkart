import ExcelJS from 'exceljs';

/** Builds the downloadable Excel templates the admin fills in. */
export async function productsTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('products');
  ws.columns = [
    { header: 'sku', key: 'sku', width: 16 },
    { header: 'title', key: 'title', width: 40 },
    { header: 'price', key: 'price', width: 10 },
    { header: 'mrp', key: 'mrp', width: 10 },
    { header: 'stock', key: 'stock', width: 8 },
    { header: 'brand', key: 'brand', width: 14 },
    { header: 'category', key: 'category', width: 18 },
    { header: 'condition', key: 'condition', width: 12 },
    { header: 'free_shipping', key: 'free_shipping', width: 13 },
    { header: 'description', key: 'description', width: 40 },
    { header: 'specs', key: 'specs', width: 30 },
    { header: 'images', key: 'images', width: 40 },
  ];
  ws.addRows([
    { sku: 'DK-TSHIRT-001', title: 'DKKart Cotton Polo T-Shirt (Navy)', price: 499, mrp: 999, stock: 120, brand: 'DKKart', category: "Men's Clothing", condition: 'New', free_shipping: 'yes', description: '100% cotton polo, regular fit.', specs: 'Colour=Navy; Size=M; Fabric=Cotton', images: 'dk-tshirt-001_1.jpg, dk-tshirt-001_2.jpg' },
    { sku: 'DK-EARBUD-002', title: 'Wireless Earbuds with ANC', price: 1999, mrp: 3999, stock: 40, brand: 'Bassik', category: 'Headphones & Audio', condition: 'New', free_shipping: 'yes', description: '30 hour battery, ENC mic.', specs: 'Colour=Black; Bluetooth=5.3', images: '' },
  ]);
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export async function mappingTemplate(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('image_mapping');
  ws.columns = [
    { header: 'image_file_name', key: 'f', width: 28 },
    { header: 'sku', key: 's', width: 18 },
    { header: 'position', key: 'p', width: 10 },
  ];
  ws.addRows([
    { f: 'dk-tshirt-001_1.jpg', s: 'DK-TSHIRT-001', p: 0 },
    { f: 'dk-tshirt-001_2.jpg', s: 'DK-TSHIRT-001', p: 1 },
    { f: 'earbuds-front.png', s: 'DK-EARBUD-002', p: 0 },
  ]);
  ws.getRow(1).font = { bold: true };
  return Buffer.from(await wb.xlsx.writeBuffer());
}
