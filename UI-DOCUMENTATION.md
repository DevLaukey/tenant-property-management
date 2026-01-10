# Property Management System - UI Documentation

## Overview

This document provides a complete overview of the UI components and pages built for the Property Management System.

## 🎨 Design System

### Color Palette
- **Primary**: Blue (bg-blue-600, text-blue-600)
- **Success**: Green (bg-green-600, text-green-600)
- **Warning**: Yellow (bg-yellow-600, text-yellow-600)
- **Danger**: Red (bg-red-600, text-red-600)
- **Neutral**: Gray shades (50-900)

### Typography
- **Headings**: Bold, various sizes (text-3xl, text-xl, etc.)
- **Body**: Base size (text-base, text-sm)
- **Font**: System font stack (antialiased)

### Spacing
- Consistent spacing using Tailwind's spacing scale (4, 6, 8, etc.)
- Gap spacing for flex/grid layouts (gap-4, gap-6)

## 📦 Component Library

### Base UI Components (`src/components/ui/`)

#### Button
**Location**: `src/components/ui/button.tsx`

Variants:
- `primary` - Blue background (default)
- `secondary` - Gray background
- `success` - Green background
- `danger` - Red background
- `outline` - Border only
- `ghost` - No background
- `link` - Text only with underline

Sizes:
- `sm` - Small (h-8)
- `md` - Medium (h-10, default)
- `lg` - Large (h-12)
- `icon` - Square icon button (h-10 w-10)

Props:
- `isLoading` - Shows loading spinner
- All standard button HTML attributes

Usage:
```tsx
import { Button } from '@/components/ui/button';

<Button variant="primary" size="md" isLoading={false}>
  Click me
</Button>
```

#### Input
**Location**: `src/components/ui/input.tsx`

Props:
- `label` - Label text
- `error` - Error message (shows red border)
- `helperText` - Helper text below input
- All standard input HTML attributes

Usage:
```tsx
import { Input } from '@/components/ui/input';

<Input
  label="Email"
  type="email"
  placeholder="you@example.com"
  error="Invalid email"
  required
/>
```

#### Select
**Location**: `src/components/ui/select.tsx`

Props:
- `label` - Label text
- `options` - Array of `{ value, label }` objects
- `error` - Error message
- `helperText` - Helper text

Usage:
```tsx
import { Select } from '@/components/ui/select';

<Select
  label="Property Type"
  options={[
    { value: 'residential', label: 'Residential' },
    { value: 'commercial', label: 'Commercial' }
  ]}
  value={selected}
  onChange={(e) => setSelected(e.target.value)}
/>
```

#### Textarea
**Location**: `src/components/ui/textarea.tsx`

Similar to Input but for multi-line text.

#### Card
**Location**: `src/components/ui/card.tsx`

Components:
- `Card` - Container
- `CardHeader` - Header section
- `CardTitle` - Title text
- `CardDescription` - Description text
- `CardContent` - Main content
- `CardFooter` - Footer section

Usage:
```tsx
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
  </CardHeader>
  <CardContent>
    Content here
  </CardContent>
</Card>
```

#### Badge
**Location**: `src/components/ui/badge.tsx`

Variants:
- `default` - Gray
- `primary` - Blue
- `success` - Green
- `warning` - Yellow
- `danger` - Red
- `info` - Cyan
- `purple` - Purple
- `outline` - Border only

Usage:
```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="success">Active</Badge>
```

#### Table
**Location**: `src/components/ui/table.tsx`

Components:
- `Table` - Container
- `TableHeader` - Header section
- `TableBody` - Body section
- `TableRow` - Table row
- `TableHead` - Header cell
- `TableCell` - Body cell

Usage:
```tsx
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

<Table>
  <TableHeader>
    <TableRow>
      <TableHead>Name</TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

#### Modal
**Location**: `src/components/ui/modal.tsx`

Props:
- `isOpen` - Boolean to show/hide
- `onClose` - Close handler
- `title` - Modal title
- `description` - Modal description
- `children` - Modal content
- `footer` - Footer content (buttons, etc.)
- `size` - 'sm' | 'md' | 'lg' | 'xl' | 'full'

Usage:
```tsx
import { Modal } from '@/components/ui/modal';

<Modal
  isOpen={isOpen}
  onClose={() => setIsOpen(false)}
  title="Modal Title"
  footer={
    <>
      <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
      <Button>Save</Button>
    </>
  }
>
  Modal content here
