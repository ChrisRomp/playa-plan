# DataTable Component

A fully featured, accessible data table component for React applications.

## Features

- Sorting (click on column headers)
- Filtering
- Pagination
- Grouping by field
- Responsive design with mobile considerations
- Full keyboard navigation
- Screen reader accessibility
- Custom cell rendering

## Usage

```tsx
import { DataTable } from './components/common/DataTable';

// Define your data type
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
}

// Define your columns
const columns = [
  { 
    id: 'name', 
    header: 'Name', 
    accessor: (row) => row.name, 
    sortable: true 
  },
  { 
    id: 'email', 
    header: 'Email', 
    accessor: (row) => row.email
  },
  { 
    id: 'role', 
    header: 'Role', 
    accessor: (row) => row.role,
    // Custom cell renderer
    Cell: ({ value }) => (
      <span className={value === 'Admin' ? 'text-blue-500' : 'text-green-500'}>
        {value}
      </span>
    )
  },
  { 
    id: 'createdAt', 
    header: 'Created', 
    accessor: (row) => new Date(row.createdAt).toLocaleDateString(),
    sortable: true,
    // Hide this column on small screens
    hideOnMobile: true
  },
];

// In your component
function UserList() {
  const [users, setUsers] = useState<User[]>([]);
  
  useEffect(() => {
    // Fetch your data
    fetchUsers().then(setUsers);
  }, []);

  return (
    <DataTable
      data={users}
      columns={columns}
      getRowKey={(user) => user.id}
      filterable={true}
      paginated={true}
      caption="User Directory"
      onRowClick={(user) => {
        // Handle row click, e.g., navigate to user details
        navigate(`/users/${user.id}`);
      }}
    />
  );
}
```

## Props

| Prop | Type | Description |
|------|------|-------------|
| `data` | `T[]` | Array of data objects to display |
| `columns` | `DataTableColumn<T>[]` | Column definitions |
| `getRowKey` | `(row: T) => string \| number` | Function to get unique key for each row |
| `id` | `string` (optional) | Optional ID for the table element |
| `className` | `string` (optional) | Optional CSS class name |
| `filterable` | `boolean` (optional) | Whether to enable filtering |
| `groupable` | `boolean` (optional) | Whether to enable grouping |
| `paginated` | `boolean` (optional) | Whether to enable pagination |
| `defaultPageSize` | `number` (optional) | Default records per page when paginated |
| `onRowClick` | `(row: T) => void` (optional) | Function to handle row click |
| `caption` | `string` (optional) | Caption for the table (for accessibility) |
| `emptyMessage` | `string` (optional) | Message when no data is present |
| `initialSort` | `{ id: string; direction: 'asc' \| 'desc' \| null }` (optional) | Initial sort configuration |
| `groupByField` | `(row: T) => string` (optional) | Group by field (if groupable is true) |
| `groupDisplayName` | `(groupValue: string) => string` (optional) | Display name for the group |

## Column Definition

```tsx
interface DataTableColumn<T> {
  id: string;                                   // Unique identifier for the column
  header: string;                               // Display header for the column
  accessor: (row: T) => React.ReactNode;        // Function to access the cell value from a row
  sortable?: boolean;                           // Whether this column can be sorted
  hideOnMobile?: boolean;                       // Whether to hide this column on small screens
  Cell?: (props: {                              // Optional custom cell renderer
    value: React.ReactNode;
    row: T
  }) => React.ReactNode;
}
```

## Accessibility

The DataTable component includes the following accessibility features:

- Proper ARIA attributes for sorting, grouping, and pagination
- Fully keyboard navigable
- Screen reader announcements for sorting and grouping changes
- Responsive design with considerations for small screens
- Semantic HTML and ARIA roles
- Proper table caption support
