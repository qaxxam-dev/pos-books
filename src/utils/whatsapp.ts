import { createApp, h } from 'vue';
import { Fyo, t } from 'fyo';
import { Doc } from 'fyo/model/doc';
import { ModelNameEnum } from 'models/types';
import { showToast } from 'src/utils/interactive';
import {
  constructPrintDocument,
  getPrintTemplatePropValues,
} from 'src/utils/printTemplates';
import { PrintValues } from 'src/utils/types';
import WhatsAppPhoneModal from 'src/components/WhatsAppPhoneModal.vue';

export function cleanWhatsAppPhone(
  phone: string,
  defaultCountryCode = '91'
): string {
  if (!phone) return '';
  let cleaned = phone.replace(/[^0-9]/g, '');
  cleaned = cleaned.replace(/^0+/, '');

  if (cleaned.length === 10 && defaultCountryCode) {
    const code = defaultCountryCode.replace(/[^0-9]/g, '');
    cleaned = `${code}${cleaned}`;
  }

  return cleaned;
}

export function promptWhatsAppPhone(options: {
  title?: string;
  partyName?: string;
  initialPhone?: string;
  canSaveToParty?: boolean;
}): Promise<{ phone: string; saveToParty: boolean } | null> {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);

    const app = createApp({
      render() {
        return h(WhatsAppPhoneModal, {
          ...options,
          onSubmit: (result: { phone: string; saveToParty: boolean }) => {
            app.unmount();
            container.remove();
            resolve(result);
          },
          onCancel: () => {
            app.unmount();
            container.remove();
            resolve(null);
          },
        });
      },
    });

    app.mount(container);
  });
}

function hasValue(val: unknown): boolean {
  if (!val) return false;
  if (typeof val === 'object' && val !== null && 'isZero' in val) {
    const fn = (val as { isZero?: () => boolean }).isZero;
    if (typeof fn === 'function') {
      return !fn.call(val);
    }
  }
  return true;
}

export function formatWhatsAppText(doc: Doc, fyo: Fyo): string {
  const companyName =
    (fyo.singles.PrintSettings?.companyName as string) ||
    (fyo.singles.AccountingSettings?.companyName as string) ||
    '';

  const docTypeLabel =
    doc.schemaName === ModelNameEnum.SalesInvoice
      ? t`Tax Invoice`
      : doc.schemaName === ModelNameEnum.PurchaseInvoice
      ? t`Purchase Bill`
      : doc.schemaName === ModelNameEnum.SalesQuote
      ? t`Quotation`
      : String(doc.schemaName ?? '');

  const lines: string[] = [];

  // Header (no emojis to prevent unsupported character encoding in WhatsApp)
  if (companyName) {
    lines.push(`*${companyName}*`);
  }
  lines.push(`*${docTypeLabel}: ${String(doc.name ?? '')}*`);

  if (doc.date) {
    lines.push(`${t`Date`}: ${String(fyo.format(doc.date, 'Date') ?? '')}`);
  }

  if (doc.party) {
    lines.push(`${t`Customer`}: ${String(doc.party)}`);
  }

  lines.push('');
  lines.push(`*${t`Items`}:*`);

  const items = (doc.items as Doc[]) || [];
  for (const item of items) {
    const name = (item.itemName as string) || (item.item as string) || t`Item`;
    const qty = String(item.quantity ?? item.qty ?? 1);
    const uom = item.uom ? ` ${String(item.uom)}` : '';
    const rate = String(
      fyo.format(item.rate, ModelNameEnum.Currency) ?? item.rate
    );
    const amount = String(
      fyo.format(item.amount, ModelNameEnum.Currency) ?? item.amount
    );

    lines.push(`- *${name}*`);
    lines.push(`  ${qty}${uom} x ${rate} = ${amount}`);
  }

  lines.push('--------------------------------');

  if (doc.netTotal && hasValue(doc.totalTax)) {
    lines.push(
      `${t`Subtotal`}: ${String(
        fyo.format(doc.netTotal, ModelNameEnum.Currency) ?? ''
      )}`
    );
    lines.push(
      `${t`Tax / GST`}: ${String(
        fyo.format(doc.totalTax, ModelNameEnum.Currency) ?? ''
      )}`
    );
  }

  if (hasValue(doc.totalDiscount)) {
    lines.push(
      `${t`Discount`}: ${String(
        fyo.format(doc.totalDiscount, ModelNameEnum.Currency) ?? ''
      )}`
    );
  }

  lines.push(
    `*${t`Grand Total`}: ${String(
      fyo.format(doc.grandTotal, ModelNameEnum.Currency) ?? ''
    )}*`
  );

  if (hasValue(doc.paidAmount)) {
    lines.push(
      `${t`Amount Paid`}: ${String(
        fyo.format(doc.paidAmount, ModelNameEnum.Currency) ?? ''
      )}`
    );
  }

  if (hasValue(doc.outstandingAmount)) {
    lines.push(
      `${t`Balance Due`}: ${String(
        fyo.format(doc.outstandingAmount, ModelNameEnum.Currency) ?? ''
      )}`
    );
  }

  lines.push('--------------------------------');
  lines.push(t`Thank you for your business!`);

  return lines.join('\n');
}

