import { Fyo } from 'fyo';
import { DocValue } from 'fyo/core/types';
import { Doc } from 'fyo/model/doc';
import {
  Action,
  FiltersMap,
  FormulaMap,
  HiddenMap,
  ListViewSettings,
  ReadOnlyMap,
  ValidationMap,
} from 'fyo/model/types';
import { ValidationError } from 'fyo/utils/errors';
import { Money } from 'pesa';
import { AccountRootTypeEnum, AccountTypeEnum } from '../Account/types';
import { generateNextBarcode } from 'models/inventory/helpers';

interface UOMConversionItem {
  name: string;
  uom: string;
  conversionFactor: number;
}

export class Item extends Doc {
  itemCode?: string;
  imei?: string;
  trackItem?: boolean;
  itemType?: 'Product' | 'Service';
  for?: 'Purchases' | 'Sales' | 'Both';
  hasBatch?: boolean;
  batchSeries?: string;
  itemGroup?: string;
  hsnCode?: number;
  hasSerialNumber?: boolean;
  serialNumberSeries?: string;
  datafromErp?: boolean;
  uomConversions: UOMConversionItem[] = [];

  formulas: FormulaMap = {
    incomeAccount: {
      formula: async () => {
        let accountName = 'Service';
        if (this.itemType === 'Product') {
          accountName = 'Sales';
        }

        const accountExists = await this.fyo.db.exists('Account', accountName);
        return accountExists ? accountName : '';
      },
      dependsOn: ['itemType'],
    },
    expenseAccount: {
      formula: async () => {
        if (this.trackItem) {
          return this.fyo.singles.InventorySettings
            ?.stockReceivedButNotBilled as string;
        }

        const cogs = await this.fyo.db.getAllRaw('Account', {
          filters: {
            accountType: AccountTypeEnum['Cost of Goods Sold'],
          },
        });

        if (cogs.length === 0) {
          return '';
        } else {
          return cogs[0].name as string;
        }
      },
      dependsOn: ['itemType', 'trackItem'],
    },
    hsnCode: {
      formula: async () => {
        if (!this.itemGroup) {
          return '';
        }

        const itemGroupDoc = await this.fyo.doc.getDoc(
          'ItemGroup',
          this.itemGroup
        );
        return itemGroupDoc?.hsnCode as string;
      },
      dependsOn: ['itemGroup'],
    },
  };

  async beforeSync(): Promise<void> {
    await super.beforeSync();
    const latestByUom = new Map<string, UOMConversionItem>();

    this.uomConversions.forEach((item) => {
      if (item.conversionFactor > 0) {
        latestByUom.set(item.uom, item);
      }
    });

    this.uomConversions = Array.from(latestByUom.values());

    if (this.serialNumberSeries && this.hasSerialNumber) {
      const series = this.serialNumberSeries.trim();
      if (series && !series.endsWith('-')) {
        this.serialNumberSeries = series + '-';
      }
    }

    if (this.batchSeries && this.hasBatch) {
      const series = this.batchSeries.trim();
      if (series && !series.endsWith('-')) {
        this.batchSeries = series + '-';
      }
    }

    if (this.imei !== undefined && this.imei !== null && this.imei !== '') {
      this.imei = String(this.imei).trim();
    }

    if (
      this.notInserted &&
      this.fyo.singles.InventorySettings?.enableBarcodes &&
      (!this.barcode || String(this.barcode).trim() === '')
    ) {
      this.barcode = await generateNextBarcode(this.fyo);
    }
  }

  async generateBarcode(): Promise<string> {
    const nextBarcode = await generateNextBarcode(this.fyo);
    this.barcode = nextBarcode;
    return nextBarcode;
  }

