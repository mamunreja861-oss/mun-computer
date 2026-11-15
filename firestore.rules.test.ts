/**
 * Security Rules Verification Spec for MUN COMPUTER ERP (Dirty Dozen Adversarial Matrix)
 * Verifies every collection in firebase-blueprint.json enforces Zero-Trust ABAC invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  actor: { uid: string; email: string; email_verified: boolean; isAdmin?: boolean };
  payload?: Record<string, unknown>;
  expectedOutcome: 'PERMISSION_DENIED';
  enforcedByRule: string;
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Identity Spoofing on Registration Request',
    collection: 'user_requests/REQ-2026-000099',
    operation: 'create',
    actor: { uid: 'uid-attacker', email: 'attacker@example.com', email_verified: true },
    payload: {
      requestId: 'REQ-2026-000099',
      ownerId: 'uid-victim',
      fullName: 'Attacker User',
      requestedRole: 'STAFF',
      district: 'Murshidabad',
      blockOrMunicipality: 'Domkal',
      villageOrWard: 'Mamudpur',
      pinCode: '742406',
      aadhaarMasked: 'XXXX-XXXX-1234',
      status: 'SUBMITTED'
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidUserRequest: data.ownerId == request.auth.uid'
  },
  {
    id: 2,
    name: 'Privilege Escalation on User Profile',
    collection: 'users/uid-attacker',
    operation: 'update',
    actor: { uid: 'uid-attacker', email: 'attacker@example.com', email_verified: true },
    payload: { role: 'ADMIN', status: 'ACTIVE', approvalStatus: 'APPROVED' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'users update tier checks affectedKeys().hasOnly([displayName, updatedAt]) for non-admins'
  },
  {
    id: 3,
    name: 'Shadow Field Injection on Service Catalog',
    collection: 'services/SRV-2026-000099',
    operation: 'create',
    actor: { uid: 'uid-admin', email: 'muncomputer786@gmail.com', email_verified: true, isAdmin: true },
    payload: {
      serviceId: 'SRV-2026-000099',
      name: 'Test Service',
      category: 'PAN Card',
      price: 100,
      status: 'ACTIVE',
      isDeleted: false,
      position: 1,
      ownerId: 'uid-admin',
      bypassAdminCheck: true
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidService: data.keys().hasOnly([...allowedKeys]) rejects ghost keys'
  },
  {
    id: 4,
    name: 'Unverified Email Spoof Attack',
    collection: 'user_requests/REQ-2026-000001',
    operation: 'update',
    actor: { uid: 'uid-spoof', email: 'muncomputer786@gmail.com', email_verified: false },
    payload: { status: 'APPROVED' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isVerifiedUser() mandates request.auth.token.email_verified == true'
  },
  {
    id: 5,
    name: 'PII Blanket Read Scrape',
    collection: 'users/uid-staff-1/private/info',
    operation: 'get',
    actor: { uid: 'uid-staff-2', email: 'staff2@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'users/{userId}/private/{docId} restricts read to isOwner(userId) || isAdmin()'
  },
  {
    id: 6,
    name: 'Unscoped List Query Scrape',
    collection: 'customers',
    operation: 'list',
    actor: { uid: 'uid-staff-2', email: 'staff2@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'customers allow list enforces resource.data.ownerId == request.auth.uid || isVerifiedBootstrapAdmin()'
  },
  {
    id: 7,
    name: 'Orphaned Application Injection',
    collection: 'applications/APP-2026-000099',
    operation: 'create',
    actor: { uid: 'uid-staff-1', email: 'staff1@example.com', email_verified: true },
    payload: {
      applicationId: 'APP-2026-000099',
      customerId: 'CUST-2026-999999',
      serviceId: 'SRV-2026-000001',
      serviceName: 'New PAN',
      status: 'New',
      ownerId: 'uid-staff-1'
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'exists(/databases/$(database)/documents/customers/$(incoming().customerId))'
  },
  {
    id: 8,
    name: 'Orphaned Document Upload',
    collection: 'documents/DOC-2026-000099',
    operation: 'create',
    actor: { uid: 'uid-staff-1', email: 'staff1@example.com', email_verified: true },
    payload: {
      documentId: 'DOC-2026-000099',
      applicationId: 'APP-2026-999999',
      customerId: 'CUST-2026-000001',
      fileName: 'id.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 1024,
      ownerId: 'uid-staff-1'
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'exists(/databases/$(database)/documents/applications/$(incoming().applicationId))'
  },
  {
    id: 9,
    name: 'Terminal State Bypass on Completed Application',
    collection: 'applications/APP-2026-000001',
    operation: 'update',
    actor: { uid: 'uid-staff-1', email: 'staff1@example.com', email_verified: true },
    payload: { status: 'Pending' },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: '!(existing().status in ["Completed", "Rejected", "Cancelled"]) || isAdmin()'
  },
  {
    id: 10,
    name: 'Client-Spoofed Timestamp Injection',
    collection: 'customers/CUST-2026-000005',
    operation: 'create',
    actor: { uid: 'uid-staff-1', email: 'staff1@example.com', email_verified: true },
    payload: {
      customerId: 'CUST-2026-000005',
      ownerId: 'uid-staff-1',
      name: 'Test Customer',
      phoneMasked: 'XXXXXX1234',
      district: 'Murshidabad',
      createdAt: '2020-01-01T00:00:00.000Z'
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'incoming().createdAt == request.time && incoming().updatedAt == request.time'
  },
  {
    id: 11,
    name: 'ID Poisoning / Oversized Document Key',
    collection: `customers/${'A'.repeat(250)}`,
    operation: 'create',
    actor: { uid: 'uid-staff-1', email: 'staff1@example.com', email_verified: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isValidId(customerId) limits id.size() <= 128 and regex ^[a-zA-Z0-9_\\-]+$'
  },
  {
    id: 12,
    name: 'Audit Log Tampering',
    collection: 'audit_logs/AUD-001',
    operation: 'delete',
    actor: { uid: 'uid-admin', email: 'muncomputer786@gmail.com', email_verified: true, isAdmin: true },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'audit_logs allow update, delete: if false;'
  },
  {
    id: 13,
    name: 'Non-Admin & Invalid PIN Injection on Murshidabad Villages',
    collection: 'murshidabad_villages/VIL-TEST-001',
    operation: 'create',
    actor: { uid: 'uid-staff-1', email: 'staff1@example.com', email_verified: true },
    payload: {
      villageId: 'VIL-TEST-001',
      district: 'Murshidabad',
      blockOrMunicipality: 'Domkal',
      villageOrLocality: 'Fake Village',
      pinCode: '742',
      areaType: 'RURAL',
      verificationStatus: 'VERIFIED',
      ownerId: 'uid-staff-1'
    },
    expectedOutcome: 'PERMISSION_DENIED',
    enforcedByRule: 'isAdmin() && isValidMurshidabadVillage(incoming()) enforces admin identity and 6-digit pinCode regex'
  }
];
