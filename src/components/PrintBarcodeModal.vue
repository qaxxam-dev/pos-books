<template>
  <Modal :open-modal="state.open" @closemodal="close">
    <div
      class="
        flex flex-col
        max-w-4xl
        w-screen
        max-h-[90vh]
        bg-white
        dark:bg-gray-850
        text-gray-900
        dark:text-gray-25
      "
    >
      <!-- Header -->
      <div
        class="
          flex
          items-center
          justify-between
          px-6
          py-4
          border-b
          dark:border-gray-800
        "
      >
        <div class="flex items-center gap-2">
          <feather-icon
            name="printer"
            class="w-5 h-5 text-gray-700 dark:text-gray-300"
          />
          <h2 class="text-lg font-semibold">{{ t`Print Barcode Stickers` }}</h2>
          <span
            v-if="totalStickers > 0"
            class="
              text-xs
              px-2
              py-0.5
              bg-blue-100
              text-blue-800
              dark:bg-blue-900 dark:text-blue-200
              rounded-full
              font-medium
            "
          >
            {{ totalStickers }} {{ t`labels` }}
          </span>
        </div>
        <button
          type="button"
          class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          @click="close"
        >
          <feather-icon name="x" class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 overflow-y-auto">
        <!-- Settings & Items -->
        <div class="flex flex-col gap-4">
          <!-- Dimension settings -->
          <div
            class="
              p-4
              bg-gray-50
              dark:bg-gray-800
              rounded-lg
              border
              dark:border-gray-750
              flex flex-col
              gap-3
            "
          >
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ t`Label Dimensions` }}
            </h3>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label
                  class="text-xs text-gray-500 dark:text-gray-400 block mb-1"
                >
                  {{ t`Width (mm)` }}
                </label>
                <input
                  v-model.number="labelWidth"
                  type="number"
                  min="20"
                  max="110"
                  step="1"
                  class="
                    w-full
                    px-3
                    py-1.5
                    text-sm
                    border
                    rounded
                    bg-white
                    dark:bg-gray-850 dark:border-gray-700
                    outline-none
                    focus:border-blue-500
                  "
                />
              </div>
              <div>
                <label
                  class="text-xs text-gray-500 dark:text-gray-400 block mb-1"
                >
                  {{ t`Height (mm)` }}
                </label>
                <input
                  v-model.number="labelHeight"
                  type="number"
                  min="15"
                  max="150"
                  step="1"
                  class="
                    w-full
                    px-3
                    py-1.5
                    text-sm
                    border
                    rounded
                    bg-white
                    dark:bg-gray-850 dark:border-gray-700
                    outline-none
                    focus:border-blue-500
                  "
                />
              </div>
            </div>
            <!-- Preset sizes -->
            <div class="flex items-center gap-2 pt-1 flex-wrap">
              <span class="text-xs text-gray-400">{{ t`Presets:` }}</span>
              <button
                type="button"
                class="
                  text-xs
                  px-2
                  py-0.5
                  border
                  rounded
                  bg-white
                  dark:bg-gray-700
                  hover:bg-gray-100
                "
                @click="setDimensions(50, 25)"
              >
                50 × 25 mm
              </button>
              <button
                type="button"
                class="
                  text-xs
                  px-2
                  py-0.5
                  border
                  rounded
                  bg-white
                  dark:bg-gray-700
                  hover:bg-gray-100
                "
                @click="setDimensions(38, 25)"
              >
                38 × 25 mm
              </button>
              <button
                type="button"
                class="
                  text-xs
                  px-2
                  py-0.5
                  border
                  rounded
                  bg-white
                  dark:bg-gray-700
                  hover:bg-gray-100
                "
                @click="setDimensions(50, 38)"
              >
                50 × 38 mm
              </button>
            </div>
          </div>

          <!-- Content display toggles -->
          <div
            class="
              p-4
              bg-gray-50
              dark:bg-gray-800
              rounded-lg
              border
              dark:border-gray-750
              flex flex-col
              gap-2
            "
          >
            <h3
              class="
                text-sm
                font-semibold
                text-gray-700
                dark:text-gray-300
                mb-1
              "
            >
              {{ t`Label Elements` }}
            </h3>
            <label
              class="flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              <input
                v-model="showBarcode"
                type="checkbox"
                class="rounded text-blue-600"
              />
              <span>{{ t`Barcode (Code-128)` }}</span>
            </label>
            <label
              class="flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              <input
                v-model="showItemName"
                type="checkbox"
                class="rounded text-blue-600"
              />
              <span>{{ t`Item Name` }}</span>
            </label>
            <label
              class="flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              <input
                v-model="showPrice"
                type="checkbox"
                class="rounded text-blue-600"
              />
              <span>{{ t`Selling Price / Rate` }}</span>
            </label>
            <label
              class="flex items-center gap-2 text-sm cursor-pointer select-none"
            >
              <input
                v-model="showStoreName"
                type="checkbox"
                class="rounded text-blue-600"
              />
              <span>{{ t`Company / Store Name` }}</span>
            </label>
          </div>

          <!-- Items and Quantities -->
          <div class="flex flex-col gap-2">
            <h3 class="text-sm font-semibold text-gray-700 dark:text-gray-300">
              {{ t`Items to Print` }} ({{ items.length }})
            </h3>
            <div
              class="
                border
                dark:border-gray-750
                rounded-lg
                overflow-hidden
                divide-y
                dark:divide-gray-750
                max-h-48
                overflow-y-auto
              "
            >
              <div
                v-for="(it, idx) of items"
                :key="it.item + idx"
                class="
                  flex
                  items-center
                  justify-between
                  p-3
                  bg-white
                  dark:bg-gray-850
                "
              >
                <div class="flex flex-col truncate pr-2">
                  <span class="text-sm font-medium truncate">{{
                    it.itemName || it.item
                  }}</span>
                  <span class="text-xs text-gray-500 font-mono">{{
                    it.barcode || t`No barcode`
                  }}</span>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-xs text-gray-400">{{ t`Qty:` }}</span>
                  <input
                    v-model.number="it.quantity"
                    type="number"
                    min="1"
                    class="
                      w-16
                      px-2
                      py-1
                      text-sm
                      border
                      rounded
                      text-center
                      bg-transparent
                      outline-none
                      focus:border-blue-500
                    "
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Live Preview Area -->
        <div
          class="
            flex flex-col
            items-center
            justify-center
            p-4
            bg-gray-100
            dark:bg-gray-900
            rounded-lg
            border
            dark:border-gray-800
          "
        >
          <div
            class="
              text-xs
              font-semibold
              text-gray-500
              mb-3
              tracking-wide
              uppercase
            "
          >
            {{ t`Physical Label Preview` }} ({{ labelWidth }}mm ×
            {{ labelHeight }}mm)
          </div>

          <!-- Simulated Label Container -->
          <div
            class="
              bg-white
              text-black
              border-2 border-dashed border-gray-300
              shadow-md
              rounded
              p-2
              flex flex-col
              items-center
              justify-center
              text-center
              overflow-hidden
            "
            :style="previewStyle"
          >
            <div
              v-if="showStoreName && companyName"
              class="font-bold text-[10px] leading-tight truncate w-full mb-0.5"
            >
              {{ companyName }}
            </div>

            <div
              v-if="showItemName && activePreviewItem"
              class="font-semibold text-xs leading-tight truncate w-full mb-1"
            >
              {{ activePreviewItem.itemName || activePreviewItem.item }}
            </div>

            <div
              v-if="showBarcode && previewSvg"
              class="w-full flex justify-center items-center my-0.5"
              v-html="previewSvg"
            />
            <div
              v-else-if="!activePreviewItem?.barcode"
              class="text-xs text-red-500 my-2"
            >
              {{ t`Item has no barcode` }}
            </div>

            <div
              v-if="showPrice && activePreviewPrice"
              class="font-bold text-xs leading-tight mt-0.5"
            >
              {{ activePreviewPrice }}
            </div>
          </div>

          <p class="text-xs text-gray-400 mt-4 text-center">
            {{
              t`Actual output is rendered as high-precision 203 DPI vector graphics for thermal labels.`
            }}
          </p>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="
          flex
          items-center
          justify-end
          gap-3
          px-6
          py-4
          border-t
          dark:border-gray-800
          bg-gray-25
          dark:bg-gray-875
        "
      >
        <Button @click="close">
          {{ t`Cancel` }}
        </Button>
        <Button
          :disabled="totalStickers === 0 || !hasAnyBarcode"
          @click="saveAsPdf"
        >
          {{ t`Save as PDF` }}
        </Button>
        <Button
          type="primary"
          :disabled="totalStickers === 0 || !hasAnyBarcode"
          @click="printLabels"
        >
          <div class="flex items-center gap-2">
            <feather-icon name="printer" class="w-4 h-4" />
            <span>{{ t`Print` }} ({{ totalStickers }})</span>
          </div>
        </Button>
      </div>
    </div>
  </Modal>
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import Button from 'src/components/Button.vue';
import Modal from 'src/components/Modal.vue';
import {
  barcodePrintState,
  closeBarcodePrintModal,
  BarcodePrintItem,
} from 'src/utils/printBarcode';
import { generateBarcode128SVG } from 'src/utils/barcode128';
import { fyo } from 'src/initFyo';
import { showToast } from 'src/utils/interactive';