</Modal>
```

#### EmptyState
**Location**: `src/components/ui/empty-state.tsx`

Props:
- `icon` - Icon component
- `title` - Title text
- `description` - Description text
- `action` - Optional action button `{ label, onClick }`

Usage:
```tsx
import { EmptyState } from '@/components/ui/empty-state';
import { Building2 } from 'lucide-react';

<EmptyState
  icon={<Building2 className="h-10 w-10" />}
  title="No properties found"
  description="Get started by adding your first property."
  action={{ label: 'Add Property', onClick: handleAdd }}
/>
```

#### StatCard
**Location**: `src/components/ui/stat-card.tsx`

Props:
- `title` - Card title
- `value` - Main stat value
- `icon` - Icon component
- `trend` - Optional `{ value: string, isPositive: boolean }`
- `className` - Additional classes

Usage:
```tsx
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign } from 'lucide-react';

<StatCard
  title="Monthly Revenue"
  value="$68,500"
  icon={<DollarSign className="h-6 w-6" />}
  trend={{ value: '12% from last month', isPositive: true }}
/>
```

### Layout Components (`src/components/layout/`)

#### Header
**Location**: `src/components/layout/header.tsx`

Props:
- `onMenuClick` - Function to open mobile menu

Features:
- Responsive mobile menu button
- Notification bell with badge
- User profile button

#### Sidebar
**Location**: `src/components/layout/sidebar.tsx`

Props:
- `isOpen` - Boolean for mobile menu state
- `onClose` - Close handler for mobile menu

Features:
- Responsive (hidden on mobile, slides in when open)
- Navigation links with active state
- User profile section at bottom
- Auto-highlights current route

Navigation items:
- Dashboard
- Properties
- Units
- Leases
- Tenants
- Payments
- Maintenance

#### DashboardLayout
**Location**: `src/components/layout/dashboard-layout.tsx`

Wrapper component that combines Header and Sidebar.

Usage:
```tsx
import { DashboardLayout } from '@/components/layout/dashboard-layout';

