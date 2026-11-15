/**
 * projects.js - New Business Planning & Expansion Projects
 * MUN COMPUTER Business Manager
 */

import { getItem, setItem, KEYS, allocateGlobalReference, markGlobalReferenceDeleted, getTodayDate, logAuditAction } from './storage.js';

export const PROJECT_STAGES = [
  'Idea',
  'Research',
  'Planning',
  'Budget Preparation',
  'Approval',
  'Investment',
  'Setup',
  'Testing',
  'Launched',
  'Running',
  'On Hold',
  'Cancelled'
];

export function getAllProjects() {
  return getItem(KEYS.PROJECTS, []);
}

export async function saveProject(data) {
  const projects = getAllProjects();
  const reqInv = Number(data.requiredInvestment) || 0;
  const expRev = Number(data.expectedMonthlyRevenue) || 0;
  const expExp = Number(data.expectedMonthlyExpenses) || 0;
  const expProfit = expRev - expExp;

  if (data.id) {
    const index = projects.findIndex(p => p.id === data.id);
    if (index !== -1) {
      projects[index] = {
        ...projects[index],
        ...data,
        requiredInvestment: reqInv,
        expectedMonthlyRevenue: expRev,
        expectedMonthlyExpenses: expExp,
        expectedProfit: expProfit,
        updatedAt: new Date().toISOString()
      };
      setItem(KEYS.PROJECTS, projects);
      logAuditAction('PROJECT_UPDATE', `Updated business project: ${projects[index].name}`);
      return { success: true, project: projects[index] };
    }
  }

  const projectId = await allocateGlobalReference('PRJ', { entityType: 'PROJECT' });
  const newProject = {
    id: projectId,
    name: data.name || 'New Project Venture',
    category: data.category || 'General Business',
    description: data.description || '',
    marketOpportunity: data.marketOpportunity || '',
    requiredInvestment: reqInv,
    expectedMonthlyRevenue: expRev,
    expectedMonthlyExpenses: expExp,
    expectedProfit: expProfit,
    launchDate: data.launchDate || getTodayDate(),
    deadline: data.deadline || getTodayDate(),
    responsiblePerson: data.responsiblePerson || 'Admin',
    priority: data.priority || 'High',
    stage: data.stage || 'Planning',
    status: data.status || 'Active',
    notes: data.notes || '',
    createdAt: new Date().toISOString()
  };

  projects.unshift(newProject);
  setItem(KEYS.PROJECTS, projects);
  logAuditAction('PROJECT_CREATE', `Created new business project: ${newProject.name} (${newProject.id})`);
  return { success: true, project: newProject };
}

export function deleteProject(id) {
  const projects = getAllProjects();
  const updated = projects.filter(p => p.id !== id);
  setItem(KEYS.PROJECTS, updated);
  markGlobalReferenceDeleted(id, 'DELETED');
  logAuditAction('PROJECT_DELETE', `Deleted project record ${id}`);
  return { success: true };
}
