import test from 'tape';
import { closeTestFyo, getTestFyo, setupTestFyo } from 'tests/helpers';
import { SalesInvoice } from 'models/baseModels/SalesInvoice/SalesInvoice';
import { ModelNameEnum } from 'models/types';
import { isPOSTaxInclusive, getItemDisplayAmount } from 'models/helpers';
import { SalesInvoiceItem } from 'models/baseModels/SalesInvoiceItem/SalesInvoiceItem';
import { POSProfile } from 'models/baseModels/POSProfile/PosProfile';

const fyo = getTestFyo();

setupTestFyo(fyo, __filename);

const customer = { name: 'TaxCustomer', role: 'Both' };

test('insert test items and customer for tax inclusive tests', async (t) => {
  await fyo.doc
    .getNewDoc(ModelNameEnum.Item, {
      name: 'Item Inclusive 18%',
      rate: 100,
      tax: 'IGST-18',
      incomeAccount: 'Sales',
    })
    .sync();

  await fyo.doc
    .getNewDoc(ModelNameEnum.Item, {
      name: 'Item Split 18%',
      rate: 100,
      tax: 'GST-18',
      incomeAccount: 'Sales',
    })
    .sync();

  await fyo.doc.getNewDoc(ModelNameEnum.Party, customer).sync();

  t.pass('test items and customer inserted');
});

test('verify isPOSTaxInclusive settings resolution', async (t) => {
  // Global setting false
  await fyo.singles.POSSettings?.set('taxInclusive', false);
  t.equals(isPOSTaxInclusive(fyo), false, 'POSSettings false returns false');

  // Global setting true
  await fyo.singles.POSSettings?.set('taxInclusive', true);
  t.equals(isPOSTaxInclusive(fyo), true, 'POSSettings true returns true');

  // Profile override false when global is true
  const profileFalse = fyo.doc.getNewDoc(ModelNameEnum.POSProfile, {
    name: 'Profile False',
    taxInclusive: false,
  }) as POSProfile;
  t.equals(
    isPOSTaxInclusive(fyo, profileFalse),
    false,
    'profile overrides global true'
  );

  // Profile override true when global is false
  await fyo.singles.POSSettings?.set('taxInclusive', false);
  const profileTrue = fyo.doc.getNewDoc(ModelNameEnum.POSProfile, {
    name: 'Profile True',
    taxInclusive: true,
  }) as POSProfile;
  t.equals(
    isPOSTaxInclusive(fyo, profileTrue),
    true,
    'profile overrides global false'
  );
});

test('tax exclusive calculation (standard POS behavior when taxInclusive is false)', async (t) => {
  const sinv = fyo.doc.getNewDoc(ModelNameEnum.SalesInvoice, {
    isPOS: true,
    taxInclusive: false,
    date: new Date('2026-01-01'),
    account: 'Debtors',
    party: customer.name,
  }) as SalesInvoice;

  await sinv.append('items', {
    item: 'Item Inclusive 18%',
    rate: 100,
    tax: 'IGST-18',
    quantity: 1,
    account: 'Sales',
  });

  await sinv.runFormulas();

  t.equals(sinv.items?.[0].amount?.round(2), '100.00', 'item amount is 100.00');
  t.equals(sinv.netTotal?.round(2), '100.00', 'net total is 100.00');
  t.equals(sinv.taxes?.[0].amount?.round(2), '18.00', 'tax is 18.00');
  t.equals(sinv.grandTotal?.round(2), '118.00', 'grand total is 118.00');

  // Submit and verify ledger posting succeeds
  await (await sinv.sync()).submit();
  t.true(sinv.submitted, 'exclusive invoice submitted successfully');
});