export default defineComponent({
  name: 'PrintBarcodeModal',
  components: {
    Button,
    Modal,
  },
  data() {
    return {
      labelWidth: 50,
      labelHeight: 25,
      showBarcode: true,
      showItemName: true,
      showPrice: true,
      showStoreName: false,
    };
  },
  computed: {
    state() {
      return barcodePrintState.value;
    },
    items(): BarcodePrintItem[] {
      return this.state.items;
    },
    activePreviewItem(): BarcodePrintItem | undefined {
      return this.items[0];
    },
    companyName(): string {
      return (
        (fyo.singles.PrintSettings?.companyName as string) ||
        (fyo.singles.AccountingSettings?.companyName as string) ||
        ''
      );
    },
    totalStickers(): number {
      return this.items.reduce((acc, it) => acc + (it.quantity || 0), 0);
    },
    hasAnyBarcode(): boolean {
      return this.items.some((it) => !!it.barcode && (it.quantity || 0) > 0);
    },
    previewSvg(): string {
      const code = this.activePreviewItem?.barcode;
      if (!code) return '';
      return generateBarcode128SVG(code, {
        height: Math.max(24, Math.round(this.labelHeight * 1.5)),
        barWidth: 1.5,
        fontSize: 10,
        includeText: true,
      });
    },
    previewStyle(): Record<string, string> {
      // 1mm ~ 3.78px on screen. Scale preview to fit cleanly
      const scale = 3.5;
      const widthPx = Math.min(320, Math.round(this.labelWidth * scale));
      const heightPx = Math.round(
        this.labelHeight * (widthPx / this.labelWidth)
      );
      return {
        width: `${widthPx}px`,
        height: `${heightPx}px`,
      };
    },
    activePreviewPrice(): string {
      const item = this.activePreviewItem;
      if (!item || item.rate === undefined || item.rate === null) return '';
      return String(fyo.format(item.rate, 'Currency'));
    },
  },
  watch: {
    'state.open'(isOpen: boolean) {
      if (isOpen) {
        this.loadSettings();
      }
    },
  },
  methods: {
    loadSettings() {
      const inventorySettings = fyo.singles.InventorySettings;
      if (inventorySettings?.barcodeLabelWidth) {
        this.labelWidth = Number(inventorySettings.barcodeLabelWidth) || 50;
      }
      if (inventorySettings?.barcodeLabelHeight) {
        this.labelHeight = Number(inventorySettings.barcodeLabelHeight) || 25;
      }
    },
    setDimensions(width: number, height: number) {
      this.labelWidth = width;
      this.labelHeight = height;
    },
    close() {
      closeBarcodePrintModal();
    },
    async saveSettings() {
      try {
        const inventorySettings = await fyo.doc.getDoc('InventorySettings');
        if (inventorySettings) {
          await inventorySettings.set('barcodeLabelWidth', this.labelWidth);
          await inventorySettings.set('barcodeLabelHeight', this.labelHeight);
          await inventorySettings.sync();
        }
      } catch (err) {
        // Non-blocking error
      }
    },
    buildDocumentHtml(): string {
      const stickersHtml: string[] = [];
      const width = this.labelWidth;
      const height = this.labelHeight;

      for (const item of this.items) {
        if (!item.barcode || !item.quantity || item.quantity <= 0) continue;

        const barcodeSvg = generateBarcode128SVG(item.barcode, {
          height: Math.max(26, Math.round(height * 2.2)),
          barWidth: 2,
          fontSize: 10,
          includeText: true,
        });

        const storeNameHtml =
          this.showStoreName && this.companyName
            ? `<div class="store-name">${this.companyName}</div>`
            : '';

        const itemNameHtml =
          this.showItemName && (item.itemName || item.item)
            ? `<div class="item-name">${item.itemName || item.item}</div>`
            : '';

        const priceHtml =
          this.showPrice && item.rate !== undefined && item.rate !== null
            ? `<div class="item-price">${fyo.format(
                item.rate,
                'Currency'
              )}</div>`
            : '';

        const sticker = `
          <div class="label-sticker">
            ${storeNameHtml}
            ${itemNameHtml}
            <div class="barcode-container">
              ${barcodeSvg}
            </div>
            ${priceHtml}
          </div>
        `;

        for (let i = 0; i < item.quantity; i++) {
          stickersHtml.push(sticker);
        }
      }

      return `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Barcode Stickers</title>
          <style>
            @media print {
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background: #ffffff !important;
              }
              @page {
                size: ${width}mm ${height}mm;
                margin: 0;
              }
            }
            html, body {
              margin: 0;
              padding: 0;
              background: #ffffff;
            }
            .label-sticker {
              width: ${width}mm;
              height: ${height}mm;
              page-break-after: always;
              break-after: page;
              box-sizing: border-box;
              padding: 1mm 1.5mm;
              display: flex;
              flex-direction: column;
              justify-content: center;
              align-items: center;
              text-align: center;
              overflow: hidden;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
            }
            .store-name {
              font-size: 7pt;
              font-weight: 700;
              line-height: 1.1;
              max-width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .item-name {
              font-size: 8pt;
              font-weight: 600;
              line-height: 1.1;
              max-width: 100%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              margin-bottom: 0.5mm;
            }
            .barcode-container {
              width: 95%;
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .barcode-container svg {
              max-height: calc(${height}mm * 0.58);
              width: 100%;
              height: auto;
            }
            .item-price {
              font-size: 8pt;
              font-weight: 700;
              margin-top: 0.5mm;
              line-height: 1.1;
            }
          </style>
        </head>
        <body>
          ${stickersHtml.join('\n')}
        </body>
        </html>
      `;
    },
    async saveAsPdf() {
      if (this.totalStickers === 0) return;
      await this.saveSettings();

      try {
        const { getSavePath, showExportInFolder } = await import(
          'src/utils/ui'
        );
        const { filePath: savePath } = await getSavePath(
          'Barcode-Stickers',
          'pdf'
        );
        if (!savePath) return;

        const html = this.buildDocumentHtml();
        const success = await ipc.makePDF(
          html,
          savePath,
          this.labelWidth,
          this.labelHeight
        );
        if (success) {
          showExportInFolder(this.t`Save as PDF Successful`, savePath);
        } else {
          showToast({ message: this.t`Export Failed`, type: 'error' });
        }
      } catch (err) {
        showToast({ message: this.t`Export Failed`, type: 'error' });
      }
    },
    async printLabels() {
      if (this.totalStickers === 0) return;

      await this.saveSettings();
      const documentHtml = this.buildDocumentHtml();
      const width = this.labelWidth;
      const height = this.labelHeight;

      try {
        const success = await ipc.printDocument(documentHtml, width, height);
        if (success) {
          showToast({
            message: this.t`Sent ${this.totalStickers} labels to printer`,
            type: 'success',
          });
          this.close();
        } else {
          showToast({
            message: this.t`Print cancelled or failed`,
            type: 'info',
          });
        }
      } catch (err) {
        showToast({ message: this.t`Error sending to printer`, type: 'error' });
      }
    },
  },
});
</script>
