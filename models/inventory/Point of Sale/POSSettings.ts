import { Doc } from 'fyo/model/doc';
import { FiltersMap, HiddenMap } from 'fyo/model/types';
import {
  AccountRootTypeEnum,
  AccountTypeEnum,
} from 'models/baseModels/Account/types';

import { ValidationError } from 'fyo/utils/errors';
import { validateCipherWord, getCipherMapString } from 'src/utils/cipher';

export class POSSettings extends Doc {
  isShiftOpen?: boolean;
  inventory?: string;
  cashAccount?: string;
  writeOffAccount?: string;
  weightEnabledBarcode?: boolean;
  checkDigits?: number;
  itemCodeDigits?: number;
  itemWeightDigits?: number;
  defaultAccount?: string;
  itemVisibility?: string;
  itemVisibilityERP?: 'ERP Sync Items';
  posUI?: 'Classic' | 'Modern';
  canChangeRate?: boolean;
  canEditDiscount?: boolean;
  ignorePricingRule?: boolean;
  taxInclusive?: boolean;
  encodeIncomingRate?: boolean;
  rateCipherWord?: string;
  rateCipherMap?: string;

  override async validate(): Promise<void> {
    await super.validate();
    const word = (this.rateCipherWord || 'BLACKHORSE').trim().toUpperCase();
    if (this.encodeIncomingRate) {
      const { valid, error } = validateCipherWord(word);
      if (!valid) {
        throw new ValidationError(error!);
      }
    }
    this.rateCipherWord = word;
    this.rateCipherMap = getCipherMapString(word);
  }

  static filters: FiltersMap = {
    cashAccount: () => ({
      rootType: AccountRootTypeEnum.Asset,
      accountType: AccountTypeEnum.Cash,
      isGroup: false,
    }),
    defaultAccount: () => ({
      isGroup: false,
      accountType: AccountTypeEnum.Receivable,
    }),
  };

  hidden: HiddenMap = {
    weightEnabledBarcode: () =>
      !this.fyo.singles.InventorySettings?.enableBarcodes,
    checkDigits: () =>
      !this.fyo.singles.InventorySettings?.enableBarcodes ||
      !this.weightEnabledBarcode,
    itemCodeDigits: () =>
      !this.fyo.singles.InventorySettings?.enableBarcodes ||
      !this.weightEnabledBarcode,
    itemWeightDigits: () =>
      !this.fyo.singles.InventorySettings?.enableBarcodes ||
      !this.weightEnabledBarcode,
    itemVisibility: () =>
      !this.fyo.singles.AccountingSettings?.enablePointOfSaleWithOutInventory ||
      !!this.fyo.singles.AccountingSettings?.enableERPNextSync,
    itemVisibilityERP: () =>
      !this.fyo.singles.AccountingSettings?.enableERPNextSync,
    rateCipherWord: () => !this.encodeIncomingRate,
    rateCipherMap: () => !this.encodeIncomingRate,
  };
}
