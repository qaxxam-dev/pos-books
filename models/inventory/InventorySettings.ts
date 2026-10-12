import { Doc } from 'fyo/model/doc';
import { FiltersMap, HiddenMap, ReadOnlyMap } from 'fyo/model/types';
import { AccountTypeEnum } from 'models/baseModels/Account/types';

export class InventorySettings extends Doc {
  defaultLocation?: string;
  stockInHand?: string;
  stockReceivedButNotBilled?: string;
  costOfGoodsSold?: string;
  enableBarcodes?: boolean;
  enableBatches?: boolean;
  enableSerialNumber?: boolean;
  enableUomConversions?: boolean;
  enableStockReturns?: boolean;
  enablePointOfSale?: boolean;
  barcodeSeries?: string;
  barcodeLabelWidth?: number;
  barcodeLabelHeight?: number;

  static filters: FiltersMap = {
    stockInHand: () => ({
      isGroup: false,
      accountType: AccountTypeEnum.Stock,
    }),
    stockReceivedButNotBilled: () => ({
      isGroup: false,
      accountType: AccountTypeEnum['Stock Received But Not Billed'],
    }),
    costOfGoodsSold: () => ({
      isGroup: false,
      accountType: AccountTypeEnum['Cost of Goods Sold'],
    }),
  };

  readOnly: ReadOnlyMap = {
    enableBarcodes: () => {
      return !!this.enableBarcodes;
    },
    enableBatches: () => {
      return !!this.enableBatches;
    },
    enableSerialNumber: () => {
      return !!this.enableSerialNumber;
    },
    enableUomConversions: () => {
      return !!this.enableUomConversions;
    },
    enableStockReturns: () => {
      return !!this.enableStockReturns;
    },
    enablePointOfSale: () => {
      return !!this.fyo.singles.POSSettings?.isShiftOpen;
    },
  };

  hidden: HiddenMap = {
    barcodeSeries: () => !this.enableBarcodes,
    barcodeLabelWidth: () => !this.enableBarcodes,
    barcodeLabelHeight: () => !this.enableBarcodes,
  };
}
