/**
 * menuManagement.js - Authorized 11-Department Sidebar Customization & Menu Management Engine
 * MUN COMPUTER — CORPORATE ERP SYSTEM
 */

import { KEYS, getItem, setItem, getAuthHeaders, allocateGlobalReference } from './storage.js';
import { getLucideIcon, AVAILABLE_LUCIDE_ICONS } from './lucideIcons.js';
import { getCurrentUser } from './auth.js';

export const FIXED_11_DEPARTMENTS = [
  { key: 'MAIN DASHBOARD', defaultTitle: 'MAIN DASHBOARD', defaultIcon: 'layout-dashboard', accent: '#60A5FA', accentHex: '#2456C7', isLpg: false },
  { key: 'ANNAPURNA YOJANA SYSTEM', defaultTitle: 'SERVICES', defaultIcon: 'wheat', accent: '#22C55E', accentHex: '#16A34A', isLpg: false },
  { key: 'CUSTOMER MANAGEMENT', defaultTitle: 'CUSTOMER MANAGEMENT', defaultIcon: 'users', accent: '#06B6D4', accentHex: '#06B6D4', isLpg: false },
  { key: 'OPERATIONS MANAGEMENT', defaultTitle: 'OPERATIONS MANAGEMENT', defaultIcon: 'settings', accent: '#A78BFA', accentHex: '#8B5CF6', isLpg: false },
  { key: 'LPG & GAS SERVICES', defaultTitle: 'LPG & GAS SERVICES', defaultIcon: 'flame', accent: '#EF4444', accentHex: '#EF4444', isLpg: true },
  { key: 'SALES & BILLING', defaultTitle: 'SALES & BILLING', defaultIcon: 'receipt', accent: '#10B981', accentHex: '#10B981', isLpg: false },
  { key: 'TEAM MANAGEMENT', defaultTitle: 'TEAM MANAGEMENT', defaultIcon: 'user-round', accent: '#F59E0B', accentHex: '#F59E0B', isLpg: false },
  { key: 'INVENTORY & PURCHASE', defaultTitle: 'INVENTORY & PURCHASE', defaultIcon: 'package', accent: '#A78BFA', accentHex: '#8B5CF6', isLpg: false },
  { key: 'FINANCE & ACCOUNTING', defaultTitle: 'FINANCE & ACCOUNTING', defaultIcon: 'wallet', accent: '#14B8A6', accentHex: '#14B8A6', isLpg: false },
  { key: 'GROWTH & MARKETING', defaultTitle: 'GROWTH & MARKETING', defaultIcon: 'trending-up', accent: '#F472B6', accentHex: '#EC4899', isLpg: false },
  { key: 'REPORTS & ANALYTICS', defaultTitle: 'REPORTS & ANALYTICS', defaultIcon: 'chart-column', accent: '#38BDF8', accentHex: '#38BDF8', isLpg: false },
  { key: 'SYSTEM & SECURITY', defaultTitle: 'SYSTEM & SECURITY', defaultIcon: 'shield-check', accent: '#94A3B8', accentHex: '#94A3B8', isLpg: false }
];

export const FIXED_DEPARTMENTS = FIXED_11_DEPARTMENTS;

const PROTECTED_CORE_SUBMENUS = new Set(['dashboard', 'menu-management', 'admin-managers', 'admin-staff']);

function esc(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getDefaultMenuConfig() {
  return {
    departments: {},
    submenus: {},
    customSubmenus: []
  };
}

export function getMenuConfigLocal() {
  const saved = getItem(KEYS.MENU_CONFIG, null);
  if (!saved || typeof saved !== 'object') return getDefaultMenuConfig();
  return {
    departments: saved.departments && typeof saved.departments === 'object' ? saved.departments : {},
    submenus: saved.submenus && typeof saved.submenus === 'object' ? saved.submenus : {},
    customSubmenus: Array.isArray(saved.customSubmenus) ? saved.customSubmenus : [],
    updatedAt: saved.updatedAt,
    updatedByUid: saved.updatedByUid
  };
}

export function saveMenuConfigLocal(cfg) {
  setItem(KEYS.MENU_CONFIG, cfg || getDefaultMenuConfig());
}

export async function syncMenuConfigFromServer() {
  try {
    const user = getCurrentUser();
    if (!user) return getMenuConfigLocal();
    const resp = await fetch('/api/erp/menu-config', { headers: getAuthHeaders() });
    if (!resp.ok) return getMenuConfigLocal();
    const data = await resp.json();
    if (data?.success && data.menuConfig) {
      saveMenuConfigLocal(data.menuConfig);
      return data.menuConfig;
    }
  } catch {
    // offline fallback to cached local menu config
  }
  return getMenuConfigLocal();
}

async function persistMenuConfigToServer(nextConfig) {
  saveMenuConfigLocal(nextConfig);
  try {
    const resp = await fetch('/api/erp/menu-config', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(nextConfig)
    });
    const data = await resp.json();
    if (resp.ok && data?.success && data.menuConfig) {
      saveMenuConfigLocal(data.menuConfig);
      return { success: true, menuConfig: data.menuConfig, message: data.message };
    }
    return { success: false, message: data?.message || 'Failed to save menu configuration to server.' };
  } catch {
    return { success: false, message: 'Server unreachable; changes cached locally only.' };
  }
}

