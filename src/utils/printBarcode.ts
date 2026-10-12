import { ref } from 'vue';

export interface BarcodePrintItem {
  item: string;
  itemName?: string;
  barcode: string;
  rate?: number | string;
  quantity?: number;
}

export const barcodePrintState = ref<{
  open: boolean;
  items: BarcodePrintItem[];
}>({
  open: false,
  items: [],
});

export function openBarcodePrintModal(items: BarcodePrintItem[]) {
  barcodePrintState.value = {
    open: true,
    items: items.map((it) => ({
      ...it,
      quantity: it.quantity && it.quantity > 0 ? it.quantity : 1,
    })),
  };
}

export function closeBarcodePrintModal() {
  barcodePrintState.value.open = false;
  barcodePrintState.value.items = [];
}
