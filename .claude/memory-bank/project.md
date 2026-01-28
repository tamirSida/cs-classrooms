# ClassRoom Scheduler - Project Overview

## Description
A lightweight, mobile-first web application for managing classroom schedules. Supports multiple configurable classrooms with role-based access control.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui |
| Auth | Firebase Authentication |
| Database | Firestore |
| Hosting | Netlify |
| Cloud Functions | Netlify Functions |
| Email | Resend |

## Design Principles
- Mobile-first responsive design
- Minimal and professional UI
- OOP with SOLID principles
- DRY code patterns
- Enterprise production-level quality

## Key Features
1. Multi-classroom management with individual configurations
2. Google Calendar-like booking interface
3. 15-minute time slot granularity
4. Role-based access (Super Admin, Admin, Student)
5. Configurable approval workflows per classroom
6. Transactional emails for booking lifecycle

## Future Considerations
- Azure AD integration for Microsoft org auth
- Offline support (currently online-only)
- Recurring bookings
