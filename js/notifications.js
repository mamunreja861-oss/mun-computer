/**
 * notifications.js - Live Database-Backed Notifications & Dynamic Sidebar Badge Engine
 * MUN COMPUTER BUSINESS MANAGER
 */

import { getItem, KEYS, getTodayDate, formatINR } from './storage.js';
import { getCurrentUser } from './auth.js';

function daysBetween(startDate, endDate) {
  const s = new Date(`${String(startDate || '').slice(0, 10)}T00:00:00Z`);
  const e = new Date(`${String(endDate || '').slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return 9999;
  return Math.round((e.getTime() - s.getTime()) / 86400000);
}

/**
 * Compute all dynamic badge counters strictly from actual stored database records.
 * Never returns hardcoded numbers.
 */
export function getDynamicNavBadgeCounts(user = null) {
  const activeUser = user || getCurrentUser();
  const role = String(activeUser?.role || 'STAFF').toUpperCase();
  const selfUid = String(activeUser?.uid || activeUser?.id || '').trim().toUpperCase();
  const isPrivileged = role === 'ADMIN' || role === 'MANAGER' || activeUser?.isSuperAdmin === true;
  const today = getTodayDate();

  const leaves = getItem(KEYS.LEAVES, []);
  const pendingLeaves = leaves.filter((l) => {
    if (String(l.status || '') !== 'Pending') return false;
    return isPrivileged || String(l.employeeId || '').trim().toUpperCase() === selfUid;
  }).length;

  const users = getItem(KEYS.USERS, []);
  const pendingApprovals = isPrivileged
    ? users.filter((u) => u.status === 'PENDING_APPROVAL' || u.status === 'CORRECTION_REQUIRED').length
    : 0;

  const recruitment = getItem(KEYS.RECRUITMENT, []);
  const pendingJobApps = isPrivileged
    ? recruitment.filter((r) => ['Applied', 'Shortlisted', 'Pending', 'Interview'].includes(String(r.status || ''))).length
    : 0;

  const tasks = getItem(KEYS.TASKS, []);
  const scopedTasks = isPrivileged
    ? tasks
    : tasks.filter((t) => !t.assignedTo || String(t.assignedTo).trim().toUpperCase() === selfUid);
  const incompleteTasks = scopedTasks.filter((t) => String(t.status || '') !== 'Completed').length;
  const overdueTasks = scopedTasks.filter(
    (t) => String(t.status || '') !== 'Completed' && t.dueDate && String(t.dueDate).slice(0, 10) < today
  ).length;

  const inventory = getItem(KEYS.INVENTORY, []);
  const lowInventory = inventory.filter((item) => {
    const qty = Number(item.quantity ?? item.stockQty ?? 0);
    const min = Number(item.minStockLevel ?? item.reorderLevel ?? 5);
    return qty <= min;
  }).length;

  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);
  const gasCollections = getItem(KEYS.GAS_COLLECTIONS, []);
  const pendingServiceDues = services.filter((s) => Number(s.dueAmount) > 0).length;
  const pendingInvoiceDues = invoices.filter((i) => Number(i.balanceDue) > 0).length;
  const pendingGasDues = gasCollections.filter((g) => Number(g.dueAmount) > 0).length;
  const pendingPayments = pendingServiceDues + pendingInvoiceDues + pendingGasDues;

  const gasBookings = getItem(KEYS.GAS_BOOKINGS, []);
  const unprocessedGasBookings = gasBookings.filter((b) =>
    ['Booked', 'Pending', 'Assigned', 'Out for Delivery'].includes(String(b.status || 'Booked'))
  ).length;

  const annapurnaApps = getItem(KEYS.ANNAPURNA_APPLICATIONS, []);
  const unprocessedApplications = annapurnaApps.filter((a) =>
    !['Completed', 'Approved', 'Rejected', 'Cancelled', 'Closed'].includes(String(a.currentStatus || a.status || 'Submitted'))
  ).length;
  const unprocessedBookings = unprocessedGasBookings + unprocessedApplications;

  const grievances = getItem(KEYS.GRIEVANCES, []);
  const followups = getItem(KEYS.FOLLOWUPS, []);
  const followupCases = getItem(KEYS.FOLLOWUP_CASES, []);
  const overdueFollowups =
    followups.filter((f) => f.status === 'Pending' && f.nextFollowupDate && f.nextFollowupDate < today).length +
    followupCases.filter((c) => {
      const st = String(c.currentStatus || '');
      if (['Completed', 'Closed', 'Approved', 'Rejected', 'Cancelled'].includes(st)) return false;
      return Boolean(c.nextFollowupDate && String(c.nextFollowupDate).slice(0, 10) < today);
    }).length;

  const gasBookingsComplaints = getItem(KEYS.GAS_AUDIT_LOGS, []).filter((x) => x.type === 'COMPLAINT' && x.status !== 'Resolved').length;
  const pendingComplaints =
    grievances.filter((g) => !['Resolved', 'Closed'].includes(String(g.status || 'Open'))).length +
    gasBookingsComplaints;

  const docs = getItem(KEYS.DOCUMENTS, []);
  const prefs = getItem(KEYS.NOTIFICATION_PREFS, { docExpiryDays: 30 });
  const expiryWindow = Math.max(1, Number(prefs?.docExpiryDays) || 30);
  const expiringDocs = docs.filter((d) => {
    if (!d.expiryDate) return false;
    const diff = daysBetween(today, d.expiryDate);
    return diff <= expiryWindow;
  }).length;

  return {
    pendingLeaves,
    pendingApprovals,
    pendingJobApps,
    incompleteTasks,
    overdueTasks,
    lowInventory,
    pendingPayments,
    unprocessedGasBookings,
    unprocessedApplications,
    unprocessedBookings,
    pendingComplaints,
    overdueFollowups,
    expiringDocs,
    totalPendingActivities:
      pendingLeaves +
      pendingApprovals +
      incompleteTasks +
      lowInventory +
      pendingPayments +
      unprocessedBookings +
      pendingComplaints
  };
}

/**
 * Compute active system alerts, reminders, and urgent notifications
 */
export function getSystemNotifications() {
  const notifications = [];
  const today = getTodayDate();
  const counts = getDynamicNavBadgeCounts();
  const followups = getItem(KEYS.FOLLOWUPS, []);
  const services = getItem(KEYS.SERVICES, []);
  const invoices = getItem(KEYS.INVOICES, []);
  const tasks = getItem(KEYS.TASKS, []);
  const docs = getItem(KEYS.DOCUMENTS, []);
  const leaves = getItem(KEYS.LEAVES, []);
  const inventory = getItem(KEYS.INVENTORY, []);
  const smartReminders = getItem(KEYS.REMINDERS, []);

  // 1. Pending Leave Approvals
  leaves
    .filter((l) => l.status === 'Pending')
    .slice(0, 5)
    .forEach((l) => {
      notifications.push({
        id: `notif-lv-${l.id}`,
        type: 'warning',
        category: 'Leave Approval',
        title: `Leave Pending: ${l.employeeName || l.employeeId}`,
        message: `${l.leaveType} (${l.fromDate} to ${l.toDate}, ${l.days || 1}d) awaiting approval`,
        route: 'leave-management',
        itemId: l.id,
        date: l.fromDate
      });
    });

  // 2. Pending Employee/Account Approvals
  if (counts.pendingApprovals > 0) {
    notifications.push({
      id: 'notif-admin-staff',
      type: 'warning',
      category: 'Administration',
      title: `${counts.pendingApprovals} Pending User/Employee Request(s)`,
      message: 'Review staff/manager accounts under ADMINISTRATION.',
      route: 'admin-staff',
      date: today
    });
  }

  // 3. Overdue Follow-ups
  followups.forEach((f) => {
    if (f.status === 'Pending' && f.nextFollowupDate && f.nextFollowupDate < today) {
      notifications.push({
        id: `notif-flw-${f.id}`,
        type: 'danger',
        category: 'Overdue Follow-up',
        title: `Overdue Call: ${f.customerName}`,
        message: `${f.reason} (Due: ${f.nextFollowupDate})`,
        route: 'followups',
        itemId: f.id,
        date: f.nextFollowupDate
      });
    } else if (f.status === 'Pending' && f.nextFollowupDate === today) {
      notifications.push({
        id: `notif-flw-today-${f.id}`,
        type: 'warning',
        category: "Today's Follow-up",
        title: `Today's Callback: ${f.customerName}`,
        message: `${f.reason} scheduled for today`,
        route: 'followups',
        itemId: f.id,
        date: f.nextFollowupDate
      });
    }
  });

  // 3b. Active Smart 90-Day Case Reminders
  smartReminders.forEach((r) => {
    if (r.enabled !== false && r.status !== 'DONE' && r.reminderDate && r.reminderDate <= today) {
      const isOverdue = r.reminderDate < today;
      notifications.push({
        id: `notif-rem-${r.id}`,
        type: isOverdue ? 'danger' : 'warning',
        category: isOverdue ? 'Overdue 90-Day Reminder' : 'Today 90-Day Milestone',
        title: `Case ${r.applicationId || r.caseId}: ${r.customerName || 'Customer'}`,
        message: `Day ${r.milestoneDay || '-'} Milestone (${r.reminderDate}) · ${r.note || 'Follow-up call required'}`,
        route: 'followups',
        itemId: r.id,
        date: r.reminderDate
      });
    }
  });

  // 4. Low Stock Alerts
  inventory.forEach((item) => {
    const qty = Number(item.quantity ?? item.stockQty ?? 0);
    const min = Number(item.minStockLevel ?? item.reorderLevel ?? 5);
    if (qty <= min) {
      notifications.push({
        id: `notif-stk-${item.id}`,
        type: qty === 0 ? 'danger' : 'warning',
        category: 'Low Inventory',
        title: `Low Stock: ${item.itemName || item.name || item.id}`,
        message: `Remaining ${qty} ${item.unit || 'Pcs'} (Min: ${min})`,
        route: 'low-stock-alerts',
        itemId: item.id,
        date: today
      });
    }
  });

  // 5. Pending Customer Dues
  services.forEach((s) => {
    if (Number(s.dueAmount) > 0) {
      notifications.push({
        id: `notif-srv-due-${s.id}`,
        type: 'warning',
        category: 'Payment Due',
        title: `Due on Service: ${s.customerName}`,
        message: `Pending Balance: ${formatINR(s.dueAmount)} for ${s.serviceName}`,
        route: 'payments',
        itemId: s.id,
        date: s.appDate
      });
    }
  });

  invoices.forEach((inv) => {
    if (Number(inv.balanceDue) > 0) {
      notifications.push({
        id: `notif-inv-due-${inv.id}`,
        type: 'warning',
        category: 'Invoice Unpaid',
        title: `Unpaid Invoice #${inv.id}`,
        message: `${inv.customerName} owes ${formatINR(inv.balanceDue)}`,
        route: 'invoices',
        itemId: inv.id,
        date: inv.date
      });
    }
  });

  // 6. Document Expiries
  docs.forEach((d) => {
    if (d.expiryDate) {
      const diff = daysBetween(today, d.expiryDate);
      if (diff <= 30 && diff >= 0) {
        notifications.push({
          id: `notif-doc-${d.id}`,
          type: 'info',
          category: 'Document Expiry',
          title: `Expiring Soon: ${d.title}`,
          message: `Expires in ${diff} days (${d.expiryDate})`,
          route: 'documents',
          itemId: d.id,
          date: d.expiryDate
        });
      } else if (diff < 0) {
        notifications.push({
          id: `notif-doc-exp-${d.id}`,
          type: 'danger',
          category: 'Document Expired',
          title: `EXPIRED: ${d.title}`,
          message: `Expired ${Math.abs(diff)} days ago (${d.expiryDate})`,
          route: 'documents',
          itemId: d.id,
          date: d.expiryDate
        });
      }
    }
  });

  // 7. Pending & Overdue Tasks
  tasks.forEach((t) => {
    if (t.status !== 'Completed') {
      const isOverdue = t.dueDate && t.dueDate < today;
      if (isOverdue || t.dueDate === today) {
        notifications.push({
          id: `notif-tsk-${t.id}`,
          type: isOverdue ? 'danger' : 'info',
          category: isOverdue ? 'Overdue Task' : 'Task Due',
          title: `Task: ${t.title}`,
          message: `${isOverdue ? 'OVERDUE' : 'Due today'} (${t.dueDate}) - Assigned: ${t.assignedToName || t.assignedTo}`,
          route: 'tasks',
          itemId: t.id,
          date: t.dueDate
        });
      }
    }
  });

  // Sort urgent dangers first, then warnings, then info
  const priority = { danger: 0, warning: 1, info: 2 };
  notifications.sort((a, b) => (priority[a.type] ?? 3) - (priority[b.type] ?? 3));

  return notifications;
}

/**
 * Helper to check exact scheduled reminder time matches
 */
export function checkDueDateTimeReminders() {
  const followups = getItem(KEYS.FOLLOWUPS, []);
  const now = new Date();
  const today = getTodayDate();
  const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  return followups.filter((f) => {
    if (f.status !== 'Pending') return false;
    if (f.nextFollowupDate === today && f.reminderTime) {
      return f.reminderTime <= currentTime;
    }
    return false;
  });
}
