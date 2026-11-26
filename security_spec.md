# Security Specification — fawzy.ai Firestore Rules

## 1. Data Invariants
1. All access to user profiles, chats, and messages requires an authenticated user with a verified email (`request.auth != null && request.auth.token.email_verified == true`).
2. A `UserProfile` document at `/users/{userId}` can only be read, created, or updated by the verified owner whose `request.auth.uid == userId`. No other user may read another user's email or profile.
3. A `ChatSession` at `/users/{userId}/chats/{chatId}` belongs strictly to `userId` (`ownerUid == request.auth.uid == userId`), and its `ownerUid`, `id`, and `createdAt` are immutable after creation.
4. A `ChatMessage` at `/users/{userId}/chats/{chatId}/messages/{messageId}` requires the parent `ChatSession` to exist and belong to `request.auth.uid` (Master Gate `get()` / `exists()`), and cannot be written without matching `ownerUid == request.auth.uid`.
5. All document IDs (`userId`, `chatId`, `messageId`) must match `^[a-zA-Z0-9_\-]+$` and be at most 128 characters.
6. All `createdAt` and `updatedAt` timestamps must match `request.time`.
7. No extra ("ghost") keys or privilege-escalation fields (`role`, `isAdmin`) are accepted on any write.

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated Profile Read:** Unauthenticated `get(/users/userA)`.
2. **Unverified Email Profile Create/Read:** Authenticated user `userA` with `email_verified: false` attempting `get(/users/userA)` or `create(/users/userA)`.
3. **Cross-User Profile Read (PII Leak):** Verified User B reading `/users/userA` (contains email).
4. **Identity Spoofing on Profile Create:** Verified User B creating `/users/userA` or setting `uid: "userA"` on `/users/userB`.
5. **Ghost Field / Privilege Escalation:** Verified User A creating `/users/userA` with extra field `isAdmin: true`.
6. **Immutable Field Tampering on Update:** Verified User A updating `/users/userA` with modified `uid` or `createdAt`.
7. **Oversized String Poisoning:** Verified User A writing `username` of length 500 chars (`maxLength: 32`) or `customInstructions` of length 2000 chars (`maxLength: 500`).
8. **Client-Forged Timestamp:** Verified User A creating `/users/userA/chats/chat1` with `createdAt` set to a past client date instead of `request.time`.
9. **Invalid ID Poisoning:** Verified User A creating `/users/userA/chats/bad$id!with#chars`.
10. **Cross-User Chat List Scraping:** Verified User B listing `/users/userA/chats`.
11. **Orphaned Message Write:** Verified User A writing `/users/userA/chats/nonexistentChat/messages/msg1` where parent chat does not exist.
12. **Invalid Message Role & Undeclared Collection Write:** Verified User A writing message with `role: "system"`, or writing to undeclared path `/admin/config`.
