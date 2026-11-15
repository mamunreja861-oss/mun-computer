# MUN COMPUTER ERP (`MUNCM-2026`) — Firestore Security Specification (Phase 0)

## 1. Core Data Invariants
1. **Default Deny**: All unspecified Firestore paths deny read and write (`match /{document=**} { allow read, write: if false; }`).
2. **Verified Identity**: All client write operations require `request.auth != null && request.auth.token.email_verified == true`.
3. **No Self-Assigned Privileges**: Users cannot create `/admins/{id}`, cannot set `role` to `ADMIN` or `MANAGER` on `/users/{userId}`, and cannot approve their own `/user_requests/{requestId}`.
4. **Split PII Isolation**: Sensitive attributes (`phoneMasked`, `aadhaarMasked`, `email`, `address`) live in `/users/{userId}/private/{docId}` and are readable only by the verified owner or verified admin.
5. **Relational Integrity**:
   - `/applications/{applicationId}` requires `exists(/databases/$(database)/documents/customers/$(incoming().customerId))` and `exists(/databases/$(database)/documents/services/$(incoming().serviceId))`.
   - `/documents/{documentId}` requires parent `/applications/{applicationId}` and `/customers/{customerId}` existence.
6. **Terminal State Locking**: Once an `application` reaches terminal state (`Completed`, `Rejected`, `Cancelled`) or a `user_request` reaches `APPROVED` or `REJECTED`, non-admin clients cannot mutate it.
7. **Temporal & Immutable Integrity**: `createdAt` must equal `request.time` on creation and never change on update; `updatedAt` must equal `request.time` on updates; `ownerId` is immutable after creation.
8. **Zero Blanket List Reads**: Every `allow list` rule evaluates `resource.data` directly without `get()`/`exists()`.
9. **Audit Immutability**: `/audit_logs/{logId}` is append-only (`allow update, delete: if false;`).
10. **Murshidabad Village Directory Integrity**: `/murshidabad_villages/{villageId}` strictly validates `district`, `blockOrMunicipality`, `villageOrLocality`, 6-digit `pinCode` (`^[0-9]{6}$`), restricts create/update/delete to verified admins (`isAdmin()`), and keeps `ownerId` and `createdAt` immutable.

## 2. The "Dirty Dozen" Attack Payloads (Expected: PERMISSION_DENIED)
1. **Identity Spoofing on Registration Request**: User `uid-attacker` submits `/user_requests/REQ-2026-000099` with `ownerId: "uid-victim"`.
2. **Privilege Escalation on User Profile**: Non-admin user updates `/users/uid-attacker` with `role: "ADMIN"`, `status: "ACTIVE"`.
3. **Shadow Field Injection on Service Catalog**: Client creates `/services/SRV-2026-000099` with extra ghost field `bypassAdminCheck: true`.
4. **Unverified Email Spoof Attack**: User with `email: "muncomputer786@gmail.com"` and `email_verified: false` tries to approve `/user_requests/REQ-2026-000001`.
5. **PII Blanket Read Scrape**: Authenticated `uid-staff-2` attempts `get` on `/users/uid-staff-1/private/info`.
6. **Unscoped List Query Scrape**: `uid-staff-2` issues unfiltered `list` on `/customers` without `where('ownerId', '==', 'uid-staff-2')`.
7. **Orphaned Application Injection**: User creates `/applications/APP-2026-000099` referencing nonexistent `customerId: "CUST-2026-999999"`.
8. **Orphaned Document Upload**: User creates `/documents/DOC-2026-000099` referencing nonexistent `applicationId: "APP-2026-999999"`.
9. **Terminal State Bypass**: Non-admin user updates an application whose `status` is `"Completed"` back to `"Pending"`.
10. **Client-Spoofed Timestamp**: Client creates `/customers/CUST-2026-000005` with forged `createdAt: "2020-01-01T00:00:00Z"` instead of server `request.time`.
11. **ID Poisoning / Resource Exhaustion**: Client attempts write to `/customers/` with a 1,500-character document ID containing `$`/spaces.
12. **Audit Log Tampering**: Even an authenticated admin attempts `delete` or `update` on `/audit_logs/AUD-001`.
13. **Non-Admin / Malformed PIN Injection in Murshidabad Villages**: Staff user or attacker with invalid 4-digit PIN attempts write/delete on `/murshidabad_villages/VIL-TEST-001`.