export function getDepartmentMeta(groupKey, cfg = null) {
  if (groupKey === 'ADMINISTRATION') {
    return {
      key: 'ADMINISTRATION',
      defaultTitle: 'ADMINISTRATION',
      title: 'ADMINISTRATION',
      defaultIcon: 'shield-check',
      iconName: 'shield-check',
      icon: getLucideIcon('shield-check', 17),
      accent: '#D6B56D',
      accentHex: '#D6B56D',
      isLpg: false
    };
  }
  const activeCfg = cfg || getMenuConfigLocal();
  const base = FIXED_11_DEPARTMENTS.find((d) => d.key === groupKey) || {
    key: groupKey,
    defaultTitle: groupKey,
    defaultIcon: 'folder',
    accent: '#60A5FA',
    accentHex: '#2456C7',
    isLpg: groupKey === 'LPG & GAS SERVICES'
  };
  const override = activeCfg.departments?.[groupKey] || {};
  const iconName = base.isLpg ? 'flame' : (override.icon || base.defaultIcon);
  return {
    ...base,
    title: (override.title || base.defaultTitle).trim() || base.defaultTitle,
    iconName,
    icon: getLucideIcon(iconName, 17)
  };
}

/**
 * Applies saved department names/icons, submenu label/icon/order/visibility overrides,
 * and custom submenus strictly within the 11 fixed departments + protected ADMINISTRATION section.
 */
export function applyMenuConfigToCatalog(baseCatalog, { includeDisabled = false } = {}) {
  const cfg = getMenuConfigLocal();
  const deptIndexMap = new Map(FIXED_11_DEPARTMENTS.map((d, idx) => [d.key, idx]));
  deptIndexMap.set('ADMINISTRATION', FIXED_11_DEPARTMENTS.length);

  const mappedBase = baseCatalog.map((item, idx) => {
    if (item.group === 'ADMINISTRATION') {
      return {
        ...item,
        defaultLabel: item.label,
        defaultIcon: item.icon,
        defaultOrder: idx,
        label: item.label,
        icon: item.icon,
        group: 'ADMINISTRATION',
        order: idx * 10,
        enabled: true,
        isCustom: false,
        isProtected: true
      };
    }
    const ov = cfg.submenus?.[item.id] || {};
    const targetGroup = FIXED_11_DEPARTMENTS.some((d) => d.key === ov.group) ? ov.group : item.group;
    const isProtected = PROTECTED_CORE_SUBMENUS.has(item.id);
    const enabled = isProtected ? true : ov.enabled !== false;
    return {
      ...item,
      defaultLabel: item.label,
      defaultIcon: item.icon,
      defaultOrder: idx,
      label: (ov.label || item.label).trim() || item.label,
      icon: (ov.icon || item.icon).trim() || item.icon,
      group: targetGroup,
      order: typeof ov.order === 'number' && Number.isFinite(ov.order) ? ov.order : idx * 10,
      enabled,
      isCustom: false,
      isProtected
    };
  });

  const customItems = (Array.isArray(cfg.customSubmenus) ? cfg.customSubmenus : [])
    .filter((c) => c && c.id && c.label && FIXED_11_DEPARTMENTS.some((d) => d.key === c.group))
    .map((c, idx) => ({
      id: c.id,
      label: c.label,
      defaultLabel: c.label,
      icon: c.icon || 'bookmark',
      defaultIcon: c.icon || 'bookmark',
      group: c.group,
      targetRoute: c.targetRoute || 'dashboard',
      customUrl: c.customUrl || '',
      description: c.description || '',
      keywords: c.keywords || c.label.toLowerCase(),
      order: typeof c.order === 'number' && Number.isFinite(c.order) ? c.order : 5000 + idx * 10,
      defaultOrder: 5000 + idx,
      enabled: c.enabled !== false,
      isCustom: true,
      isProtected: false
    }));

  const combined = [...mappedBase, ...customItems].filter((item) => includeDisabled || item.enabled !== false);

  combined.sort((a, b) => {
    const deptA = deptIndexMap.get(a.group) ?? 999;
    const deptB = deptIndexMap.get(b.group) ?? 999;
    if (deptA !== deptB) return deptA - deptB;
    if (a.order !== b.order) return a.order - b.order;
    return a.defaultOrder - b.defaultOrder;
  });

  return combined;
}

export function getCustomSubmenuById(routeId) {
  const cfg = getMenuConfigLocal();
  return (cfg.customSubmenus || []).find((c) => c.id === routeId) || null;
}

