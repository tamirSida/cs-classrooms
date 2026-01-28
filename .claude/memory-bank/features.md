# Feature Specifications

## Booking System

### Time Slot Configuration
- **Granularity**: 15 minutes
- **Operating Hours**: Configurable globally (default: 08:00 - 18:00)
- **Time Limits**: Per-classroom or global default (minutes per student per day)

### Booking Flow
1. User selects classroom (sees only classrooms they have permission to book)
2. Calendar view shows current week/day with available slots
3. User can:
   - Click on empty slot to create booking
   - Drag to select multiple consecutive slots
   - Click existing booking to view/modify/cancel
4. System validates:
   - Slot availability
   - User's daily time limit
   - Operating hours
5. If `requiresApproval = true`: booking status = `pending`
6. If `requiresApproval = false`: booking status = `confirmed`
7. Email sent based on booking status

### Booking Modifications
- **Cancel**: Always allowed for own bookings
- **Modify**: Allowed if new time slot is available and within limits

## User Management

### User Hierarchy
| Role | Capabilities |
|------|--------------|
| Super Admin | Full access - manage everything |
| Admin | Manage assigned classrooms and their bookings |
| Student | Book slots, manage own bookings |

### User Creation Flow
1. Super Admin/Admin creates user via dashboard
2. System creates Firebase Auth account
3. Invitation email sent via Resend
4. User sets password on first login

## Classroom Configuration

### Per-Classroom Settings
```typescript
{
  permissions: 'admin_only' | 'student',  // Who can create bookings
  maxTimePerDay: number,                   // 0 = use global setting
  requiresApproval: boolean,               // Booking approval required
  isActive: boolean                        // Toggle availability
}
```

### Classroom Assignment
- Admins are assigned to specific classrooms
- Students can book any classroom where `permissions = 'student'`

## Email Notifications (Resend)

### Transactional Emails
1. **Booking Confirmation**
   - Triggered: On successful booking (instant or approved)
   - Contains: Classroom, date, time, status

2. **Booking Modified**
   - Triggered: When booking time is changed
   - Contains: Old time, new time, classroom

3. **Booking Cancelled**
   - Triggered: When booking is cancelled
   - Contains: Cancelled booking details

### Email Templates (Future)
- Welcome email for new users
- Booking reminder (1 hour before)
- Pending approval notification (to admins)

## Calendar UI

### Views
- **Week View**: Default on desktop, shows full week
- **Day View**: Default on mobile, shows single day
- **List View**: Optional, shows upcoming bookings as list

### Interactions
- Click to create booking
- Drag to select time range
- Click existing booking to view details modal
- Drag existing booking to reschedule (if available)

### Visual Indicators
- Own bookings: Primary color
- Others' bookings: Gray/muted
- Pending bookings: Striped pattern
- Current time: Red line indicator
