import test from 'tape';
import { closeTestFyo, getTestFyo, setupTestFyo } from 'tests/helpers';
import { ModelNameEnum } from 'models/types';
import { SalesInvoice } from '../SalesInvoice/SalesInvoice';
import { Item } from '../Item/Item';
import {
  assertDoesNotThrow,
  assertThrows,
} from 'backend/database/tests/helpers';
import fs from 'fs/promises';
import path from 'path';

const fyo = getTestFyo();
setupTestFyo(fyo, __filename);

test('IMEI field defaults to empty and validates numbers without decimals', async (t) => {
  // 1. Default value of IMEI on new Item is null/empty, NOT 0
  const newItem = fyo.doc.getNewDoc(ModelNameEnum.Item, {
    name: 'Generic Phone',
    itemType: 'Product',
    rate: 1000,
    unit: 'Unit',
    for: 'Both',
  }) as Item;

  t.equal(
    newItem.imei,
    null,
    'New Item IMEI defaults to empty (null), not 0'
  );

  // 2. Valid numeric IMEI saves without error
  const phoneItem = fyo.doc.getNewDoc(ModelNameEnum.Item, {
    name: 'Mobile Phone Pro',
    itemType: 'Product',
    rate: 50000,
    unit: 'Unit',
    for: 'Both',
    imei: '356938035643801',
  }) as Item;

  await assertDoesNotThrow(async () => {
    await phoneItem.sync();
  }, 'Item with valid numeric IMEI syncs without error');

  t.equal(phoneItem.imei, '356938035643801', 'Item IMEI is saved as string');

  // 3. Reject decimal numbers in Item IMEI
  const invalidItemDoc = fyo.doc.getNewDoc(ModelNameEnum.Item, {
    name: 'Invalid Phone',
    itemType: 'Product',
    rate: 10000,
    unit: 'Unit',
    for: 'Both',
    imei: '356938035643.89',
  });
  await assertThrows(
    async () => {
      await invalidItemDoc.sync();
    },
    'Item rejects decimal numbers in IMEI'
  );

  // 4. Sales Invoice auto-fills IMEI from Item
  const sinv = fyo.doc.getNewDoc(ModelNameEnum.SalesInvoice) as SalesInvoice;
  await sinv.append('items', {
    item: phoneItem.name,
    quantity: 1,
  });

  const row = sinv.items![0];
  t.equal(
    row.imei,
    '356938035643801',
    'SalesInvoiceItem auto-fills IMEI from Item'
  );

  // 5. SalesInvoiceItem allows overriding IMEI
  await row.set('imei', '356938035643899');
  t.equal(
    row.imei,
    '356938035643899',
    'SalesInvoiceItem allows overriding IMEI'
  );

  // 6. SalesInvoiceItem rejects decimals
  await assertThrows(
    async () => {
      await row.setAndSync({ imei: '12345.67' });
    },
    'SalesInvoiceItem rejects decimal numbers in IMEI'
  );

  // 7. Verify templates
  const basicTemplate = await fs.readFile(
    path.join(__dirname, '../../../templates/Basic.template.html'),
    'utf-8'
  );
  const businessTemplate = await fs.readFile(
    path.join(__dirname, '../../../templates/Business.template.html'),
    'utf-8'
  );
  const minimalTemplate = await fs.readFile(
    path.join(__dirname, '../../../templates/Minimal.template.html'),
    'utf-8'
  );
  const posTemplate = await fs.readFile(
    path.join(__dirname, '../../../templates/Business-POS.template.html'),
    'utf-8'
  );

  t.ok(basicTemplate.includes('row.imei'), 'Basic template prints IMEI');
  t.ok(businessTemplate.includes('row.imei'), 'Business template prints IMEI');
  t.ok(minimalTemplate.includes('row.imei'), 'Minimal template prints IMEI');
  t.notOk(
    posTemplate.includes('row.imei'),
    'Business-POS template excludes IMEI'
  );
});

closeTestFyo(fyo, __filename);
