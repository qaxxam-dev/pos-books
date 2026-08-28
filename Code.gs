/**
 * Inventory Tools - Google Apps Script (Phase 1)
 * Sheet Structure:
 *   Col A: Item Name (User input)
 *   Col B: Price (User input)
 *   Col C: SKU (Auto-generated, BK-XXXX)
 *   Col D: Barcode Preview (Reserved for Phase 3)
 *   Col E: Print Sticker (Reserved for Phase 4)
 *   Col F: Print Qty (Reserved for Phase 4)
 */

/**
 * Custom Menu on Spreadsheet Open
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Inventory Tools')
    .addItem('Generate Missing SKUs', 'generateMissingSkus')
    .addToUi();
}

/**
 * One-time setup function: Scans existing SKUs in Col C, finds highest number,
 * and sets LAST_SKU_NUMBER in Script Properties.
 */
function initializeSkuCounter() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  var highestNumber = 1000; // Default base (next generated will be 1001)

  if (lastRow >= 2) {
    var skuValues = sheet.getRange(2, 3, lastRow - 1, 1).getValues();
    var skuRegex = /^BK-(\d+)$/i;

    for (var i = 0; i < skuValues.length; i++) {
      var val = String(skuValues[i][0]).trim();
      var match = val.match(skuRegex);
      if (match) {
        var num = parseInt(match[1], 10);
        if (!isNaN(num) && num > highestNumber) {
          highestNumber = num;
        }
      }
    }
  }

  PropertiesService.getScriptProperties().setProperty('LAST_SKU_NUMBER', String(highestNumber));
  
  SpreadsheetApp.getUi().alert(
    'Initialization Complete',
    'LAST_SKU_NUMBER script property set to: ' + highestNumber + 
    '\nNext generated SKU will be: BK-' + String(highestNumber + 1).padStart(4, '0'),
    SpreadsheetApp.getUi().ButtonSet.OK
  );
}

/**
 * Installable trigger handler for sheet edits.
 * Fires when Col A (Item Name) or Col B (Price) is modified.
 *
 * @param {Object} e - Event object from installable trigger
 */
function onEdit(e) {
  if (!e || !e.range) return;

  var sheet = e.range.getSheet();
  var startRow = e.range.getRow();
  var endRow = e.range.getLastRow();
  var startCol = e.range.getColumn();
  var endCol = e.range.getLastColumn();

  // Only proceed if edit intersects Row 2+ and Column A (1) or Column B (2)
  if (endRow < 2 || (startCol > 2 && endCol > 2)) return;

  var actualStartRow = Math.max(startRow, 2);

  // Acquire lock to avoid race conditions during rapid concurrent edits
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return;

  try {
    processRowRange(sheet, actualStartRow, endRow);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Menu item action: Scans all rows with Name + Price filled but SKU empty
 */
function generateMissingSkus() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    SpreadsheetApp.getUi().alert('No data rows found.');
    return;
  }

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    SpreadsheetApp.getUi().alert('Process busy. Please try again in a moment.');
    return;
  }

  try {
    var generatedCount = processRowRange(sheet, 2, lastRow);
    SpreadsheetApp.getActiveSpreadsheet().toast(
      generatedCount + ' SKU(s) generated successfully.',
      'Inventory Tools'
    );
  } finally {
    lock.releaseLock();
  }
}

/**
 * Core processing function for a range of rows.
 * Validates requirements and generates SKUs.
 *
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet
 * @param {number} startRow
 * @param {number} endRow
 * @returns {number} Count of newly generated SKUs
 */
function processRowRange(sheet, startRow, endRow) {
  var numRows = endRow - startRow + 1;
  if (numRows <= 0) return 0;

  // Read columns A to C for target row range
  var dataRange = sheet.getRange(startRow, 1, numRows, 3);
  var values = dataRange.getValues();

  // Fetch all existing SKUs in Column C for collision checking
  var totalRows = sheet.getLastRow();
  var existingSkus = [];
  if (totalRows >= 2) {
    var allSkus = sheet.getRange(2, 3, totalRows - 1, 1).getValues();
    for (var i = 0; i < allSkus.length; i++) {
      var s = String(allSkus[i][0]).trim();
      if (s !== '') existingSkus.push(s);
    }
  }

  var scriptProperties = PropertiesService.getScriptProperties();
  var lastSkuNum = parseInt(scriptProperties.getProperty('LAST_SKU_NUMBER') || '1000', 10);
  var generatedCount = 0;
  var rowsToUpdate = false;

  for (var r = 0; r < values.length; r++) {
    var itemName = values[r][0];
    var price = values[r][1];
    var currentSku = values[r][2];

    // 1. Skip if SKU already exists
    if (currentSku !== null && currentSku !== undefined && String(currentSku).trim() !== '') {
      continue;
    }

    // 2. Skip if either Item Name or Price is missing/empty
    if (
      itemName === null || itemName === undefined || String(itemName).trim() === '' ||
      price === null || price === undefined || String(price).trim() === ''
    ) {
      continue;
    }

    // 3. Generate SKU with retry logic up to 5 attempts
    var retryCount = 0;
    var maxRetries = 5;
    var success = false;
    var candidateSku = '';

    /**
     * RETRY / COLLISION LOGIC EXPLANATION:
     * - We increment lastSkuNum to form candidate 'BK-XXXX'.
     * - We verify candidateSku is not in existingSkus (guards against manual entries).
     * - If collision occurs, we increment and retry up to 5 times.
     * - If still colliding after 5 retries, execution halts with a visible UI alert.
     */
    while (retryCount < maxRetries) {
      lastSkuNum++;
      candidateSku = 'BK-' + String(lastSkuNum).padStart(4, '0');

      if (existingSkus.indexOf(candidateSku) === -1) {
        success = true;
        break;
      }
      retryCount++;
    }

    if (!success) {
      SpreadsheetApp.getUi().alert(
        'SKU Generation Failed',
        'Could not generate a unique SKU after 5 retry attempts. Please inspect Column C for duplicate SKUs.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      break;
    }

    // Assign generated SKU back to local dataset and track existing
    values[r][2] = candidateSku;
    existingSkus.push(candidateSku);
    generatedCount++;
    rowsToUpdate = true;
  }

  if (rowsToUpdate) {
    // Write back updated values to sheet (batch operation)
    dataRange.setValues(values);
    // Persist updated counter back to Script Properties
    scriptProperties.setProperty('LAST_SKU_NUMBER', String(lastSkuNum));
  }

  return generatedCount;
}