  async afterSync(): Promise<void> {
    await super.afterSync();

    if (this.hasSerialNumber && this.serialNumberSeries) {
      const seriesName = this.serialNumberSeries?.trim();

      if (!seriesName) {
        return;
      }

      const exists = await this.fyo.db.exists('SerialNumberSeries', seriesName);

      if (!exists) {
        await this.fyo.doc
          .getNewDoc('SerialNumberSeries', {
            name: seriesName,
            start: 1001,
            padZeros: 4,
            current: 1001,
          })
          .sync();
      }
    }

    if (this.hasBatch && this.batchSeries) {
      const seriesName = this.batchSeries?.trim();

      if (!seriesName) {
        return;
      }

      const exists = await this.fyo.db.exists('BatchSeries', seriesName);

      if (!exists) {
        await this.fyo.doc
          .getNewDoc('BatchSeries', {
            name: seriesName,
            start: 1001,
            padZeros: 4,
            current: 1001,
          })
          .sync();
      }
    }
  }

  static filters: FiltersMap = {
    incomeAccount: () => ({
      isGroup: false,
      rootType: AccountRootTypeEnum.Income,
    }),
    expenseAccount: (doc) => ({
      isGroup: false,
      rootType: doc.trackItem
        ? AccountRootTypeEnum.Liability
        : AccountRootTypeEnum.Expense,
    }),
  };

  validations: ValidationMap = {
    imei: (value: DocValue) => {
      if (value === null || value === undefined || value === '') {
        return;
      }
      const str = String(value).trim();
      if (!/^\d+$/.test(str)) {
        throw new ValidationError(
          this.fyo.t`IMEI must contain only numbers without decimals.`
        );
      }
    },
  };

  static getActions(fyo: Fyo): Action[] {
    return [
      {
        group: fyo.t`Create`,
        label: fyo.t`Sales Invoice`,
        condition: (doc) => !doc.notInserted && doc.for !== 'Purchases',
        action: async (doc, router) => {
          const invoice = fyo.doc.getNewDoc('SalesInvoice');
          await invoice.append('items', {
            item: doc.name as string,
            rate: doc.rate as Money,
            tax: doc.tax as string,
          });
          await router.push(`/edit/SalesInvoice/${invoice.name!}`);
        },
      },
      {
        group: fyo.t`Create`,
        label: fyo.t`Purchase Invoice`,
        condition: (doc) => !doc.notInserted && doc.for !== 'Sales',
        action: async (doc, router) => {
          const invoice = fyo.doc.getNewDoc('PurchaseInvoice');
          await invoice.append('items', {
            item: doc.name as string,
            rate: doc.rate as Money,
            tax: doc.tax as string,
          });
          await router.push(`/edit/PurchaseInvoice/${invoice.name!}`);
        },
      },
      {
        group: fyo.t`Print`,
        label: fyo.t`Print Barcode Sticker`,
        condition: (doc) => !doc.notInserted && !!doc.barcode,
        action: async (doc) => {
          const { openBarcodePrintModal } = await import('src/utils/printBarcode');
          openBarcodePrintModal([
            {
              item: doc.name as string,
              itemName: doc.name as string,
              barcode: doc.barcode as string,
              rate: doc.rate as number,
              quantity: 1,
            },
          ]);
        },
      },
    ];
  }

  static getListViewSettings(): ListViewSettings {
    return {
      columns: ['name', 'unit', 'tax', 'rate'],
    };
  }

  hidden: HiddenMap = {
    imei: () => this.itemType !== 'Product',
    trackItem: () =>
      !this.fyo.singles.AccountingSettings?.enableInventory ||
      this.itemType !== 'Product' ||
      (this.inserted && !this.trackItem),
    barcode: () => !this.fyo.singles.InventorySettings?.enableBarcodes,
    hasBatch: () => !this.fyo.singles.InventorySettings?.enableBatches,
    hasSerialNumber: () =>
      !(
        this.fyo.singles.InventorySettings?.enableSerialNumber && this.trackItem
      ),
    serialNumberSeries: () => !this.hasSerialNumber,
    batchSeries: () => !this.hasBatch,
    uomConversions: () =>
      !this.fyo.singles.InventorySettings?.enableUomConversions,
    itemGroup: () => !this.fyo.singles.AccountingSettings?.enableitemGroup,
  };

  readOnly: ReadOnlyMap = {
    unit: () => this.inserted,
    itemType: () => this.inserted,
    trackItem: () => this.inserted,
    hasBatch: () => this.inserted,
    hasSerialNumber: () => this.inserted,
  };
}
