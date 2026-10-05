# Bulk product and image upload

All of this is in the app: **Admin → Catalogue upload** (sign in as the admin number). Templates: [`samples/products-template.xlsx`](samples/products-template.xlsx) and [`samples/image-mapping-template.xlsx`](samples/image-mapping-template.xlsx), also downloadable from the admin screen.

## Step 1: products sheet (.xlsx or .csv)

One product per row; the first row is the header. Column names are case-insensitive and common alternatives are accepted (shown in brackets).

| Column | Required | Notes |
| --- | --- | --- |
| `sku` [product_id, product_code, id] | ✔ | Your unique code. Re-importing the same SKU **updates** that product. |
| `title` [name, product_name] | ✔ | |
| `price` [selling_price, sale_price] | ✔ | ₹ and commas are fine: `₹1,299` |
| `mrp` [list_price, original_price] | | Shows "Was ₹… / % off" |
| `stock` [qty, quantity, inventory] | | Defaults to 0 (shown as out of stock) |
| `brand`, `category` | | New categories are created automatically |
| `condition` | | New, Open box, Refurbished, Used (default New) |
| `free_shipping` | | yes/no (default yes) |
| `description` | | |
| `specs` | | `Colour=Red; Size=M; Material=Cotton` |
| `spec_<name>` | | Any number of extra columns, e.g. `spec_warranty` |
| `images` | | Comma or `|` separated. **URLs** are attached directly; **file names** are registered in the image mapping for step 3. |

Rows with problems (missing SKU, bad price…) are skipped and listed with their row number; the rest import. Large files are processed in the background in batches of 500 with a progress bar.

## Step 2: image mapping sheet

Tells which image file belongs to which product.

| image_file_name | sku | position |
| --- | --- | --- |
| dg-tshirt-001_1.jpg | DG-TSHIRT-001 | 0 |
| dg-tshirt-001_2.jpg | DG-TSHIRT-001 | 1 |
| earbuds-front.png | DG-EARBUD-002 | 0 |

`position` 0 is the main image; leave it blank to use the order of the rows. File names are matched case-insensitively. Skip this sheet if your product sheet's `images` column already lists the file names.

## Step 3: upload images

**Admin → Upload product images → Select images.** Pick hundreds at once (jpg, png, webp, gif, max 10 MB each). They upload 10 per request with progress, and the result lists any file that didn't match.

Matching order for each file:
1. the mapping sheet;
2. otherwise the file name itself: `SKU.jpg` (main image) or `SKU_2.jpg` / `SKU-2.jpg` (position 2).

Uploading a file with the same name again replaces the earlier image.

## Removing data

* **Remove all demo products:** deletes seeded sample items only.
* **Delete entire catalogue:** deletes every product (type DELETE to confirm). Orders keep their own copy of item details.