export default function Page() {
  return (
    <DashboardLayout>
      {/* Your page content */}
    </DashboardLayout>
  );
}
```

## 📄 Pages

### Authentication Pages (`src/app/(auth)/`)

#### Login Page
**Route**: `/login`
**File**: `src/app/(auth)/login/page.tsx`

Features:
- Email and password fields
- Remember me checkbox
- Forgot password link
- Sign up link
- Loading state

#### Signup Page
**Route**: `/signup`
**File**: `src/app/(auth)/signup/page.tsx`

Features:
- Full name, email, password fields
- Role selection (Owner, Manager, Tenant)
- Password confirmation
- Password strength hint
- Login link

#### Forgot Password Page
**Route**: `/forgot-password`
**File**: `src/app/(auth)/forgot-password/page.tsx`

Features:
- Email input
- Success state after submission
- Back to login link
- Resend option

### Dashboard Pages (`src/app/(dashboard)/`)

#### Dashboard
**Route**: `/dashboard`
**File**: `src/app/(dashboard)/dashboard/page.tsx`

Components:
- 4 stat cards (Properties, Leases, Tenants, Revenue)
- Alert banner for urgent items
- Recent activity feed
- Expiring leases widget

#### Properties List
**Route**: `/properties`
**File**: `src/app/(dashboard)/properties/page.tsx`

Features:
- Grid layout of property cards
- Search by name
- Filter by property type
- Add property button
- Empty state

#### Property Detail
**Route**: `/properties/[id]`
**File**: `src/app/(dashboard)/properties/[id]/page.tsx`

Sections:
- Property header with address
- Info cards (Type, Total Units, Occupancy Rate)
- Description section
- Units table with status badges
- Edit property button

#### Leases List
**Route**: `/leases`
**File**: `src/app/(dashboard)/leases/page.tsx`

Features:
- Table layout
- Search by tenant/unit
- Filter by status
- Status badges
- Create lease button

#### Tenants List
**Route**: `/tenants`
**File**: `src/app/(dashboard)/tenants/page.tsx`

Features:
- Grid layout of tenant cards
- Avatar initials
- Contact information
- Current unit display
- Active/inactive status
- Add tenant button

#### Payments List
**Route**: `/payments`
**File**: `src/app/(dashboard)/payments/page.tsx`

Components:
- 3 stat cards (Revenue, Overdue, Collection Rate)
- Payments table
- Search functionality
- Filter by status
- Record payment action
- Export report button

#### Maintenance Requests
**Route**: `/maintenance`
**File**: `src/app/(dashboard)/maintenance/page.tsx`

Features:
- Table layout
- Priority badges (Low, Medium, High, Urgent)
- Status badges
- Multiple filters (status, priority)
- Create request button

## 🎯 Status Indicators

### Unit Status
- `available` - Green badge
- `occupied` - Blue badge
- `maintenance` - Yellow badge
- `unavailable` - Red badge

### Lease Status
- `active` - Green badge
- `pending` - Yellow badge
- `expired` - Red badge
- `terminated` - Gray badge

### Payment Status
- `paid` - Green badge
- `pending` - Gray badge
- `overdue` - Red badge
- `partial` - Yellow badge

### Maintenance Priority
- `low` - Gray badge
- `medium` - Yellow badge
- `high` - Red badge
- `urgent` - Red badge

### Maintenance Status
- `submitted` - Gray badge
- `in_progress` - Blue badge
- `completed` - Green badge
- `cancelled` - Gray badge

## 🔧 Utility Functions

**Location**: `src/lib/utils.ts`

### cn()
Combines class names using clsx and tailwind-merge.

### formatCurrency(amount: number)
Formats number as USD currency.

### formatDate(date: Date | string, format: 'short' | 'long')
Formats date in US locale.

### calculateDaysBetween(start: Date | string, end: Date | string)
Calculates days between two dates.

### isOverdue(dueDate: Date | string)
Checks if a date is in the past.

## 📱 Responsive Design

All components and pages are fully responsive:
- **Mobile**: < 768px (md breakpoint)
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### Responsive Features:
- Collapsible sidebar on mobile
- Stacked layouts on small screens
- Grid columns adjust (1 col mobile → 2-3 cols desktop)
- Touch-friendly tap targets
- Mobile-optimized navigation

## 🎨 Icons

Using **Lucide React** icon library.

Common icons:
- `Building2` - Properties
- `Home` - Units
- `FileText` - Leases
- `Users` - Tenants
- `DollarSign` - Payments
- `Wrench` - Maintenance
- `Plus` - Add actions
- `Edit` - Edit actions
- `Search` - Search
- `Download` - Export

## 🚀 Next Steps

To complete the application:

1. **Connect to Supabase**
   - Setup environment variables
   - Implement authentication hooks
   - Add data fetching logic

2. **Add Forms**
   - Create property form
   - Create lease form
   - Create tenant form
   - Add validation with Zod

3. **Implement CRUD Operations**
   - Create, Read, Update, Delete for all entities
   - Add error handling
   - Add success notifications

4. **File Uploads**
   - Property images
   - Lease documents
   - Maintenance images
   - Tenant documents

5. **Real-time Features**
   - Live notifications
   - Real-time updates
   - Websocket connections

## 📚 Component Usage Examples

### Creating a New Page

```tsx
'use client';

import { DashboardLayout } from '@/components/layout/dashboard-layout';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';

export default function MyPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Page Title</h1>
          <Button>Add New</Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Section Title</CardTitle>
          </CardHeader>
          <CardContent>
            {/* Your content */}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
```

### Using Forms

```tsx
'use client';

import { useState } from 'react';
import { Input, Select, Textarea, Button } from '@/components/ui';

export function MyForm() {
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    description: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Name"
        value={formData.name}
        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        required
      />

      <Select
        label="Type"
        options={[
          { value: 'option1', label: 'Option 1' },
          { value: 'option2', label: 'Option 2' }
        ]}
        value={formData.type}
        onChange={(e) => setFormData({ ...formData, type: e.target.value })}
      />

      <Textarea
        label="Description"
        value={formData.description}
        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
      />

      <Button type="submit">Save</Button>
    </form>
  );
}
```

## 🎨 Customization

### Changing Colors

Edit Tailwind config to change primary colors:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          // Your custom blue shades
        }
      }
    }
  }
}
```

### Adding New Components

1. Create component in `src/components/ui/`
2. Export from `src/components/ui/index.ts`
3. Use throughout the app

### Styling Convention

- Use Tailwind utility classes
- Keep components generic and reusable
- Use `cn()` utility for conditional classes
- Follow existing spacing patterns (p-4, p-6, gap-4, gap-6)

## 📖 TypeScript Types

All database types are defined in `src/types/index.ts`:

- Profile
- Property
- Unit
- Tenant
- Lease
- Payment
- MaintenanceRequest
- Document

Plus enums for all status types.

---

**Built with**: Next.js 16, TypeScript, Tailwind CSS 4, Lucide Icons
