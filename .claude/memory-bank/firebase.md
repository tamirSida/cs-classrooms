# Firebase Configuration

## Collections Schema

### users
```typescript
{
  id: string;                    // Firebase Auth UID
  email: string;
  displayName: string;
  role: 'super_admin' | 'admin' | 'student';
  assignedClassrooms: string[];  // Classroom IDs (for admins)
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;             // User ID who created this user
  isActive: boolean;
}
```

### classrooms
```typescript
{
  id: string;
  name: string;
  description?: string;
  config: {
    permissions: 'admin_only' | 'student';  // Who can book
    maxTimePerDay: number;                   // Minutes per student per day (0 = use global)
    requiresApproval: boolean;               // Instant or pending approval
    isActive: boolean;
  };
  assignedAdmins: string[];      // User IDs
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### bookings
```typescript
{
  id: string;
  classroomId: string;
  userId: string;                // Who made the booking
  userEmail: string;             // Denormalized for display
  userName: string;              // Denormalized for display
  date: string;                  // YYYY-MM-DD format
  startTime: string;             // HH:mm format (24h)
  endTime: string;               // HH:mm format (24h)
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Timestamp;
  updatedAt: Timestamp;
  cancelledAt?: Timestamp;
  cancelledBy?: string;
}
```

### settings (single document)
```typescript
{
  id: 'global';
  operatingHours: {
    start: string;               // HH:mm format (e.g., "08:00")
    end: string;                 // HH:mm format (e.g., "18:00")
  };
  defaultMaxTimePerDay: number;  // Default minutes per student per day
  timeSlotDuration: 15;          // Minutes (fixed at 15)
  updatedAt: Timestamp;
  updatedBy: string;
}
```

## Firestore Indexes

### Composite Indexes Required:
1. `bookings`: classroomId ASC, date ASC, startTime ASC
2. `bookings`: userId ASC, date ASC
3. `bookings`: classroomId ASC, status ASC, date ASC

## Security Rules Structure

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }

    function getUserRole() {
      return get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
    }

    function isSuperAdmin() {
      return isAuthenticated() && getUserRole() == 'super_admin';
    }

    function isAdmin() {
      return isAuthenticated() && getUserRole() in ['super_admin', 'admin'];
    }

    // Users collection
    match /users/{userId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }

    // Classrooms collection
    match /classrooms/{classroomId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }

    // Bookings collection
    match /bookings/{bookingId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update: if isAuthenticated() &&
        (resource.data.userId == request.auth.uid || isAdmin());
      allow delete: if isSuperAdmin();
    }

    // Settings collection
    match /settings/{settingId} {
      allow read: if isAuthenticated();
      allow write: if isSuperAdmin();
    }
  }
}
```

## Firebase Auth Configuration
- Email/Password authentication enabled
- Admin SDK used for user creation (admin-only flow)
- Custom claims for role management (optional optimization)
