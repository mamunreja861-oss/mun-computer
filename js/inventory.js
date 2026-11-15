/**
 * inventory.js - Retail IT Hardware, Smart PVC Stock & Consumables Inventory
 * MUN COMPUTER - Centralized Business ERP
 * Location: Mamudpur, Juginda, Domkal, Murshidabad
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, logAuditAction, getAuthHeaders } from './storage.js';

export const DEFAULT_GAS_CATEGORIES = [
  'Gas Hose Pipe',
  'Gas Lighter',
  'Gas Regulator',
  'Gas Oven / Stove',
  'Gas Spare Parts & Fittings',
  'Other Gas Accessories'
];

// Kept exported for backward compatibility
export const INVENTORY_CATEGORIES = DEFAULT_GAS_CATEGORIES;

function buildDefaultCategoryRecords() {
  const nowIso = new Date().toISOString();
  return DEFAULT_GAS_CATEGORIES.map((name, idx) => ({
    id: `CAT-GAS-${String(idx + 1).padStart(2, '0')}`,
    name,
    isDefault: true,
    createdAt: nowIso
  }));
}

function normalizeCategoryName(rawName) {
  return String(rawName || '').replace(/\s+/g, ' ').trim();
}

export function getInventoryCategoryRecords() {
  const stored = getItem(KEYS.INVENTORY_CATEGORIES, null);
  if (!Array.isArray(stored) || stored.length === 0) {
    const defaults = buildDefaultCategoryRecords();
    setItem(KEYS.INVENTORY_CATEGORIES, defaults);
    return defaults;
  }

  const normalized = [];
  const seen = new Set();
  stored.forEach((entry, idx) => {
    const name = normalizeCategoryName(typeof entry === 'string' ? entry : entry?.name);
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    const isDefault = DEFAULT_GAS_CATEGORIES.some(d => d.toLowerCase() === key);
    normalized.push({
      id: (typeof entry === 'object' && entry?.id) ? entry.id : `CAT-${idx + 1}`,
      name,
      isDefault: typeof entry === 'object' && entry?.isDefault !== undefined ? Boolean(entry.isDefault || isDefault) : isDefault,
      createdAt: (typeof entry === 'object' && entry?.createdAt) ? entry.createdAt : new Date().toISOString()
    });
  });

  if (normalized.length === 0) {
    const defaults = buildDefaultCategoryRecords();
    setItem(KEYS.INVENTORY_CATEGORIES, defaults);
    return defaults;
  }
  return normalized;
}

export function getInventoryCategories(includeCategory = '') {
  const names = getInventoryCategoryRecords().map(c => c.name);
  const extra = normalizeCategoryName(includeCategory);
  if (extra && !names.some(n => n.toLowerCase() === extra.toLowerCase())) {
    names.push(extra);
  }
  return names;
}

async function syncCategoriesToServer(actionPath, method = 'POST', payload = null) {
  try {
    const res = await fetch(actionPath, {
      method,
      headers: getAuthHeaders(),
      body: payload ? JSON.stringify(payload) : undefined
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.success && Array.isArray(data.categories) && data.categories.length > 0) {
        setItem(KEYS.INVENTORY_CATEGORIES, data.categories);
      }
    }
  } catch {
    // Offline/localStorage fallback already persisted synchronously
  }
}

export async function syncInventoryCategoriesFromBackend() {
  try {
    const localRecords = getInventoryCategoryRecords();
    const res = await fetch('/api/inventory/categories', { headers: getAuthHeaders() });
    if (!res.ok) return localRecords;
    const data = await res.json();
    if (!data?.success || !Array.isArray(data.categories)) return localRecords;

    const merged = [];
    const seen = new Set();
    for (const rec of [...data.categories, ...localRecords]) {
      const name = normalizeCategoryName(rec?.name);
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      const catId = rec.id || await allocateGlobalReference('CAT', { entityType: 'INVENTORY_CATEGORY' });
      merged.push({
        id: catId,
        name,
        isDefault: Boolean(rec.isDefault || DEFAULT_GAS_CATEGORIES.some(d => d.toLowerCase() === key)),
        createdAt: rec.createdAt || new Date().toISOString()
      });
    }

    if (merged.length > 0) {
      setItem(KEYS.INVENTORY_CATEGORIES, merged);
      // Push any local-only custom categories back to server
      const serverKeys = new Set(data.categories.map(c => normalizeCategoryName(c?.name).toLowerCase()));
      const localOnly = merged.filter(c => !serverKeys.has(c.name.toLowerCase()));
      if (localOnly.length > 0) {
        await syncCategoriesToServer('/api/inventory/categories/sync', 'POST', { categories: merged });
      }
    }
    return getInventoryCategoryRecords();
  } catch {
    return getInventoryCategoryRecords();
  }
}

export async function addInventoryCategory(rawName) {
  const name = normalizeCategoryName(rawName);
  if (!name || name.length < 2) {
    return { success: false, message: 'Please enter a valid category name (at least 2 characters).' };
  }
  if (name.length > 80) {
    return { success: false, message: 'Category name cannot exceed 80 characters.' };
  }

  const records = getInventoryCategoryRecords();
  const duplicate = records.find(r => r.name.toLowerCase() === name.toLowerCase());
  if (duplicate) {
    return { success: false, message: `Category "${duplicate.name}" already exists.`, category: duplicate };
  }

  const isDefault = DEFAULT_GAS_CATEGORIES.some(d => d.toLowerCase() === name.toLowerCase());
  const catId = await allocateGlobalReference('CAT', { entityType: 'INVENTORY_CATEGORY' });
  const newRecord = {
    id: catId,
    name,
    isDefault,
    createdAt: new Date().toISOString()
  };

  records.push(newRecord);
  setItem(KEYS.INVENTORY_CATEGORIES, records);
  logAuditAction('INVENTORY_CATEGORY_ADD', `Added inventory product category "${name}"`);
  syncCategoriesToServer('/api/inventory/categories', 'POST', { name, id: newRecord.id });

  return { success: true, category: newRecord, records, categories: records.map(r => r.name) };
}

export function deleteInventoryCategory(idOrName) {
  const target = normalizeCategoryName(idOrName);
  if (!target) return { success: false, message: 'Category identifier missing.' };

  const records = getInventoryCategoryRecords();
  const match = records.find(r => r.id === target || r.name.toLowerCase() === target.toLowerCase());
  if (!match) {
    return { success: false, message: 'Category not found.' };
  }
  if (records.length <= 1) {
    return { success: false, message: 'At least one product category must remain active.' };
  }

  const updated = records.filter(r => r.id !== match.id);
  setItem(KEYS.INVENTORY_CATEGORIES, updated);
  markGlobalReferenceDeleted(match.id, 'DELETED');
  logAuditAction('INVENTORY_CATEGORY_DELETE', `Deleted inventory product category "${match.name}"`);
  syncCategoriesToServer(`/api/inventory/categories/${encodeURIComponent(match.id)}`, 'DELETE');

  return { success: true, deleted: match, records: updated, categories: updated.map(r => r.name) };
}

export function restoreDefaultGasCategories() {
  const records = getInventoryCategoryRecords();
  const seen = new Set(records.map(r => r.name.toLowerCase()));
  const defaults = buildDefaultCategoryRecords();
  const missing = defaults.filter(d => !seen.has(d.name.toLowerCase()));
  const customOnly = records.filter(r => !DEFAULT_GAS_CATEGORIES.some(d => d.toLowerCase() === r.name.toLowerCase()));
  const merged = [...defaults, ...customOnly];
  setItem(KEYS.INVENTORY_CATEGORIES, merged);
  if (missing.length > 0) {
    logAuditAction('INVENTORY_CATEGORY_RESTORE', `Restored ${missing.length} default gas categories`);
  }
  syncCategoriesToServer('/api/inventory/categories/restore-defaults', 'POST', { categories: merged });
  return { success: true, addedCount: missing.length, records: merged, categories: merged.map(r => r.name) };
}

export function getAllInventory() {
  return getItem(KEYS.INVENTORY, []);
}

export async function saveInventoryItem(itemData) {
  const items = getAllInventory();
  const costPrice = Number(itemData.costPrice) || 0;
  const sellingPrice = Number(itemData.sellingPrice) || 0;
  const stockQuantity = Number(itemData.stockQuantity) || 0;
  const minStockLevel = Number(itemData.minStockLevel) || 5;
  const damagedStock = Math.max(0, Number(itemData.damagedStock) || 0);
  const defaultCat = getInventoryCategories()[0] || 'Gas Hose Pipe';

  if (itemData.id) {
    const idx = items.findIndex(i => i.id === itemData.id);
    if (idx !== -1) {
      items[idx] = {
        ...items[idx],
        ...itemData,
        brand: String(itemData.brand ?? items[idx].brand ?? '').trim(),
        openingStock: items[idx].openingStock !== undefined ? Number(items[idx].openingStock) : (Number(itemData.openingStock) || stockQuantity),
        warehouseId: String(itemData.warehouseId ?? items[idx].warehouseId ?? '').trim(),
        warehouseName: String(itemData.warehouseName ?? items[idx].warehouseName ?? '').trim(),
        rackShelf: String(itemData.rackShelf ?? items[idx].rackShelf ?? items[idx].shelfLocation ?? '').trim(),
        damagedStock: itemData.damagedStock !== undefined ? damagedStock : (Number(items[idx].damagedStock) || 0),
        costPrice,
        sellingPrice,
        stockQuantity,
        minStockLevel,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.INVENTORY, items);
      logAuditAction('INVENTORY_UPDATE', `Updated product ${itemData.name} (SKU: ${itemData.sku || itemData.id})`);
      return { success: true, item: items[idx] };
    }
  }

  const openingStock = itemData.openingStock !== undefined ? Number(itemData.openingStock) : stockQuantity;
  const prdId = await allocateGlobalReference('PRD', { entityType: 'INVENTORY_PRODUCT' });
  const newItem = {
    id: prdId,
    sku: String(itemData.sku || '').trim() || prdId,
    name: itemData.name || 'Untitled Product',
    category: normalizeCategoryName(itemData.category) || defaultCat,
    brand: String(itemData.brand || '').trim(),
    unit: itemData.unit || 'Pcs',
    openingStock,
    stockQuantity,
    minStockLevel,
    damagedStock,
    costPrice,
    sellingPrice,
    supplier: itemData.supplier || 'Local Gas & Hardware Distributor',
    warehouseId: String(itemData.warehouseId || '').trim(),
    warehouseName: String(itemData.warehouseName || 'Main Counter').trim(),
    shelfLocation: itemData.shelfLocation || itemData.rackShelf || 'Gas Rack A1',
    rackShelf: itemData.rackShelf || itemData.shelfLocation || 'Gas Rack A1',
    businessUnitId: 'mun-computer',
    notes: itemData.notes || '',
    createdAt: new Date().toISOString()
  };

  items.unshift(newItem);
  setItem(KEYS.INVENTORY, items);
  logAuditAction('INVENTORY_ADD', `Added new product ${newItem.name} (Stock: ${newItem.stockQuantity})`);
  return { success: true, item: newItem };
}

export function deleteInventoryItem(id) {
  const items = getAllInventory();
  const filtered = items.filter(i => i.id !== id);
  if (filtered.length !== items.length) {
    setItem(KEYS.INVENTORY, filtered);
    markGlobalReferenceDeleted(id, 'DELETED');
    logAuditAction('INVENTORY_DELETE', `Deleted product ${id}`);
    return { success: true };
  }
  return { success: false, message: 'Item not found' };
}

export function adjustStock(id, qtyChange, reason = 'Manual Stock Adjustment', options = {}) {
  const items = getAllInventory();
  const idx = items.findIndex(i => i.id === id);
  if (idx === -1) return { success: false, message: 'Item not found' };

  const current = Number(items[idx].stockQuantity) || 0;
  const delta = Number(qtyChange) || 0;
  const rawNext = current + delta;

  if (options?.strict && rawNext < 0 && !options?.allowNegative) {
    return {
      success: false,
      message: `Insufficient stock for ${items[idx].name} (Available: ${current}, Requested deduction: ${Math.abs(delta)}).`
    };
  }

  const updated = options?.allowNegative ? rawNext : Math.max(0, rawNext);
  items[idx].stockQuantity = updated;
  if (options?.damagedDelta) {
    items[idx].damagedStock = Math.max(0, (Number(items[idx].damagedStock) || 0) + Number(options.damagedDelta));
  }
  items[idx].updatedAt = new Date().toISOString();
  setItem(KEYS.INVENTORY, items);
  logAuditAction('INVENTORY_ADJUST', `Adjusted stock for ${items[idx].name} by ${delta} (${reason}). New stock: ${updated}`);
  return { success: true, item: items[idx], previousStock: current, newStock: updated };
}

export function getLowStockItems() {
  const items = getAllInventory();
  return items.filter(i => i.stockQuantity <= i.minStockLevel);
}

export function getInventoryValuation() {
  const items = getAllInventory();
  let totalCostValue = 0;
  let totalRetailValue = 0;
  let totalUnits = 0;

  items.forEach(i => {
    const qty = Number(i.stockQuantity) || 0;
    totalUnits += qty;
    totalCostValue += qty * (Number(i.costPrice) || 0);
    totalRetailValue += qty * (Number(i.sellingPrice) || 0);
  });

  return {
    totalItemsCount: items.length,
    totalUnits,
    totalCostValue,
    totalRetailValue,
    potentialProfit: totalRetailValue - totalCostValue,
    lowStockCount: getLowStockItems().length
  };
}