test('tax inclusive calculation (Rate 100 includes 18% tax -> Total 100.00)', async (t) => {
  const sinv = fyo.doc.getNewDoc(ModelNameEnum.SalesInvoice, {
    isPOS: true,
    taxInclusive: true,
    date: new Date('2026-01-01'),
    account: 'Debtors',
    party: customer.name,
  }) as SalesInvoice;

  await sinv.append('items', {
    item: 'Item Inclusive 18%',
    rate: 100,
    tax: 'IGST-18',
    quantity: 1,
    account: 'Sales',
  });

  await sinv.runFormulas();

  // Net amount should be 100 / 1.18 = 84.75
  t.equals(sinv.items?.[0].amount?.round(2), '84.75', 'net item amount is 84.75');
  t.equals(sinv.netTotal?.round(2), '84.75', 'net total is 84.75');
  // Tax should be 15.25
  t.equals(sinv.taxes?.[0].amount?.round(2), '15.25', 'tax amount is 15.25');
  // Grand total should be exactly 100.00
  t.equals(sinv.grandTotal?.round(2), '100.00', 'grand total is 100.00');

  // Cart row display helper should show 100.00 to the cashier
  const displayAmt = getItemDisplayAmount(
    sinv.items?.[0] as SalesInvoiceItem,
    true,
    fyo
  );
  t.equals(displayAmt.round(2), '100.00', 'display amount in cart row is 100.00');

  // Submit and verify ledger postings balance (Debtors 100 = Sales 84.75 + Tax 15.25)
  await (await sinv.sync()).submit();
  t.true(sinv.submitted, 'invoice submitted successfully with balanced ledger');
});

test('tax inclusive with multi-tax split (CGST 9% + SGST 9%)', async (t) => {
  const sinv = fyo.doc.getNewDoc(ModelNameEnum.SalesInvoice, {
    isPOS: true,
    taxInclusive: true,
    date: new Date('2026-01-01'),
    account: 'Debtors',
    party: customer.name,
  }) as SalesInvoice;

  await sinv.append('items', {
    item: 'Item Split 18%',
    rate: 100,
    tax: 'GST-18',
    quantity: 1,
    account: 'Sales',
  });

  await sinv.runFormulas();

  t.equals(sinv.netTotal?.round(2), '84.75', 'net total is 84.75');
  t.equals(sinv.grandTotal?.round(2), '100.00', 'grand total is 100.00');

  // Both taxes should sum to 15.25
  const totalTaxes = sinv.taxes?.reduce(
    (sum, tx) => sum.add(tx.amount as any),
    fyo.pesa(0)
  );
  t.equals(totalTaxes?.round(2), '15.25', 'total split taxes sum to 15.25');

  await (await sinv.sync()).submit();
  t.true(sinv.submitted, 'split tax invoice submitted with balanced ledger');
});

test('tax inclusive with discount (10% discount on 100 -> Total 90.00)', async (t) => {
  await fyo.singles.AccountingSettings?.setMultiple({
    enableDiscounting: true,
    discountAccount: 'Sales Expenses',
  });

  const sinv = fyo.doc.getNewDoc(ModelNameEnum.SalesInvoice, {
    isPOS: true,
    taxInclusive: true,
    date: new Date('2026-01-01'),
    account: 'Debtors',
    party: customer.name,
  }) as SalesInvoice;

  await sinv.append('items', {
    item: 'Item Inclusive 18%',
    rate: 100,
    tax: 'IGST-18',
    quantity: 1,
    account: 'Sales',
    itemDiscountPercent: 10,
  });

  await sinv.runFormulas();

  // Grand total should be 90.00
  t.equals(sinv.grandTotal?.round(2), '90.00', 'grand total with 10% discount is 90.00');

  // Cart row display amount should show 90.00
  const displayAmt = getItemDisplayAmount(
    sinv.items?.[0] as SalesInvoiceItem,
    true,
    fyo
  );
  t.equals(displayAmt.round(2), '90.00', 'display amount with discount is 90.00');

  await (await sinv.sync()).submit();
  t.true(sinv.submitted, 'discounted invoice submitted with balanced ledger');
});

closeTestFyo(fyo, __filename);