function generateFallbackReceiptHtml(values: PrintValues): string {
  const doc = values.doc ?? {};
  const print = values.print ?? {};
  const items = Array.isArray(doc.items)
    ? (doc.items as Record<string, unknown>[])
    : [];

  const itemsRows = items
    .map(
      (row, idx) => `
    <tr>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">${
        idx + 1
      }</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; font-weight: 500;">${String(
        row.itemName ?? row.item ?? ''
      )}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${String(
        row.quantity ?? row.qty ?? 1
      )}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${String(
        row.rate ?? ''
      )}</td>
      <td style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right; font-weight: 600;">${String(
        row.amount ?? ''
      )}</td>
    </tr>
  `
    )
    .join('');

  const companyName = String(print.companyName ?? 'INVOICE');
  const printPhone = String(print.phone ?? '');
  const printEmail = String(print.email ?? '');
  const docName = String(doc.name ?? '');
  const docParty = String(doc.party ?? 'Cash');
  const docDate = String(doc.date ?? '');
  const netTotal = doc.netTotal ? String(doc.netTotal) : '';
  const totalTax = doc.totalTax ? String(doc.totalTax) : '';
  const totalDiscount = doc.totalDiscount ? String(doc.totalDiscount) : '';
  const grandTotal = String(doc.grandTotal ?? '');
  const paidAmount = doc.paidAmount ? String(doc.paidAmount) : '';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Receipt</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; margin: 0; padding: 24px; color: #111; font-size: 13px; }
        .header { text-align: center; border-bottom: 2px solid #111; padding-bottom: 12px; margin-bottom: 16px; }
        .company { font-size: 20px; font-weight: bold; }
        .meta-grid { display: flex; justify-content: space-between; margin-bottom: 16px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
        th { text-align: left; padding: 8px; background: #f3f4f6; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #111; }
        .totals { margin-left: auto; width: 260px; }
        .totals-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
        .grand-total { font-size: 16px; font-weight: bold; border-top: 2px solid #111; border-bottom: 2px solid #111; padding: 6px 0; margin-top: 4px; }
        .footer { text-align: center; margin-top: 32px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company">${companyName}</div>
        <div style="font-size: 12px; color: #555; margin-top: 2px;">${printPhone} ${printEmail}</div>
        <div style="font-size: 14px; font-weight: 600; margin-top: 8px;">Invoice: ${docName}</div>
      </div>
      <div class="meta-grid">
        <div><strong>Customer:</strong> ${docParty}</div>
        <div><strong>Date:</strong> ${docDate}</div>
      </div>
      <table>
        <thead>
          <tr>
            <th style="width: 30px;">#</th>
            <th>Item</th>
            <th style="text-align: center; width: 60px;">Qty</th>
            <th style="text-align: right; width: 90px;">Rate</th>
            <th style="text-align: right; width: 100px;">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>
      <div class="totals">
        ${
          netTotal && totalTax
            ? `
          <div class="totals-row"><span>Subtotal:</span><span>${netTotal}</span></div>
          <div class="totals-row"><span>Tax:</span><span>${totalTax}</span></div>
        `
            : ''
        }
        ${
          totalDiscount
            ? `<div class="totals-row"><span>Discount:</span><span>${totalDiscount}</span></div>`
            : ''
        }
        <div class="totals-row grand-total"><span>Grand Total:</span><span>${grandTotal}</span></div>
        ${
          paidAmount
            ? `<div class="totals-row"><span>Paid:</span><span>${paidAmount}</span></div>`
            : ''
        }
      </div>
      <div class="footer">***** Thank You Visit Again *****</div>
    </body>
    </html>
  `;
}

export async function renderDocPrintHtml(
  doc: Doc,
  fyo: Fyo
): Promise<{ html: string; width: number; height: number }> {
  const values = await getPrintTemplatePropValues(doc);
  const schemaName = doc.schemaName;

  // 1. Resolve template name:
  // First check explicit whatsappPrintTemplate setting
  let templateName = (
    fyo.singles.Defaults?.whatsappPrintTemplate as string
  )?.trim();

  // If not configured, check POS or schema defaults
  if (!templateName) {
    if (schemaName === ModelNameEnum.SalesInvoice && doc.isPOS) {
      templateName = fyo.singles.Defaults?.posPrintTemplate as string;
      const posProfileName = fyo.singles.POSSettings?.posProfile as string;
      if (posProfileName) {
        try {
          const posProfile = await fyo.doc.getDoc(
            ModelNameEnum.POSProfile,
            posProfileName
          );
          if (posProfile.posPrintTemplate) {
            templateName = posProfile.posPrintTemplate as string;
          }
        } catch {
          // ignore
        }
      }
      if (!templateName) {
        templateName = 'Business-POS - Sales Invoice';
      }
    } else {
      const defaultName =
        schemaName[0].toLowerCase() +
        schemaName.slice(1) +
        ModelNameEnum.PrintTemplate;
      templateName = fyo.singles.Defaults?.get(defaultName) as string;
    }
  }

  let templateDoc: Doc | null = null;
  if (templateName) {
    try {
      templateDoc = await fyo.doc.getDoc(
        ModelNameEnum.PrintTemplate,
        templateName
      );
    } catch {
      // ignore
    }
  }

  // Fallback to first template of this schema if specific name not found
  if (!templateDoc) {
    try {
      const list = (await fyo.db.getAllRaw(ModelNameEnum.PrintTemplate, {
        filters: { type: schemaName },
      })) as { name: string }[];
      if (list && list.length > 0) {
        templateDoc = await fyo.doc.getDoc(
          ModelNameEnum.PrintTemplate,
          list[0].name
        );
      }
    } catch {
      // ignore
    }
  }

  // Fallback if not found in db: check if any template exists
  if (!templateDoc) {
    try {
      const allTemplates = (await fyo.db.getAll(
        ModelNameEnum.PrintTemplate
      )) as Doc[];
      const match = allTemplates.find((t) => t.type === schemaName);
      if (match) {
        templateDoc = match;
      }
    } catch {
      // ignore
    }
  }

  // If template is still missing or has no template string, use the clean fallback receipt
  if (!templateDoc || !templateDoc.template) {
    const fallbackHtml = generateFallbackReceiptHtml(values);
    return {
      html: fallbackHtml,
      width: doc.isPOS ? 8 : 21,
      height: doc.isPOS ? 20 : 29.7,
    };
  }

  const width = (templateDoc.width as number) ?? (doc.isPOS ? 8 : 21);
  const height = (templateDoc.height as number) ?? (doc.isPOS ? 20 : 29.7);

  try {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '-9999px';
    container.style.width = `${width * 37.8}px`;
    document.body.appendChild(container);

    const templateComponent = {
      template: templateDoc.template as string,
      props: ['doc', 'print'],
      computed: {
        fyo() {
          return fyo;
        },
        platform() {
          return fyo.store?.platform || '';
        },
      },
      methods: {
        t: fyo.t,
        T: fyo.T,
        parseFloat,
        Math,
      },
    };

    const app = createApp({
      render() {
        return h(templateComponent, {
          doc: values.doc,
          print: values.print,
        });
      },
    });

    app.mixin({
      computed: {
        fyo() {
          return fyo;
        },
        platform() {
          return fyo.store?.platform || '';
        },
      },
      methods: {
        t: fyo.t,
        T: fyo.T,
        parseFloat,
        Math,
      },
    });

    app.mount(container);
    await new Promise((resolve) => setTimeout(resolve, 100));
    const innerHTML = container.innerHTML;
    app.unmount();
    container.remove();

    if (!innerHTML || innerHTML.trim() === '') {
      throw new Error('Rendered innerHTML is empty');
    }

    const html = constructPrintDocument(innerHTML);
    return { html, width, height };
  } catch {
    // If template compilation fails at runtime, fall back to clean receipt
    const fallbackHtml = generateFallbackReceiptHtml(values);
    return { html: fallbackHtml, width, height };
  }
}

export async function generateInvoicePDF(
  doc: Doc,
  fyo: Fyo,
  savePath: string
): Promise<boolean> {
  const rendered = await renderDocPrintHtml(doc, fyo);

  const success = await ipc.makePDF(
    rendered.html,
    savePath,
    rendered.width,
    rendered.height
  );
  return success;
}

export async function shareInvoiceOnWhatsApp(
  doc: Doc,
  fyo: Fyo,
  options?: {
    format?: 'Text Receipt' | 'PDF File';
    phone?: string;
  }
): Promise<void> {
  const defaults = fyo.singles.Defaults;
  const defaultCountryCode =
    (defaults?.whatsappCountryCode as string)?.trim() || '91';

  let rawPhone = options?.phone || '';
  let partyDoc: Doc | null = null;

  // Retrieve phone from party if not provided
  if (!rawPhone && doc.party) {
    try {
      partyDoc = await fyo.doc.getDoc(ModelNameEnum.Party, doc.party as string);
      if (partyDoc && partyDoc.phone) {
        rawPhone = String(partyDoc.phone).trim();
      }
    } catch {
      // party doc not found
    }
  }

  if (!rawPhone && doc.phone) {
    rawPhone = String(doc.phone).trim();
  }

  // If phone is still missing or invalid, prompt user
  let cleanedPhone = cleanWhatsAppPhone(rawPhone, defaultCountryCode);
  if (!cleanedPhone || cleanedPhone.length < 7) {
    const promptResult = await promptWhatsAppPhone({
      title: t`WhatsApp Share - ${String(doc.name ?? '')}`,
      partyName: (doc.party as string) || '',
      initialPhone: rawPhone,
      canSaveToParty: Boolean(doc.party),
    });

    if (!promptResult) {
      // User cancelled
      return;
    }

    cleanedPhone = cleanWhatsAppPhone(promptResult.phone, defaultCountryCode);

    if (promptResult.saveToParty && partyDoc) {
      try {
        await partyDoc.set('phone', promptResult.phone.trim());
        await partyDoc.sync();
      } catch {
        // non-blocking
      }
    }
  }

  if (!cleanedPhone) {
    showToast({
      message: t`Valid WhatsApp phone number is required.`,
      type: 'error',
    });
    return;
  }

  const shareFormat =
    options?.format ||
    (defaults?.whatsappShareFormat as 'Text Receipt' | 'PDF File') ||
    'Text Receipt';

  if (shareFormat === 'PDF File') {
    let saveFolder = (defaults?.whatsappPdfFolder as string)?.trim() || '';
    let targetPdfPath = '';

    const sanitizedDocName = String(doc.name ?? 'Invoice').replace(
      /[/\\?%*:|"<>]/g,
      '-'
    );
    const defaultFileName = `${sanitizedDocName}.pdf`;

    if (saveFolder) {
      saveFolder = saveFolder.replace(/[/\\]+$/, '');
      const separator = saveFolder.includes('\\') ? '\\' : '/';
      targetPdfPath = `${saveFolder}${separator}${defaultFileName}`;
    } else {
      const saveDialogResult = await ipc.getSaveFilePath({
        defaultPath: defaultFileName,
        filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
      });

      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        return;
      }
      targetPdfPath = saveDialogResult.filePath;
    }

    showToast({
      message: t`Generating PDF...`,
      type: 'info',
      duration: 'short',
    });

    const pdfSuccess = await generateInvoicePDF(doc, fyo, targetPdfPath);
    if (!pdfSuccess) {
      showToast({
        message: t`Failed to generate PDF for WhatsApp sharing.`,
        type: 'error',
      });
      return;
    }

    // Open WhatsApp chat with accompanying message so chat loads automatically
    const companyName =
      (fyo.singles.PrintSettings?.companyName as string) ||
      (fyo.singles.AccountingSettings?.companyName as string) ||
      '';

    const grandTotal = doc.grandTotal
      ? String(
          fyo.format(doc.grandTotal, ModelNameEnum.Currency) ?? doc.grandTotal
        )
      : '';

    const pdfMessageLines: string[] = [];
    if (companyName) {
      pdfMessageLines.push(`*${companyName}*`);
    }
    pdfMessageLines.push(`*Invoice: ${String(doc.name ?? '')}*`);
    if (grandTotal) {
      pdfMessageLines.push(`Grand Total: ${grandTotal}`);
    }
    pdfMessageLines.push('');
    pdfMessageLines.push(
      t`Hello, here is your invoice PDF. Thank you for your business!`
    );

    const encodedPdfText = encodeURIComponent(pdfMessageLines.join('\n'));
    const chatUrl = `https://wa.me/${cleanedPhone}?text=${encodedPdfText}`;
    ipc.openLink(chatUrl);

    // Reveal file in folder
    ipc.showItemInFolder(targetPdfPath);

    showToast({
      message: t`PDF ready! Chat opened — drag the highlighted PDF into WhatsApp.`,
      actionText: t`Open Folder`,
      type: 'success',
      action: () => {
        ipc.showItemInFolder(targetPdfPath);
      },
    });
  } else {
    // Text Receipt
    const messageText = formatWhatsAppText(doc, fyo);
    const encodedText = encodeURIComponent(messageText);
    const shareUrl = `https://wa.me/${cleanedPhone}?text=${encodedText}`;

    ipc.openLink(shareUrl);

    showToast({
      message: t`Opening WhatsApp chat...`,
      type: 'success',
      duration: 'short',
    });
  }
}
