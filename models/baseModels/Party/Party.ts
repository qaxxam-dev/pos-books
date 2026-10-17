import { Fyo, t } from 'fyo';
import { Doc } from 'fyo/model/doc';
import {
  Action,
  DefaultMap,
  EmptyMessageMap,
  FiltersMap,
  FormulaMap,
  ListViewSettings,
  ListsMap,
  ValidationMap,
} from 'fyo/model/types';
import {
  validateEmail,
  validatePhoneNumber,
} from 'fyo/model/validationFunction';
import { Money } from 'pesa';
import { PartyRole } from './types';
import { ModelNameEnum } from 'models/types';
import { isLoyaltyProgramExpiredAndMaxed } from 'models/helpers';
import { codeStateMap } from 'regional/in';
import { getCountryInfo } from 'utils/misc';

export class Party extends Doc {
  role?: PartyRole;
  party?: string;
  fromLead?: string;
  defaultAccount?: string;
  loyaltyPoints?: number;
  outstandingAmount?: Money;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  state?: string;
  postalCode?: string;
  address?: string | null;
  async updateOutstandingAmount() {
    /**
     * If Role === "Both" then outstanding Amount
     * will be the amount to be paid to the party.
     */

    const role = this.role as PartyRole;
    let outstandingAmount = this.fyo.pesa(0);

    if (role === 'Customer' || role === 'Both') {
      const outstandingReceive = await this._getTotalOutstandingAmount(
        'SalesInvoice'
      );
      outstandingAmount = outstandingAmount.add(outstandingReceive);
    }

    if (role === 'Supplier') {
      const outstandingPay = await this._getTotalOutstandingAmount(
        'PurchaseInvoice'
      );
      outstandingAmount = outstandingAmount.add(outstandingPay);
    }

    if (role === 'Both') {
      const outstandingPay = await this._getTotalOutstandingAmount(
        'PurchaseInvoice'
      );
      outstandingAmount = outstandingAmount.sub(outstandingPay);
    }

    await this.setAndSync({ outstandingAmount });
  }

  async updateLoyaltyPoints() {
    let loyaltyPoints = 0;

    if (this.role === 'Customer' || this.role === 'Both') {
      loyaltyPoints = await this._getTotalLoyaltyPoints();
    }

    await this.setAndSync({ loyaltyPoints });
  }

  async _getTotalLoyaltyPoints() {
    const loyaltyProgramName = this.loyaltyProgram as string;
    if (loyaltyProgramName) {
      const isExpiredAndMaxed = await isLoyaltyProgramExpiredAndMaxed(
        this.fyo,
        loyaltyProgramName
      );
      if (isExpiredAndMaxed) {
        return 0;
      }
    }

    const data = (await this.fyo.db.getAll(ModelNameEnum.LoyaltyPointEntry, {
      fields: ['name', 'loyaltyPoints', 'expiryDate', 'postingDate'],
      filters: {
        customer: this.name as string,
      },
    })) as {
      name: string;
      loyaltyPoints: number;
      expiryDate: Date;
      postingDate: Date;
    }[];

    const totalLoyaltyPoints = data.reduce((total, entry) => {
      if (entry.expiryDate > entry.postingDate) {
        return total + entry.loyaltyPoints;
      }

      return total;
    }, 0);

    return totalLoyaltyPoints;
  }

  async _getTotalOutstandingAmount(
    schemaName: 'SalesInvoice' | 'PurchaseInvoice'
  ) {
    const outstandingAmounts = await this.fyo.db.getAllRaw(schemaName, {
      fields: ['outstandingAmount'],
      filters: {
        submitted: true,
        cancelled: false,
        party: this.name as string,
      },
    });

    return outstandingAmounts
      .map(({ outstandingAmount }) =>
        this.fyo.pesa(outstandingAmount as number)
      )
      .reduce((a, b) => a.add(b), this.fyo.pesa(0));
  }

  formulas: FormulaMap = {
    defaultAccount: {
      formula: async () => {
        const role = this.role as PartyRole;
        if (role === 'Both') {
          return '';
        }

        let accountName = 'Debtors';
        if (role === 'Supplier') {
          accountName = 'Creditors';
        }

        const accountExists = await this.fyo.db.exists('Account', accountName);
        return accountExists ? accountName : '';
      },
      dependsOn: ['role'],
    },
    currency: {
      formula: () => {
        if (!this.currency) {
          return this.fyo.singles.SystemSettings!.currency as string;
        }
      },
    },
    addressLine1: {
      formula: async () => {
        if (!this.notInserted && this.address && !this.addressLine1) {
          try {
            const addr = await this.fyo.doc.getDoc('Address', this.address);
            if (addr) {
              if (addr.addressLine1)
                this.addressLine1 = addr.addressLine1 as string;
              if (addr.addressLine2)
                this.addressLine2 = addr.addressLine2 as string;
              if (addr.city) this.city = addr.city as string;
              if (addr.state) this.state = addr.state as string;
              if (addr.country) this.country = addr.country as string;
              if (addr.postalCode) this.postalCode = addr.postalCode as string;
              return this.addressLine1;
            }
          } catch {}
        }
      },
      dependsOn: ['address'],
    },
  };

  static defaults: DefaultMap = {
    city: (doc) => doc.fyo.singles.Defaults?.defaultCity ?? '',
    country: (doc) => doc.fyo.singles.Defaults?.defaultCountry ?? '',
    state: (doc) => doc.fyo.singles.Defaults?.defaultState ?? '',
    postalCode: (doc) => doc.fyo.singles.Defaults?.defaultPostalCode ?? '',
  };

