import test from 'tape';
import { closeTestFyo, getTestFyo, setupTestFyo } from 'tests/helpers';
import { SalesInvoice } from 'models/baseModels/SalesInvoice/SalesInvoice';
import { ModelNameEnum } from 'models/types';
import {
  isPOSTaxInclusive,
  getItemDisplayAmount,
  getIncomingRateWithTax,
} from 'models/helpers';
import { SalesInvoiceItem } from 'models/baseModels/SalesInvoiceItem/SalesInvoiceItem';
import { POSProfile } from 'models/baseModels/POSProfile/PosProfile';
import { getPrintTemplatePropValues } from 'src/utils/printTemplates';


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

  // Cart row display amount should show 100.00 (Rate × Qty)
  const displayAmtExclusive = getItemDisplayAmount(
    sinv.items?.[0] as SalesInvoiceItem,
    false,
    fyo
  );
  t.equals(
    displayAmtExclusive.round(2),
    '100.00',
    'display amount in cart row is 100.00 (Rate × Qty)'
  );

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

test('incoming rate includes tax from PurchaseInvoiceItem', async (t) => {
  const pinv = fyo.doc.getNewDoc(ModelNameEnum.PurchaseInvoice, {
    date: new Date('2026-01-01'),
    account: 'Creditors',
    party: 'TaxCustomer',
  });

  await pinv.append('items', {
    item: 'Item Inclusive 18%',
    rate: 50,
    quantity: 2,
    tax: 'IGST-18',
    account: 'Cost of Goods Sold',
  });

  await (await pinv.sync()).submit();

  const incomingRate = await getIncomingRateWithTax(fyo, 'Item Inclusive 18%');
  t.equals(incomingRate, 59, 'incoming rate is 50 + 18% tax = 59');
});

test('incoming rate includes tax from StockLedgerEntry fallback', async (t) => {
  await fyo.doc
    .getNewDoc(ModelNameEnum.Item, {
      name: 'Stock Item 18%',
      rate: 200,
      tax: 'IGST-18',
      incomeAccount: 'Sales',
    })
    .sync();

  await fyo.doc
    .getNewDoc(ModelNameEnum.StockLedgerEntry, {
      item: 'Stock Item 18%',
      rate: 80,
      quantity: 5,
      date: new Date('2026-01-02'),
      location: 'Stores',
    })
    .sync();

  const incomingRate = await getIncomingRateWithTax(fyo, 'Stock Item 18%');
  t.equals(incomingRate, 94.4, 'incoming rate from SLE is 80 + 18% tax = 94.4');
});

test('sales print values show exact amount logic from POS screen for tax inclusive invoices', async (t) => {
  const sinv = fyo.doc.getNewDoc(ModelNameEnum.SalesInvoice, {
    isPOS: true,
    taxInclusive: true,
    date: new Date('2026-01-01'),
    account: 'Debtors',
    party: customer.name,
  }) as SalesInvoice;

  await sinv.append('items', {
    item: 'Item Inclusive 18%',
    rate: 15000,
    tax: 'IGST-18',
    quantity: 1,
    account: 'Sales',
  });

  await sinv.runFormulas();

  // Internal doc amounts
  t.equals(sinv.items?.[0].amount?.round(2), '12711.86', 'internal item amount is 12711.86');
  t.equals(sinv.netTotal?.round(2), '12711.86', 'internal net total is 12711.86');
  t.equals(sinv.grandTotal?.round(2), '15000.00', 'internal grand total is 15000.00');

  // Print template values
  const printProps = await getPrintTemplatePropValues(sinv);
  const printDoc = printProps.doc as any;

  t.equals(printDoc.taxInclusive, true, 'print doc taxInclusive is true');
  t.equals(printDoc.items[0].rate, '₹ 15,000.00', 'print item rate is ₹ 15,000.00');
  t.equals(printDoc.items[0].amount, '₹ 15,000.00', 'print item amount matches POS screen (₹ 15,000.00)');
  t.equals(printDoc.posTotal, '₹ 15,000.00', 'print posTotal is ₹ 15,000.00');
  t.equals(printDoc.netTotal, '₹ 12,711.86', 'print netTotal is ₹ 12,711.86');
  t.equals(printDoc.grandTotal, '₹ 15,000.00', 'print grandTotal is ₹ 15,000.00');
});

test('sales print values for tax exclusive invoices retain standard amounts', async (t) => {
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

  const printProps = await getPrintTemplatePropValues(sinv);
  const printDoc = printProps.doc as any;

  t.equals(printDoc.taxInclusive, false, 'print doc taxInclusive is false');
  t.equals(printDoc.items[0].rate, '₹ 100.00', 'print item rate is ₹ 100.00');
  t.equals(printDoc.items[0].amount, '₹ 100.00', 'print item amount is ₹ 100.00');
  t.equals(printDoc.posTotal, '₹ 100.00', 'print posTotal is ₹ 100.00');
  t.equals(printDoc.netTotal, '₹ 100.00', 'print netTotal is ₹ 100.00');
  t.equals(printDoc.grandTotal, '₹ 118.00', 'print grandTotal is ₹ 118.00');
});

closeTestFyo(fyo, __filename);



