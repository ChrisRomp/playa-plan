import React, { useState, useMemo, useCallback, useEffect, useRef, KeyboardEvent } from 'react';
import { ChevronDown, ChevronUp, ChevronRight, Search } from 'lucide-react';

/**
 * Column definition for DataTable
 */
export interface DataTableColumn<T> {
  /** Unique identifier for the column */
  id: string;
  /** Display header for the column */
  header: string;
  /** Function to access the cell value from a row */
  accessor: (row: T) => React.ReactNode;
  /** Whether this column can be sorted */
  sortable?: boolean;
  /** Whether to hide this column on small screens */
  hideOnMobile?: boolean;
  /** Optional custom cell renderer */
  Cell?: (props: { value: React.ReactNode; row: T }) => React.ReactNode;
}

/**
 * Sort direction options
 */
export type SortDirection = 'asc' | 'desc' | null;

/**
 * Sort state type
 */
interface SortState {
  id: string;
  direction: SortDirection;
}

/**
 * Props for the DataTable component
 */
export interface DataTableProps<T> {
  /** Array of data objects to display */
  data: T[];
  /** Column definitions */
  columns: DataTableColumn<T>[];
  /** Function to get a unique key from each row */
  getRowKey: (row: T) => string | number;
  /** Optional ID for the table element */
  id?: string;
  /** Optional CSS class name */
  className?: string;
  /** Whether to enable filtering */
  filterable?: boolean;
  /** Whether to enable grouping */
  groupable?: boolean;
  /** Whether to enable pagination */
  paginated?: boolean;
  /** Default records per page when paginated */
  defaultPageSize?: number;
  /** Function to handle row click */
  onRowClick?: (row: T) => void;
  /** Caption for the table (for accessibility) */
  caption?: string;
  /** Optional message when no data is present */
  emptyMessage?: string;
  /** Initial sort configuration */
  initialSort?: { id: string; direction: SortDirection };
  /** Group by field (if groupable is true) */
  groupByField?: (row: T) => string;
  /** Display name for the group */
  groupDisplayName?: (groupValue: string) => string;
}

/**
 * A reusable data table component with sorting, filtering, and grouping capabilities
 */
