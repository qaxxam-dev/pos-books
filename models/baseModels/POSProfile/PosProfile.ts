import { Doc } from 'fyo/model/doc';
import { FiltersMap } from 'fyo/model/types';
import { ModelNameEnum } from 'models/types';

import { HiddenMap } from 'fyo/model/types';
import { ValidationError } from 'fyo/utils/errors';
import { validateCipherWord, getCipherMapString } from 'src/utils/cipher';

export class POSProfile extends Doc {
  posProfile?: string;
  posCustomer?: string;
  defaultLocation?: string;
  posPrintTemplate?: string;
  inventory?: string;
  posUI?: 'Classic' | 'Modern';
  isShiftOpen?: boolean;
  itemVisibility?: string;
  canChangeRate?: boolean;
  hideUnavailableItems?: boolean;
  canEditDiscount?: boolean;
  ignorePricingRule?: boolean;
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

  hidden: HiddenMap = {
    rateCipherWord: () => !this.encodeIncomingRate,
    rateCipherMap: () => !this.encodeIncomingRate,
  };

  static filters: FiltersMap = {
    posPrintTemplate: () => ({ type: ModelNameEnum.SalesInvoice }),
  };
}