  static lists: ListsMap = {
    state(doc?: Doc) {
      const country = doc?.country as string | undefined;
      switch (country) {
        case 'India':
          return Object.values(codeStateMap).sort();
        default:
          return [] as string[];
      }
    },
    country() {
      return Object.keys(getCountryInfo()).sort();
    },
  };

  static emptyMessages: EmptyMessageMap = {
    state: (doc: Doc) => {
      if (doc.country) {
        return t`Enter State`;
      }

      return t`Enter Country to load States`;
    },
  };

  validations: ValidationMap = {
    email: validateEmail,
    phone: validatePhoneNumber,
  };

  static filters: FiltersMap = {
    defaultAccount: (doc: Doc) => {
      const role = doc.role as PartyRole;
      if (role === 'Both') {
        return {
          isGroup: false,
          accountType: ['in', ['Payable', 'Receivable']],
        };
      }

      return {
        isGroup: false,
        accountType: role === 'Customer' ? 'Receivable' : 'Payable',
      };
    },
  };

  static getListViewSettings(): ListViewSettings {
    return {
      columns: ['name', 'email', 'phone', 'outstandingAmount'],
    };
  }

  async beforeSync() {
    await super.beforeSync();
    await this.syncAddress();
  }

  async syncAddress() {
    const hasAddressLine1 = Boolean(
      this.addressLine1 && this.addressLine1.trim()
    );

    if (!hasAddressLine1) {
      this.address = null;
      return;
    }

    const addressData = {
      addressLine1: this.addressLine1.trim(),
      addressLine2: this.addressLine2 ? this.addressLine2.trim() : '',
      city:
        (this.city && this.city.trim()) ||
        (this.fyo.singles.Defaults?.defaultCity ?? ''),
      country:
        (this.country && this.country.trim()) ||
        (this.fyo.singles.Defaults?.defaultCountry ?? ''),
      state:
        (this.state && this.state.trim()) ||
        (this.fyo.singles.Defaults?.defaultState ?? ''),
      postalCode:
        (this.postalCode && this.postalCode.trim()) ||
        (this.fyo.singles.Defaults?.defaultPostalCode ?? ''),
      emailAddress: (this.email as string) || '',
      phone: (this.phone as string) || '',
    };

    let addressDoc: Doc | null = null;
    if (this.address) {
      try {
        addressDoc = await this.fyo.doc.getDoc('Address', this.address);
      } catch {
        addressDoc = null;
      }
    }

    if (addressDoc) {
      await addressDoc.setAndSync(addressData);
    } else {
      const addressName = `${this.name ?? ''} - Address`;
      const exists = await this.fyo.db.exists('Address', addressName);
      if (exists) {
        addressDoc = await this.fyo.doc.getDoc('Address', addressName);
        await addressDoc.setAndSync(addressData);
      } else {
        addressDoc = this.fyo.doc.getNewDoc('Address', {
          name: addressName,
          ...addressData,
        });
        await addressDoc.sync();
      }
      this.address = addressDoc.name;
    }
  }

  async afterDelete() {
    await super.afterDelete();
    if (!this.fromLead) {
      return;
    }
    const leadData = await this.fyo.doc.getDoc(ModelNameEnum.Lead, this.name);
    await leadData.setAndSync('status', 'Interested');
  }

  async afterSync() {
    await super.afterSync();
    if (!this.fromLead) {
      return;
    }

    const leadData = await this.fyo.doc.getDoc(ModelNameEnum.Lead, this.name);
    await leadData.setAndSync('status', 'Converted');
  }

  static getActions(fyo: Fyo): Action[] {
    return [
      {
        label: fyo.t`Create Purchase`,
        condition: (doc: Doc) =>
          !doc.notInserted && (doc.role as PartyRole) !== 'Customer',
        action: async (partyDoc, router) => {
          const doc = fyo.doc.getNewDoc('PurchaseInvoice', {
            party: partyDoc.name,
            account: partyDoc.defaultAccount as string,
          });

          await router.push({
            path: `/edit/PurchaseInvoice/${doc.name!}`,
            query: {
              schemaName: 'PurchaseInvoice',
              values: {
                // @ts-ignore
                party: partyDoc.name!,
              },
            },
          });
        },
      },
      {
        label: fyo.t`View Purchases`,
        condition: (doc: Doc) =>
          !doc.notInserted && (doc.role as PartyRole) !== 'Customer',
        action: async (partyDoc, router) => {
          await router.push({
            path: '/list/PurchaseInvoice',
            query: { filters: JSON.stringify({ party: partyDoc.name }) },
          });
        },
      },
      {
        label: fyo.t`Create Sale`,
        condition: (doc: Doc) =>
          !doc.notInserted && (doc.role as PartyRole) !== 'Supplier',
        action: async (partyDoc, router) => {
          const doc = fyo.doc.getNewDoc('SalesInvoice', {
            party: partyDoc.name,
            account: partyDoc.defaultAccount as string,
          });

          await router.push({
            path: `/edit/SalesInvoice/${doc.name!}`,
            query: {
              schemaName: 'SalesInvoice',
              values: {
                // @ts-ignore
                party: partyDoc.name!,
              },
            },
          });
        },
      },
      {
        label: fyo.t`View Sales`,
        condition: (doc: Doc) =>
          !doc.notInserted && (doc.role as PartyRole) !== 'Supplier',
        action: async (partyDoc, router) => {
          await router.push({
            path: '/list/SalesInvoice',
            query: { filters: JSON.stringify({ party: partyDoc.name }) },
          });
        },
      },
    ];
  }
}