export function DataTable<T>({
  data,
  columns,
  getRowKey,
  id,
  className = '',
  filterable = false,
  groupable = false,
  paginated = false,
  defaultPageSize = 10,
  onRowClick,
  caption,
  emptyMessage = 'No data available',
  initialSort,
  groupByField,
  groupDisplayName = (group) => group,
}: DataTableProps<T>) {
  // Refs
  const tableRef = useRef<HTMLTableElement>(null);
  const statusAnnouncerRef = useRef<HTMLDivElement>(null);
  
  // State
  const [sortState, setSortState] = useState<SortState | null>(initialSort ? initialSort : null);
  const [filterText, setFilterText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [announcement, setAnnouncement] = useState<string>('');

  // Reset to first page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [filterText]);

  // Toggle group expansion
  const toggleGroupExpansion = useCallback((groupName: string) => {
    setExpandedGroups((prevExpanded) => {
      const newExpanded = new Set(prevExpanded);
      const isCurrentlyExpanded = newExpanded.has(groupName);
      
      if (isCurrentlyExpanded) {
        newExpanded.delete(groupName);
        setAnnouncement(`Group ${groupName} collapsed`);
      } else {
        newExpanded.add(groupName);
        setAnnouncement(`Group ${groupName} expanded`);
      }
      
      return newExpanded;
    });
  }, []);

  // Handle sort click
  const handleSortClick = useCallback((columnId: string) => {
    setSortState((prevSort) => {
      let newState: SortState | null;
      
      if (prevSort?.id !== columnId) {
        newState = { id: columnId, direction: 'asc' };
        setAnnouncement(`Sorting by ${columnId} in ascending order`);
      } else if (prevSort.direction === 'asc') {
        newState = { id: columnId, direction: 'desc' };
        setAnnouncement(`Sorting by ${columnId} in descending order`);
      } else {
        newState = null;
        setAnnouncement(`Sorting cleared`);
      }
      
      return newState;
    });
  }, []);

  // Keyboard handler for table header navigation and sorting
  const handleHeaderKeyDown = useCallback((event: KeyboardEvent<HTMLTableCellElement>, columnId: string, isSortable: boolean) => {
    if (!isSortable) return;
    
    switch (event.key) {
      case ' ':
      case 'Enter':
        event.preventDefault();
        handleSortClick(columnId);
        break;
    }
  }, [handleSortClick]);

  // Keyboard handler for group toggling
  const handleGroupKeyDown = useCallback((event: KeyboardEvent<HTMLTableRowElement>, groupName: string) => {
    switch (event.key) {
      case ' ':
      case 'Enter':
        event.preventDefault();
        toggleGroupExpansion(groupName);
        break;
    }
  }, [toggleGroupExpansion]);

  // Announce status changes to screen readers
  useEffect(() => {
    if (announcement) {
      // Clear announcement after it's been read (roughly 2s)
      const timer = setTimeout(() => {
        setAnnouncement('');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [announcement]);

  // Generic filter function to search across all string properties
  const filterFunction = useCallback(
    (row: T) => {
      if (!filterText.trim()) return true;
      
      const searchTerm = filterText.toLowerCase();
      return columns.some((col) => {
        const value = col.accessor(row);
        if (typeof value === 'string') {
          return value.toLowerCase().includes(searchTerm);
        }
        if (typeof value === 'number') {
          return value.toString().includes(searchTerm);
        }
        return false;
      });
    },
    [filterText, columns]
  );

  // Define processedData type for better type safety
  type ProcessedGroupedData = {
    grouped: true;
    groups: Record<string, T[]>;
  };

  type ProcessedPaginatedData = {
    grouped: false;
    items: T[];
    totalItems: number;
    totalPages: number;
  };

  type ProcessedFlatData = {
    grouped: false;
    items: T[];
  };

  type ProcessedData = ProcessedGroupedData | ProcessedPaginatedData | ProcessedFlatData;

  // Process data with filtering, sorting, and grouping
  const processedData = useMemo<ProcessedData>(() => {
    // Apply filtering
    let result = filterText ? data.filter(filterFunction) : data;

    // Apply sorting
    if (sortState) {
      result = [...result].sort((a, b) => {
        const column = columns.find((col) => col.id === sortState.id);
        if (!column) return 0;

        const aValue = column.accessor(a);
        const bValue = column.accessor(b);
        
        // Handle different value types
        let comparison = 0;
        if (typeof aValue === 'string' && typeof bValue === 'string') {
          comparison = aValue.localeCompare(bValue);
        } else if (typeof aValue === 'number' && typeof bValue === 'number') {
          comparison = aValue - bValue;
        } else {
          // Convert to string for comparison if types are mixed or unsupported
          comparison = String(aValue).localeCompare(String(bValue));
        }
        
        return sortState.direction === 'asc' ? comparison : -comparison;
      });
    }

    // Apply grouping
    if (groupable && groupByField) {
      const groups: Record<string, T[]> = {};
      result.forEach((item) => {
        const groupKey = String(groupByField(item));
        if (!groups[groupKey]) {
          groups[groupKey] = [];
        }
        groups[groupKey].push(item);
      });
      
      // Return the grouped structure
      return { grouped: true, groups } as ProcessedGroupedData;
    }

    // Apply pagination
    if (paginated) {
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      return { 
        grouped: false,
        items: result.slice(startIndex, endIndex),
        totalItems: result.length,
        totalPages: Math.ceil(result.length / pageSize)
      } as ProcessedPaginatedData;
    }

    // Return filtered/sorted data without pagination or grouping
    return { grouped: false, items: result } as ProcessedFlatData;
  }, [data, columns, filterText, sortState, currentPage, pageSize, groupable, groupByField, paginated, filterFunction]);

  // Determine if the table has any data to show
  const hasData = useMemo(() => {
    if (processedData.grouped) {
      return Object.keys(processedData.groups).length > 0;
    } else {
      return processedData.items.length > 0;
    }
  }, [processedData]);

  // Handle page change with announcement
  const handlePageChange = useCallback((newPage: number) => {
    setCurrentPage(newPage);
    if (processedData.grouped === false && 'totalPages' in processedData) {
      setAnnouncement(`Page ${newPage} of ${processedData.totalPages}`);
    }
  }, [processedData]);

  // Handle page size change
  const handlePageSizeChange = useCallback((newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    setAnnouncement(`Showing ${newSize} items per page`);
  }, []);

  return (
    <div className="w-full">
      {/* Screen reader announcements */}
      <div 
        ref={statusAnnouncerRef}
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {announcement}
      </div>
      
      {filterable && (
        <div className="mb-4">
          <div className="relative">
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Search..."
              aria-label="Filter table data"
              className="w-full p-2 pl-10 border rounded-md"
            />
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
            {filterText && (
              <button
                onClick={() => setFilterText('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <table 
          ref={tableRef}
          id={id}
          className={`min-w-full bg-white border border-gray-200 ${className}`}
          role="grid"
          aria-busy={false}
          aria-rowcount={hasData ? (
            processedData.grouped 
              ? Object.values(processedData.groups).flat().length 
              : processedData.items.length
          ) : 0}
        >
          {caption && <caption className="sr-only">{caption}</caption>}
          
          <thead className="bg-gray-50">
            <tr>
              {groupable && groupByField && <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" />}
              
              {columns.map((column, colIndex) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    column.hideOnMobile ? 'hidden md:table-cell' : ''
                  } ${column.sortable ? 'cursor-pointer select-none' : ''}`}
                  onClick={column.sortable ? () => handleSortClick(column.id) : undefined}
                  onKeyDown={(e) => handleHeaderKeyDown(e, column.id, !!column.sortable)}
                  tabIndex={column.sortable ? 0 : -1}
                  role="columnheader"
                  aria-sort={
                    sortState?.id === column.id
                      ? sortState.direction === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : 'none'
                  }
                  aria-colindex={colIndex + 1}
                >
                  <div className="flex items-center space-x-1">
                    <span>{column.header}</span>
                    {column.sortable && (
                      <span className="inline-flex flex-col">
                        {sortState?.id === column.id ? (
                          sortState.direction === 'asc' ? (
                            <ChevronUp size={14} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={14} aria-hidden="true" />
                          )
                        ) : (
                          <span className="text-gray-300">
                            <ChevronDown size={14} aria-hidden="true" />
                          </span>
                        )}
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {!hasData ? (
              <tr>
                <td
                  colSpan={columns.length + (groupable && groupByField ? 1 : 0)}
                  className="px-4 py-4 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : processedData.grouped ? (
              // Render grouped data
              Object.entries(processedData.groups).map(([groupName, groupItems], groupIndex) => (
                <React.Fragment key={groupName}>
                  {/* Group header row */}
                  <tr 
                    className="bg-gray-100 cursor-pointer"
                    onClick={() => toggleGroupExpansion(groupName)}
                    onKeyDown={(e) => handleGroupKeyDown(e, groupName)}
                    tabIndex={0}
                    role="row"
                    aria-expanded={expandedGroups.has(groupName)}
                    aria-level={1}
                    aria-rowindex={groupIndex + 1}
                  >
                    <td 
                      colSpan={columns.length + 1}
                      className="px-4 py-2 font-medium"
                      role="gridcell"
                    >
                      <div className="flex items-center">
                        <ChevronRight 
                          size={16} 
                          className={`mr-2 transition-transform ${
                            expandedGroups.has(groupName) ? 'transform rotate-90' : ''
                          }`}
                          aria-hidden="true"
                        />
                        <span>
                          {groupDisplayName(groupName)} ({groupItems.length})
                        </span>
                      </div>
                    </td>
                  </tr>
                  
                  {/* Group data rows */}
                  {expandedGroups.has(groupName) && groupItems.map((row, rowIndex) => (
                    <tr 
                      key={getRowKey(row)}
                      onClick={onRowClick ? () => onRowClick(row) : undefined}
                      className={onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''}
                      role="row"
                      aria-level={2}
                      aria-rowindex={groupIndex + rowIndex + 2}
                      tabIndex={onRowClick ? 0 : undefined}
                    >
                      <td className="px-4 py-2" role="gridcell" />
                      {columns.map((column, colIndex) => (
                        <td 
                          key={`${getRowKey(row)}-${column.id}`}
                          className={`px-4 py-2 whitespace-nowrap ${
                            column.hideOnMobile ? 'hidden md:table-cell' : ''
                          }`}
                          role="gridcell"
                          aria-colindex={colIndex + 1}
                        >
                          {column.Cell ? (
                            column.Cell({ 
                              value: column.accessor(row), 
                              row 
                            })
                          ) : (
                            column.accessor(row)
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </React.Fragment>
              ))
            ) : (
              // Render flat data
              processedData.items.map((row, rowIndex) => (
                <tr 
                  key={getRowKey(row)}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={onRowClick ? 'hover:bg-gray-50 cursor-pointer' : ''}
                  role="row"
                  aria-rowindex={rowIndex + 1}
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {groupable && groupByField && <td className="px-4 py-2" role="gridcell" />}
                  {columns.map((column, colIndex) => (
                    <td 
                      key={`${getRowKey(row)}-${column.id}`}
                      className={`px-4 py-2 whitespace-nowrap ${
                        column.hideOnMobile ? 'hidden md:table-cell' : ''
                      }`}
                      role="gridcell"
                      aria-colindex={colIndex + 1}
                    >
                      {column.Cell ? (
                        column.Cell({ 
                          value: column.accessor(row), 
                          row 
                        })
                      ) : (
                        column.accessor(row)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {paginated && !processedData.grouped && 'totalPages' in processedData && processedData.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm" role="navigation" aria-label="Pagination">
          <div>
            Showing {((currentPage - 1) * pageSize) + 1} to {Math.min(currentPage * pageSize, processedData.totalItems)} of {processedData.totalItems} entries
          </div>
          
          <div className="flex space-x-1">
            <select
              value={pageSize}
              onChange={(e) => handlePageSizeChange(Number(e.target.value))}
              className="mr-4 border rounded px-2 py-1"
              aria-label="Rows per page"
            >
              {[10, 25, 50, 100].map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>

            <button
              onClick={() => handlePageChange(1)}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Go to first page"
            >
              ««
            </button>
            <button
              onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Go to previous page"
            >
              «
            </button>
            
            <div className="px-3 py-1" aria-live="polite">
              Page{' '}
              <strong>
                {currentPage} of {processedData.totalPages}
              </strong>
            </div>
            
            <button
              onClick={() => handlePageChange(Math.min(currentPage + 1, processedData.totalPages))}
              disabled={currentPage === processedData.totalPages}
              className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Go to next page"
            >
              »
            </button>
            <button
              onClick={() => handlePageChange(processedData.totalPages)}
              disabled={currentPage === processedData.totalPages}
              className="px-3 py-1 rounded border disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Go to last page"
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
