import test from 'tape';
import { getTestFyo, setupTestFyo, closeTestFyo } from 'tests/helpers';
import { ModelNameEnum } from 'models/types';
import { encodeCode128B, generateBarcode128SVG } from 'src/utils/barcode128';
import { generateNextBarcode } from '../helpers';
import { InventorySettings } from '../InventorySettings';
import { Item } from 'models/baseModels/Item/Item';

const fyo = getTestFyo();
setupTestFyo(fyo, __filename);

test('Code-128: Checksum and Encoding', (t) => {
  // Test encoding of "BC-1001"
  const codes = encodeCode128B('BC-1001');
  t.equal(codes[0], 104, 'Start B code is 104');
  t.equal(codes[codes.length - 1], 106, 'Stop code is 106');
  // Checksum was calculated as 95 for BC-1001
  t.equal(codes[codes.length - 2], 95, 'Checksum for BC-1001 is 95');

  // Test SVG generation
  const svg = generateBarcode128SVG('BC-1001', { height: 40 });
  t.ok(svg.includes('<svg'), 'SVG includes <svg tag');
  t.ok(svg.includes('viewBox="0 0'), 'SVG includes viewBox');
  t.ok(svg.includes('<rect'), 'SVG includes barcode bars');
  t.ok(svg.includes('BC-1001'), 'SVG includes human-readable text');

  t.end();
});

test('Barcode: Auto-generation from InventorySettings Series', async (t) => {
  const invSettings = (await fyo.doc.getDoc(
    ModelNameEnum.InventorySettings
  )) as InventorySettings;

  await invSettings.set('enableBarcodes', true);
  await invSettings.set('barcodeSeries', 'BC-1001');
  await invSettings.sync();

  const code1 = await generateNextBarcode(fyo);
  t.equal(code1, 'BC-1001', 'First generated barcode is BC-1001');

  const code2 = await generateNextBarcode(fyo);
  t.equal(code2, 'BC-1002', 'Second generated barcode is BC-1002');

  t.end();
});

test('Item: Auto-assigns Barcode on Create if blank', async (t) => {
  const invSettings = (await fyo.doc.getDoc(
    ModelNameEnum.InventorySettings
  )) as InventorySettings;

  await invSettings.set('enableBarcodes', true);
  await invSettings.set('barcodeSeries', 'ITEM-0100');
  await invSettings.sync();

  // Create Item without barcode
  const item1 = fyo.doc.getNewDoc(ModelNameEnum.Item, {
    name: 'Test Barcode Item 1',
    rate: 150,
  }) as Item;
  await item1.sync();

  t.ok(item1.barcode, 'Barcode was auto-assigned');
  t.equal(item1.barcode, 'ITEM-0100', 'Barcode matches start of series');

  // Create second Item without barcode
  const item2 = fyo.doc.getNewDoc(ModelNameEnum.Item, {
    name: 'Test Barcode Item 2',
    rate: 250,
  }) as Item;
  await item2.sync();

  t.equal(item2.barcode, 'ITEM-0101', 'Next barcode incremented to ITEM-0101');

  // Create Item WITH manual barcode
  const item3 = fyo.doc.getNewDoc(ModelNameEnum.Item, {
    name: 'Test Manual Barcode Item',
    barcode: 'CUSTOM-BARCODE-999',
    rate: 350,
  }) as Item;
  await item3.sync();

  t.equal(
    item3.barcode,
    'CUSTOM-BARCODE-999',
    'Manual barcode was preserved untouched'
  );

  // Test on-demand generateBarcode()
  const genCode = await item3.generateBarcode();
  t.equal(
    genCode,
    'ITEM-0102',
    'On demand generation returns next code ITEM-0102'
  );
  t.equal(item3.barcode, 'ITEM-0102', 'Item barcode property updated');

  t.end();
});

test('Item & PurchaseInvoice: Model Actions for Barcode Sticker Printing', async (t) => {
  const itemActions = Item.getActions(fyo);
  const printAction = itemActions.find(
    (a) => a.label === fyo.t`Print Barcode Sticker`
  );
  t.ok(printAction, 'Item has Print Barcode Sticker action');
  t.equal(printAction?.group, fyo.t`Print`, 'Print action is in Print group');

  const { PurchaseInvoice } = await import(
    'models/baseModels/PurchaseInvoice/PurchaseInvoice'
  );
  const pinvActions = PurchaseInvoice.getActions(fyo);
  const pinvPrintAction = pinvActions.find(
    (a) => a.label === fyo.t`Print Barcode Stickers`
  );
  t.ok(pinvPrintAction, 'PurchaseInvoice has Print Barcode Stickers action');
  t.equal(
    pinvPrintAction?.group,
    fyo.t`Print`,
    'PurchaseInvoice action is in Print group'
  );

  t.end();
});

closeTestFyo(fyo, __filename);
