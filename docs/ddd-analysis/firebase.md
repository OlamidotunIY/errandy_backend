# Firebase — DDD & EIP Analysis

## 1. Current Responsibility

Provides Firebase Admin SDK wrappers:

- **Storage**: `FirebaseStorageService` (line 1-100+) manages file uploads/downloads via Firebase Storage.
  - Stream upload: `uploadStream` (line 29-68) uploads file from stream, returns signed URL or public URL.
  - File deletion: `deleteFile` (line 70-73) deletes file from bucket.
  - Signed URLs: `getSignedUrl` (line 75-82) generates temporary download URLs.
- **Admin initialization**: `FirebaseAdminService` (not shown, but imported at line 5) initializes Firebase Admin SDK.

**Files**: `firebase-storage.service.ts` (~100+ lines), `firebase-admin.service.ts`, `firebase.module.ts`.

## 2. Bounded Context Assessment

**This is infrastructure**, NOT a bounded context.

- Firebase is a **technical adapter** for Google Cloud Platform services (Storage, Cloud Messaging, Auth).
- Firebase is a **cross-cutting concern** used by Chat (file uploads), Users (avatar uploads), etc.

**Verdict**: Firebase is an **infrastructure layer** (Ports & Adapters outer layer). Should remain as `infrastructure/firebase/` or `common/firebase/`.

## 3. Domain Model Audit

**No domain model** — Firebase is purely infrastructure.

- `FirebaseUploadOptions` (line 6-15), `FirebaseUploadResult` (line 17-21) are DTOs, not domain entities.
- No aggregates, no invariants, no business rules.

## 4. Layering Violations

**None** — Firebase service is correctly positioned as infrastructure.

- However, `FirebaseStorageService` is directly imported by `ChatService` (line 13 of chat.service.ts) — tightly coupled.
- Recommendation: Introduce `IFileStorageService` interface (port), `FirebaseStorageAdapter` as implementation (adapter).

## 5. Repository Pattern Gap

**Not applicable** — Firebase is infrastructure, not domain.

## 6. EIP Opportunities

**Adapter Pattern** (should be implemented):

- Current: `FirebaseStorageService` is tightly coupled to Firebase Storage (line 98-100+: `bucket.file(...)`).
- Recommendation: Extract `IFileStorageService` interface:
  - `FirebaseStorageAdapter` implements interface.
  - `S3StorageAdapter` as alternative (if migrating to AWS S3).
  - Allows switching storage providers without changing callers.

**Dead Letter / Retry**:

- `uploadStream` (line 29-68) can fail (Firebase timeout, stream error).
  - No retry — caller (ChatService) sees error and user must resend file.
  - Recommendation: Queue file uploads in BullMQ (retry 3x on transient failures).

**File Cleanup**:

- `deleteFile` (line 70-73) has `ignoreNotFound: true` — good (idempotent).
- However, if upload succeeds but DB insert fails (e.g., in ChatService), orphaned files remain in Firebase Storage.
- Recommendation: Track uploads in-flight, clean up orphaned files via scheduled job.

## 7. Cross-Cutting Concerns

**Error handling**:

- Throws `InternalServerErrorException` if Firebase not initialized (line 96-99) — good.
- Upload errors (line 35-53: stream errors) bubble up — caller handles.

**Logging**:

- No logging in FirebaseStorageService — should log uploads/deletes for audit trail.

**Validation**:

- No validation of file size, MIME type, or path (assumes caller validates).

## 8. GraphQL-Specific Notes

**Not applicable** — Firebase is infrastructure, not exposed via GraphQL (file uploads are handled via multipart/form-data or presigned URLs).

## 9. Target Structure

```
src/infrastructure/firebase/  # OR src/common/firebase/
  domain/
    IFileStorageService.ts          # Port (interface)

  infrastructure/
    adapters/
      FirebaseStorageAdapter.ts     # Adapter (implements IFileStorageService)
      S3StorageAdapter.ts           # Future: AWS S3 support
    firebase-admin.service.ts       # Initializes Firebase Admin SDK
    queues/
      FileUploadQueue.ts            # BullMQ queue for async file uploads (retry on failure)
```

## 10. Migration Risk & Priority

**Risk**: **LOW**

- Firebase is infrastructure — refactoring won't break domain logic.
- Current implementation is functional (no critical bugs).

**Priority**: **PHASE 3 (after core domain modules)**
**Rationale**:

1. Firebase is infrastructure — refactoring doesn't unlock domain modeling.
2. Queueing file uploads (BullMQ) can be done independently of domain refactoring.
3. Current implementation is simple and works — low urgency.

**Migration steps**:

1. **Extract IFileStorageService interface** (port).
2. **Rename FirebaseStorageService to FirebaseStorageAdapter** (adapter).
3. **Queue file uploads in BullMQ** (retry 3x on failure).
4. **Add file upload logging** (audit trail).
5. **Add orphaned file cleanup** (scheduled job to delete files not referenced in DB).
6. **Add file size/MIME validation** (prevent large/malicious uploads).

---

## 12. Implementation Spec

### Domain Layer

```typescript
/**
 * Value object for stored file metadata.
 * // TODO: No dedicated Prisma model exists for file metadata ownership.
 */
class StoredFile {
  constructor(
    public readonly path: string,
    public readonly contentType: string,
    public readonly sizeBytes: number,
    public readonly publicUrl: string | null,
  );

  /**
   * Validates file metadata before adapter upload.
   */
  validate(): void;
}

/**
 * Port for object storage operations.
 */
interface IFileStorageService {
  /**
   * Uploads stream/file bytes to provider storage and returns canonical metadata.
   */
  upload(file: StoredFile, body: NodeJS.ReadableStream | Buffer): Promise<StoredFile>;

  /**
   * Deletes object by storage path.
   */
  delete(path: string): Promise<void>;

  /**
   * Returns signed URL for temporary access.
   */
  getSignedUrl(path: string, expiresInSeconds: number): Promise<string>;
}
```

### Repository Interface

```typescript
/**
 * Optional persistence of upload audit entries.
 * // TODO: Decide whether to persist in WebhookEvent.data or a dedicated upload table.
 */
interface IFileAuditRepository {
  /**
   * Saves upload operation audit payload.
   */
  saveUploadAudit(entry: {
    path: string;
    contentType: string;
    sizeBytes: number;
    uploadedAt: Date;
  }): Promise<void>;
}
```

### Application Layer

```typescript
/**
 * Handles asynchronous file upload orchestration.
 */
class UploadFileCommandHandler {
  /**
   * Validates metadata, uploads file, and emits FileUploadedEvent.
   */
  execute(command: UploadFileCommand): Promise<StoredFile>;
}

interface UploadFileCommand {
  path: string;
  contentType: string;
  sizeBytes: number;
  body: NodeJS.ReadableStream | Buffer;
}
```

### Domain Events

```typescript
/**
 * Emitted when object storage upload succeeds.
 */
class FileUploadedEvent {
  constructor(
    public readonly path: string,
    public readonly contentType: string,
    public readonly sizeBytes: number,
  );
}

/**
 * Emitted when orphaned file cleanup job removes a stale file.
 */
class OrphanedFileDeletedEvent {
  constructor(
    public readonly path: string,
    public readonly deletedAt: Date,
  );
}
```
