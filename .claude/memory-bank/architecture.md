# Architecture & High-Level Design

## Directory Structure

```
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Auth routes (login)
│   ├── (dashboard)/              # Protected routes
│   │   ├── calendar/             # Booking calendar view
│   │   ├── classrooms/           # Classroom management
│   │   ├── users/                # User management
│   │   └── settings/             # Global settings
│   ├── api/                      # API routes
│   │   ├── bookings/
│   │   ├── classrooms/
│   │   └── users/
│   └── layout.tsx
├── lib/
│   ├── firebase/                 # Firebase configuration
│   │   ├── config.ts
│   │   ├── auth.ts
│   │   └── firestore.ts
│   ├── services/                 # Business logic layer
│   │   ├── BookingService.ts
│   │   ├── ClassroomService.ts
│   │   ├── UserService.ts
│   │   └── EmailService.ts
│   ├── repositories/             # Data access layer
│   │   ├── BaseRepository.ts
│   │   ├── BookingRepository.ts
│   │   ├── ClassroomRepository.ts
│   │   └── UserRepository.ts
│   ├── models/                   # Domain models/interfaces
│   │   ├── Booking.ts
│   │   ├── Classroom.ts
│   │   ├── User.ts
│   │   └── Settings.ts
│   ├── validators/               # Input validation
│   └── utils/                    # Shared utilities
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── calendar/                 # Calendar components
│   ├── forms/                    # Form components
│   └── layout/                   # Layout components
├── hooks/                        # Custom React hooks
├── contexts/                     # React contexts
└── types/                        # TypeScript types
```

## High-Level Design (HLD)

```
┌─────────────────────────────────────────────────────────────────┐
│                        PRESENTATION LAYER                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Calendar   │  │  Classroom  │  │    User Management      │  │
│  │    View     │  │   Config    │  │        (Admin)          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API LAYER (Next.js)                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  /api/      │  │  /api/      │  │      /api/users         │  │
│  │  bookings   │  │  classrooms │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       SERVICE LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐  │
│  │  Booking    │  │  Classroom  │  │    User     │  │ Email  │  │
│  │  Service    │  │   Service   │  │   Service   │  │Service │  │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      REPOSITORY LAYER                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    BaseRepository<T>                        ││
│  │         (Generic CRUD with Firestore operations)            ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Booking    │  │  Classroom  │  │        User             │  │
│  │ Repository  │  │ Repository  │  │      Repository         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       DATA LAYER                                 │
│  ┌──────────────────────┐  ┌─────────────────────────────────┐  │
│  │  Firebase Firestore  │  │     Firebase Authentication     │  │
│  └──────────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Design Patterns Used

### 1. Repository Pattern
- Abstracts data access from business logic
- `BaseRepository<T>` provides generic CRUD operations
- Specific repositories extend base for domain-specific queries

### 2. Service Layer Pattern
- Contains all business logic
- Services orchestrate repositories
- Handles validation, authorization, and side effects (emails)

### 3. Dependency Injection
- Services receive repositories via constructor
- Enables testing with mocks
- Loose coupling between layers

### 4. Factory Pattern
- Used for creating booking time slots
- Generates available slots based on configuration

### 5. Strategy Pattern
- Booking approval strategies (instant vs. pending)
- Configurable per classroom

## SOLID Principles Application

| Principle | Application |
|-----------|-------------|
| **S**ingle Responsibility | Each service/repository handles one domain |
| **O**pen/Closed | Base repository extendable without modification |
| **L**iskov Substitution | All repositories implement IRepository interface |
| **I**nterface Segregation | Small, focused interfaces per domain |
| **D**ependency Inversion | Services depend on repository interfaces |

## Security Model

```
┌────────────────────────────────────────────────────┐
│                  SUPER ADMIN                        │
│  - Full system access                              │
│  - Manage all classrooms, users, settings          │
├────────────────────────────────────────────────────┤
│                     ADMIN                           │
│  - Manage assigned classrooms                      │
│  - View/manage bookings in assigned classrooms     │
│  - Add/remove students (if permitted)              │
├────────────────────────────────────────────────────┤
│                    STUDENT                          │
│  - Book available slots (per classroom config)     │
│  - View own bookings                               │
│  - Cancel own bookings                             │
│  - Modify own bookings (if slot available)         │
└────────────────────────────────────────────────────┘
```