export function renderCustomMenuRouteView(routeId, { navigateTo }) {
  const entry = getCustomSubmenuById(routeId);
  if (!entry) {
    return `
      <div class="card" style="padding:2rem; text-align:center; max-width:560px; margin:2rem auto;">
        <h3>Custom Menu Not Found</h3>
        <p style="font-size:0.85rem; color:var(--text-muted); margin:0.65rem 0 1.25rem;">This custom submenu may have been removed or disabled by Administration.</p>
        <button type="button" class="btn btn-primary" onclick="window.MJK.navigateTo('dashboard')">Return to Dashboard</button>
      </div>
    `;
  }
  const deptMeta = getDepartmentMeta(entry.group);
  return `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="display:flex; align-items:center; gap:0.55rem;">
          <span style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9px; background:#EAF1FF; color:#2456C7;">
            ${getLucideIcon(entry.icon || 'bookmark', 18)}
          </span>
          <span>${esc(entry.label)}</span>
        </h1>
        <p class="page-subtitle">Department: ${esc(deptMeta.title)} · Custom Submenu Module</p>
      </div>
      <div class="page-actions">
        ${entry.targetRoute && entry.targetRoute !== 'custom-panel' ? `
          <button type="button" class="btn btn-primary" onclick="window.MJK.navigateTo('${esc(entry.targetRoute)}')">
            ${getLucideIcon('arrow-up-down', 15)} Open Linked Module (${esc(entry.targetRoute)})
          </button>
        ` : ''}
        <button type="button" class="btn btn-secondary" onclick="window.MJK.navigateTo('menu-management')">
          ${getLucideIcon('sliders', 15)} Configure Menus
        </button>
      </div>
    </div>

    <div class="card" style="padding:1.5rem;">
      <div style="display:flex; align-items:flex-start; gap:1rem; flex-wrap:wrap;">
        <div style="width:48px; height:48px; border-radius:12px; background:#EAF1FF; color:#2456C7; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${getLucideIcon(entry.icon || 'bookmark', 22)}
        </div>
        <div style="flex:1; min-width:220px;">
          <h3 style="font-size:1.05rem; margin-bottom:0.35rem;">${esc(entry.label)}</h3>
          <p style="font-size:0.86rem; color:var(--text-muted); line-height:1.55;">
            ${esc(entry.description || 'Authorized custom operational workspace configured under ' + deptMeta.title + '.')}
          </p>
          ${entry.customUrl ? `
            <div style="margin-top:0.85rem; padding:0.75rem 0.9rem; border-radius:8px; background:var(--surface-alt); border:1px solid var(--border-subtle); font-size:0.82rem;">
              <strong style="color:var(--text-main);">Reference Resource:</strong>
              <span class="font-mono" style="margin-left:0.35rem; color:#2456C7;">${esc(entry.customUrl)}</span>
            </div>
          ` : ''}
          <div style="margin-top:1rem; display:flex; gap:0.5rem; flex-wrap:wrap;">
            ${entry.targetRoute && entry.targetRoute !== 'custom-panel' ? `
              <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.navigateTo('${esc(entry.targetRoute)}')">Launch Target Module</button>
            ` : ''}
            <button type="button" class="btn btn-outline btn-sm" onclick="window.MJK.navigateTo('dashboard')">Back to Dashboard</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

let _selectedDeptKey = 'MAIN DASHBOARD';

export function renderMenuManagementView({ baseCatalog }) {
  const cfg = getMenuConfigLocal();
  if (!FIXED_11_DEPARTMENTS.some((d) => d.key === _selectedDeptKey)) {
    _selectedDeptKey = FIXED_11_DEPARTMENTS[0].key;
  }

  const allItems = applyMenuConfigToCatalog(baseCatalog, { includeDisabled: true });
  const selectedDeptMeta = getDepartmentMeta(_selectedDeptKey, cfg);
  const deptSubmenus = allItems.filter((item) => item.group === _selectedDeptKey);

  const uniqueRouteTargets = baseCatalog
    .filter((i) => i.id !== 'menu-management')
    .map((i) => ({ id: i.id, label: `${i.group} — ${i.label}` }));

  return `
    <div class="page-header">
      <div>
        <h1 class="page-title" style="display:flex; align-items:center; gap:0.55rem;">
          <span style="display:inline-flex; align-items:center; justify-content:center; width:34px; height:34px; border-radius:9px; background:#EAF1FF; color:#2456C7;">
            ${getLucideIcon('sliders', 18)}
          </span>
          <span>Menu &amp; Navigation Management</span>
        </h1>
        <p class="page-subtitle">
          Rename the ${FIXED_11_DEPARTMENTS.length} fixed departments, customize submenu names, reorder positions, change Lucide icons, toggle visibility, or add submenus live.
        </p>
      </div>
      <div class="page-actions">
        <button type="button" class="btn btn-secondary" onclick="window.MJK.openAddCustomSubmenuModal('${esc(_selectedDeptKey)}')">
          ${getLucideIcon('plus-circle', 15)} Add New Submenu
        </button>
        <button type="button" class="btn btn-outline" style="color:var(--danger); border-color:var(--danger-border);" onclick="window.MJK.confirmRestoreDefaultMenuStructure()">
          ${getLucideIcon('rotate-ccw', 15)} Restore Default Menu
        </button>
      </div>
    </div>

    <div class="card" style="margin-bottom:1.15rem; padding:0.9rem 1.1rem; background:#EAF1FF; border:1px solid #BFDBFE; color:#0B1530;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem; font-size:0.82rem;">
        <div style="display:flex; align-items:center; gap:0.55rem;">
          <span style="color:#2456C7; display:inline-flex;">${getLucideIcon('shield-check', 17)}</span>
          <span>
            <strong>Enterprise Structure Policy:</strong> The ${FIXED_11_DEPARTMENTS.length} primary departments and their top-level sequence are locked by corporate governance. All submenus and customizations persist centrally across users.
          </span>
        </div>
        ${cfg.updatedAt ? `<span class="font-mono" style="font-size:0.74rem; color:#2456C7;">Updated: ${esc(new Date(cfg.updatedAt).toLocaleString('en-IN'))}</span>` : ''}
      </div>
    </div>

    <div class="erp-grid-1-2" style="align-items:start;">
      <!-- Left Panel: Fixed ERP Departments -->
      <div class="card" style="padding:1rem;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:0.85rem; padding-bottom:0.6rem; border-bottom:1px solid var(--border-subtle);">
          <h3 style="font-size:0.92rem;">${FIXED_11_DEPARTMENTS.length} ERP Departments</h3>
          <span class="badge badge-info">Fixed Order</span>
        </div>
        <div style="display:flex; flex-direction:column; gap:0.4rem;">
          ${FIXED_11_DEPARTMENTS.map((dept, index) => {
            const meta = getDepartmentMeta(dept.key, cfg);
            const isSelected = dept.key === _selectedDeptKey;
            const subCount = allItems.filter((i) => i.group === dept.key).length;
            const enabledCount = allItems.filter((i) => i.group === dept.key && i.enabled !== false).length;
            return `
              <div style="display:flex; align-items:center; gap:0.45rem;">
                <button
                  type="button"
                  onclick="window.MJK.selectMenuMgmtDept('${esc(dept.key)}')"
                  style="flex:1; display:flex; align-items:center; justify-content:space-between; gap:0.5rem; padding:0.55rem 0.7rem; border-radius:9px; border:1px solid ${isSelected ? '#2456C7' : 'var(--border-subtle)'}; background:${isSelected ? '#EAF1FF' : 'var(--surface)'}; color:${isSelected ? '#2456C7' : 'var(--text-main)'}; text-align:left; cursor:pointer;"
                >
                  <span style="display:flex; align-items:center; gap:0.5rem; min-width:0;">
                    <span class="font-mono" style="font-size:0.7rem; opacity:0.65; width:16px;">${index + 1}.</span>
                    <span style="display:inline-flex; color:${dept.isLpg ? '#EF4444' : (isSelected ? '#2456C7' : dept.accentHex)};">${getLucideIcon(meta.iconName, 16)}</span>
                    <span style="font-size:0.78rem; font-weight:${isSelected ? '700' : '600'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(meta.title)}</span>
                  </span>
                  <span class="font-mono" style="font-size:0.7rem; color:var(--text-muted); flex-shrink:0;">${enabledCount}/${subCount}</span>
                </button>
                <button
                  type="button"
                  class="btn-icon"
                  title="Rename Department / Change Icon"
                  onclick="window.MJK.openEditDepartmentModal('${esc(dept.key)}')"
                >
                  ${getLucideIcon('edit-3', 14)}
                </button>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Right Panel: Department Rename + Submenus Editor -->
      <div class="card" style="padding:1.15rem;">
        <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.75rem; padding-bottom:0.9rem; margin-bottom:1rem; border-bottom:1px solid var(--border-subtle);">
          <div style="display:flex; align-items:center; gap:0.65rem;">
            <span style="width:36px; height:36px; border-radius:9px; background:${selectedDeptMeta.isLpg ? '#FEF2F2' : '#EAF1FF'}; color:${selectedDeptMeta.isLpg ? '#EF4444' : '#2456C7'}; display:inline-flex; align-items:center; justify-content:center;">
              ${getLucideIcon(selectedDeptMeta.iconName, 18)}
            </span>
            <div>
              <h3 style="font-size:1rem; margin:0;">${esc(selectedDeptMeta.title)}</h3>
              <div style="font-size:0.74rem; color:var(--text-muted);">
                Internal Department Key: <span class="font-mono">${esc(selectedDeptMeta.key)}</span> · ${deptSubmenus.length} submenus
              </div>
            </div>
          </div>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.MJK.openEditDepartmentModal('${esc(selectedDeptMeta.key)}')">
              ${getLucideIcon('edit-3', 14)} Rename Department
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.MJK.openAddCustomSubmenuModal('${esc(selectedDeptMeta.key)}')">
              ${getLucideIcon('plus', 14)} Add Submenu Here
            </button>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width:70px;">Pos</th>
                <th>Submenu Item</th>
                <th>Route / Target</th>
                <th style="text-align:center;">Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${deptSubmenus.map((item, idx) => `
                <tr style="${item.enabled === false ? 'opacity:0.58;' : ''}">
                  <td>
                    <div style="display:inline-flex; align-items:center; gap:0.2rem;">
                      <button
                        type="button"
                        class="btn-icon"
                        style="width:26px; height:26px;"
                        title="Move Up"
                        ${idx === 0 ? 'disabled' : ''}
                        onclick="window.MJK.moveSubmenuPosition('${esc(selectedDeptMeta.key)}', '${esc(item.id)}', -1)"
                      >${getLucideIcon('arrow-up', 13)}</button>
                      <button
                        type="button"
                        class="btn-icon"
                        style="width:26px; height:26px;"
                        title="Move Down"
                        ${idx === deptSubmenus.length - 1 ? 'disabled' : ''}
                        onclick="window.MJK.moveSubmenuPosition('${esc(selectedDeptMeta.key)}', '${esc(item.id)}', 1)"
                      >${getLucideIcon('arrow-down', 13)}</button>
                    </div>
                  </td>
                  <td>
                    <div style="display:flex; align-items:center; gap:0.55rem;">
                      <span style="width:28px; height:28px; border-radius:7px; background:var(--surface-alt); color:#2456C7; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0;">
                        ${getLucideIcon(item.icon, 15)}
                      </span>
                      <div>
                        <div style="font-weight:700; font-size:0.84rem; color:var(--text-main);">
                          ${esc(item.label)}
                          ${item.isCustom ? `<span class="badge badge-info" style="margin-left:0.35rem; font-size:0.65rem;">Custom</span>` : ''}
                          ${item.isProtected ? `<span class="badge badge-neutral" style="margin-left:0.35rem; font-size:0.65rem;">Core</span>` : ''}
                        </div>
                        ${item.defaultLabel !== item.label ? `<div style="font-size:0.7rem; color:var(--text-muted);">Default: ${esc(item.defaultLabel)}</div>` : ''}
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="font-mono" style="font-size:0.74rem; color:var(--text-muted);">${esc(item.isCustom ? (item.targetRoute || 'custom-panel') : item.id)}</span>
                  </td>
                  <td style="text-align:center;">
                    ${item.isProtected ? `
                      <span class="badge badge-success">Always Active</span>
                    ` : `
                      <button
                        type="button"
                        class="btn btn-sm ${item.enabled !== false ? 'btn-success' : 'btn-secondary'}"
                        style="padding:0.22rem 0.6rem; font-size:0.72rem;"
                        onclick="window.MJK.toggleSubmenuEnabled('${esc(item.id)}', ${item.enabled === false ? 'true' : 'false'})"
                      >
                        ${item.enabled !== false ? 'Enabled' : 'Disabled'}
                      </button>
                    `}
                  </td>
                  <td style="text-align:right; white-space:nowrap;">
                    <button
                      type="button"
                      class="btn btn-outline btn-sm"
                      onclick="window.MJK.openEditSubmenuModal('${esc(item.id)}')"
                    >${getLucideIcon('edit-3', 13)} Edit</button>
                    ${item.isCustom ? `
                      <button
                        type="button"
                        class="btn btn-danger btn-sm"
                        style="margin-left:0.25rem;"
                        onclick="window.MJK.deleteCustomSubmenu('${esc(item.id)}')"
                      >${getLucideIcon('trash-2', 13)}</button>
                    ` : ''}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <datalist id="erp-route-target-options">
      ${uniqueRouteTargets.map((t) => `<option value="${esc(t.id)}">${esc(t.label)}</option>`).join('')}
    </datalist>
  `;
}

function buildIconPickerHtml(inputId, currentIcon) {
  return `
    <div style="margin-top:0.45rem;">
      <input type="text" id="${esc(inputId)}" class="form-control" value="${esc(currentIcon)}" placeholder="Lucide icon name (e.g. layout-dashboard)" oninput="window.MJK.previewLucideIconInput('${esc(inputId)}')">
      <div id="${esc(inputId)}-grid" style="margin-top:0.5rem; max-height:165px; overflow-y:auto; display:grid; grid-template-columns:repeat(auto-fill, minmax(112px, 1fr)); gap:0.35rem; padding:0.5rem; background:var(--surface-alt); border:1px solid var(--border-subtle); border-radius:8px;">
        ${AVAILABLE_LUCIDE_ICONS.map((iconName) => `
          <button
            type="button"
            onclick="window.MJK.pickMenuIcon('${esc(inputId)}', '${esc(iconName)}')"
            style="display:flex; align-items:center; gap:0.35rem; padding:0.32rem 0.45rem; border-radius:6px; border:1px solid ${currentIcon === iconName ? '#2456C7' : 'var(--border-subtle)'}; background:${currentIcon === iconName ? '#EAF1FF' : 'var(--surface)'}; color:${currentIcon === iconName ? '#2456C7' : 'var(--text-main)'}; font-size:0.71rem; cursor:pointer; text-align:left; overflow:hidden;"
          >
            <span style="flex-shrink:0; display:inline-flex;">${getLucideIcon(iconName, 14)}</span>
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${esc(iconName)}</span>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

export function createMenuManagementHandlers({ getBaseCatalog, showToast, openModal, closeModal, showConfirmDialog, render }) {
  return {
    selectMenuMgmtDept: (deptKey) => {
      _selectedDeptKey = deptKey;
      render();
    },
    pickMenuIcon: (inputId, iconName) => {
      const inp = document.getElementById(inputId);
      if (inp) inp.value = iconName;
      const preview = document.getElementById(`${inputId}-preview`);
      if (preview) preview.innerHTML = getLucideIcon(iconName, 18);
      const grid = document.getElementById(`${inputId}-grid`);
      if (grid) {
        grid.querySelectorAll('button').forEach((btn) => {
          const isMatch = btn.textContent.trim() === iconName;
          btn.style.borderColor = isMatch ? '#2456C7' : 'var(--border-subtle)';
          btn.style.background = isMatch ? '#EAF1FF' : 'var(--surface)';
          btn.style.color = isMatch ? '#2456C7' : 'var(--text-main)';
        });
      }
    },
    previewLucideIconInput: (inputId) => {
      const val = document.getElementById(inputId)?.value?.trim() || 'circle';
      const preview = document.getElementById(`${inputId}-preview`);
      if (preview) preview.innerHTML = getLucideIcon(val, 18);
    },
    openEditDepartmentModal: (deptKey) => {
      const meta = getDepartmentMeta(deptKey);
      const isLpg = meta.isLpg;
      const content = `
        <form onsubmit="window.MJK.submitEditDepartment(event, '${esc(deptKey)}')">
          <div class="form-group">
            <label class="form-label">Department Display Name *</label>
            <input type="text" id="mm-dept-title" class="form-control" required maxlength="48" value="${esc(meta.title)}">
            <div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;">Internal Key: <span class="font-mono">${esc(deptKey)}</span> (Fixed ${FIXED_11_DEPARTMENTS.length}-department slot)</div>
          </div>
          ${isLpg ? `
            <div style="padding:0.75rem; border-radius:8px; background:#FEF2F2; border:1px solid #FECACA; color:#B91C1C; font-size:0.78rem; margin-bottom:1rem;">
              <strong>Corporate Brand Rule:</strong> LPG &amp; GAS SERVICES always retains its Red Flame icon (${getLucideIcon('flame', 14)}).
            </div>
          ` : `
            <div class="form-group">
              <label class="form-label" style="display:flex; align-items:center; gap:0.45rem;">
                <span>Department Lucide Icon</span>
                <span id="mm-dept-icon-preview" style="display:inline-flex; color:#2456C7;">${getLucideIcon(meta.iconName, 18)}</span>
              </label>
              ${buildIconPickerHtml('mm-dept-icon', meta.iconName)}
            </div>
          `}
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Department Changes</button>
          </div>
        </form>
      `;
      openModal(`Rename Department — ${meta.title}`, content, null);
    },
    submitEditDepartment: async (e, deptKey) => {
      e.preventDefault();
      const title = document.getElementById('mm-dept-title')?.value?.trim() || deptKey;
      const iconInput = document.getElementById('mm-dept-icon')?.value?.trim();
      const cfg = getMenuConfigLocal();
      cfg.departments = cfg.departments || {};
      cfg.departments[deptKey] = {
        title,
        ...(deptKey === 'LPG & GAS SERVICES' ? { icon: 'flame' } : iconInput ? { icon: iconInput } : {})
      };
      const res = await persistMenuConfigToServer(cfg);
      closeModal();
      showToast(res.success ? `Department "${title}" updated.` : res.message, res.success ? 'success' : 'warning');
      render();
    },
    openEditSubmenuModal: (subId) => {
      const baseCatalog = getBaseCatalog();
      const allItems = applyMenuConfigToCatalog(baseCatalog, { includeDisabled: true });
      const item = allItems.find((i) => i.id === subId);
      if (!item) return;

      const content = `
        <form onsubmit="window.MJK.submitEditSubmenu(event, '${esc(subId)}', ${item.isCustom ? 'true' : 'false'})">
          <div class="form-group">
            <label class="form-label">Submenu Name *</label>
            <input type="text" id="mm-sub-label" class="form-control" required maxlength="64" value="${esc(item.label)}">
          </div>
          <div class="form-group">
            <label class="form-label">Department</label>
            <select id="mm-sub-group" class="form-control">
              ${FIXED_11_DEPARTMENTS.map((d) => `<option value="${esc(d.key)}" ${item.group === d.key ? 'selected' : ''}>${esc(getDepartmentMeta(d.key).title)}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="display:flex; align-items:center; gap:0.45rem;">
              <span>Lucide Icon</span>
              <span id="mm-sub-icon-preview" style="display:inline-flex; color:#2456C7;">${getLucideIcon(item.icon, 18)}</span>
            </label>
            ${buildIconPickerHtml('mm-sub-icon', item.icon)}
          </div>
          ${item.isCustom ? `
            <div class="form-group">
              <label class="form-label">Target ERP Module Route</label>
              <input type="text" id="mm-sub-target" class="form-control font-mono" list="erp-route-target-options" value="${esc(item.targetRoute || 'custom-panel')}" placeholder="dashboard or custom-panel">
            </div>
            <div class="form-group">
              <label class="form-label">Description / Notes</label>
              <textarea id="mm-sub-desc" class="form-control" rows="2">${esc(item.description || '')}</textarea>
            </div>
          ` : ''}
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Submenu</button>
          </div>
        </form>
      `;
      openModal(`Edit Submenu — ${item.label}`, content, null);
    },
    submitEditSubmenu: async (e, subId, isCustom) => {
      e.preventDefault();
      const label = document.getElementById('mm-sub-label')?.value?.trim();
      const group = document.getElementById('mm-sub-group')?.value;
      const icon = document.getElementById('mm-sub-icon')?.value?.trim() || 'circle';
      if (!label) return;

      const cfg = getMenuConfigLocal();
      if (isCustom) {
        cfg.customSubmenus = (cfg.customSubmenus || []).map((c) => {
          if (c.id !== subId) return c;
          return {
            ...c,
            label,
            group: FIXED_11_DEPARTMENTS.some((d) => d.key === group) ? group : c.group,
            icon,
            targetRoute: document.getElementById('mm-sub-target')?.value?.trim() || c.targetRoute || 'dashboard',
            description: document.getElementById('mm-sub-desc')?.value?.trim() || ''
          };
        });
      } else {
        cfg.submenus = cfg.submenus || {};
        const prev = cfg.submenus[subId] || {};
        cfg.submenus[subId] = {
          ...prev,
          label,
          icon,
          ...(FIXED_11_DEPARTMENTS.some((d) => d.key === group) ? { group } : {})
        };
      }
      const res = await persistMenuConfigToServer(cfg);
      closeModal();
      showToast(res.success ? `Submenu "${label}" updated.` : res.message, res.success ? 'success' : 'warning');
      render();
    },
    openAddCustomSubmenuModal: (defaultDept = 'MAIN DASHBOARD') => {
      const baseCatalog = getBaseCatalog();
      const routeOpts = baseCatalog
        .filter((i) => i.id !== 'menu-management')
        .map((i) => `<option value="${esc(i.id)}">${esc(i.group)} → ${esc(i.label)} (#${esc(i.id)})</option>`)
        .join('');
      const content = `
        <form onsubmit="window.MJK.submitAddCustomSubmenu(event)">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">New Submenu Name *</label>
              <input type="text" id="mm-new-label" class="form-control" required maxlength="64" placeholder="e.g. Daily Dispatch Summary">
            </div>
            <div class="form-group">
              <label class="form-label">Parent Department (1 of ${FIXED_11_DEPARTMENTS.length}) *</label>
              <select id="mm-new-group" class="form-control" required>
                ${FIXED_11_DEPARTMENTS.map((d) => `<option value="${esc(d.key)}" ${d.key === defaultDept ? 'selected' : ''}>${esc(getDepartmentMeta(d.key).title)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Target Action / Linked ERP Route *</label>
            <select id="mm-new-target" class="form-control">
              <option value="custom-panel">Custom Workspace / Reference Card</option>
              ${routeOpts}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Description / Notes (Optional)</label>
            <input type="text" id="mm-new-desc" class="form-control" maxlength="200" placeholder="Purpose or quick instructions for counter staff">
          </div>
          <div class="form-group">
            <label class="form-label" style="display:flex; align-items:center; gap:0.45rem;">
              <span>Select Lucide Icon</span>
              <span id="mm-new-icon-preview" style="display:inline-flex; color:#2456C7;">${getLucideIcon('bookmark', 18)}</span>
            </label>
            ${buildIconPickerHtml('mm-new-icon', 'bookmark')}
          </div>
          <div style="display:flex; justify-content:flex-end; gap:0.5rem; margin-top:1.25rem;">
            <button type="button" class="btn btn-secondary" onclick="window.MJK.closeModal()">Cancel</button>
            <button type="submit" class="btn btn-primary">Add Submenu</button>
          </div>
        </form>
      `;
      openModal('Add New Submenu', content, null);
    },
    submitAddCustomSubmenu: async (e) => {
      e.preventDefault();
      const label = document.getElementById('mm-new-label')?.value?.trim();
      const group = document.getElementById('mm-new-group')?.value;
      const targetRoute = document.getElementById('mm-new-target')?.value || 'custom-panel';
      const description = document.getElementById('mm-new-desc')?.value?.trim() || '';
      const icon = document.getElementById('mm-new-icon')?.value?.trim() || 'bookmark';
      if (!label || !FIXED_11_DEPARTMENTS.some((d) => d.key === group)) return;

      const cfg = getMenuConfigLocal();
      cfg.customSubmenus = Array.isArray(cfg.customSubmenus) ? cfg.customSubmenus : [];
      const id = await allocateGlobalReference('CAT', { entityType: 'MENU_ITEM' });
      const user = getCurrentUser();

      cfg.customSubmenus.push({
        id,
        label,
        group,
        icon,
        targetRoute,
        description,
        order: 9999,
        enabled: true,
        keywords: `${label.toLowerCase()} ${group.toLowerCase()}`,
        createdAt: new Date().toISOString(),
        createdBy: user?.uid || user?.id || 'ADMIN'
      });

      _selectedDeptKey = group;
      const res = await persistMenuConfigToServer(cfg);
      closeModal();
      showToast(res.success ? `Added "${label}" under ${getDepartmentMeta(group).title}.` : res.message, res.success ? 'success' : 'warning');
      render();
    },
    toggleSubmenuEnabled: async (subId, nextEnabled) => {
      if (PROTECTED_CORE_SUBMENUS.has(subId)) {
        showToast('Core system navigation items cannot be disabled.', 'warning');
        return;
      }
      const cfg = getMenuConfigLocal();
      const isCustom = (cfg.customSubmenus || []).some((c) => c.id === subId);
      if (isCustom) {
        cfg.customSubmenus = cfg.customSubmenus.map((c) => (c.id === subId ? { ...c, enabled: Boolean(nextEnabled) } : c));
      } else {
        cfg.submenus = cfg.submenus || {};
        cfg.submenus[subId] = { ...(cfg.submenus[subId] || {}), enabled: Boolean(nextEnabled) };
      }
      const res = await persistMenuConfigToServer(cfg);
      showToast(res.success ? `Submenu ${nextEnabled ? 'enabled' : 'disabled'}.` : res.message, res.success ? 'success' : 'warning');
      render();
    },
    moveSubmenuPosition: async (deptKey, subId, delta) => {
      const baseCatalog = getBaseCatalog();
      const allItems = applyMenuConfigToCatalog(baseCatalog, { includeDisabled: true });
      const deptItems = allItems.filter((i) => i.group === deptKey);
      const currentIdx = deptItems.findIndex((i) => i.id === subId);
      const targetIdx = currentIdx + delta;
      if (currentIdx === -1 || targetIdx < 0 || targetIdx >= deptItems.length) return;

      const reordered = [...deptItems];
      const [moved] = reordered.splice(currentIdx, 1);
      reordered.splice(targetIdx, 0, moved);

      const cfg = getMenuConfigLocal();
      cfg.submenus = cfg.submenus || {};
      cfg.customSubmenus = Array.isArray(cfg.customSubmenus) ? cfg.customSubmenus : [];

      reordered.forEach((item, idx) => {
        const nextOrder = (idx + 1) * 10;
        if (item.isCustom) {
          cfg.customSubmenus = cfg.customSubmenus.map((c) => (c.id === item.id ? { ...c, order: nextOrder } : c));
        } else {
          cfg.submenus[item.id] = { ...(cfg.submenus[item.id] || {}), order: nextOrder };
        }
      });

      const res = await persistMenuConfigToServer(cfg);
      if (!res.success) showToast(res.message, 'warning');
      render();
    },
    deleteCustomSubmenu: (subId) => {
      showConfirmDialog(
        'Delete Custom Submenu',
        'Remove this custom submenu from the sidebar? Built-in ERP routes remain untouched.',
        async () => {
          const cfg = getMenuConfigLocal();
          cfg.customSubmenus = (cfg.customSubmenus || []).filter((c) => c.id !== subId);
          const res = await persistMenuConfigToServer(cfg);
          showToast(res.success ? 'Custom submenu deleted.' : res.message, res.success ? 'success' : 'warning');
          render();
        }
      );
    },
    confirmRestoreDefaultMenuStructure: () => {
      showConfirmDialog(
        'Restore Default Menu Structure',
        `Reset all department names, submenu labels, icon changes, visibility toggles, and custom submenus back to the default ${FIXED_11_DEPARTMENTS.length}-department ERP menu?`,
        async () => {
          const def = getDefaultMenuConfig();
          saveMenuConfigLocal(def);
          try {
            const resp = await fetch('/api/erp/menu-config/reset', { method: 'POST', headers: getAuthHeaders() });
            const data = await resp.json();
            if (resp.ok && data?.menuConfig) {
              saveMenuConfigLocal(data.menuConfig);
            }
          } catch {
            // offline fallback
          }
          showToast(`Default ${FIXED_11_DEPARTMENTS.length}-department ERP menu structure restored.`, 'success');
          render();
        }
      );
    }
  };
}
