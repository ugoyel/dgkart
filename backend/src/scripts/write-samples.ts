/** Writes the Excel templates to docs/samples so they can be opened without running the API. */
import { writeFileSync } from 'fs';
import { mappingTemplate, productsTemplate } from '../modules/admin/templates';

(async () => {
  writeFileSync('../docs/samples/products-template.xlsx', await productsTemplate());
  writeFileSync('../docs/samples/image-mapping-template.xlsx', await mappingTemplate());
  console.log('wrote docs/samples');
})();
