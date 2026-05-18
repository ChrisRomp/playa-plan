/**
 * @vitest-environment jsdom
 */
import { render, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { DataTable, type DataTableColumn } from './DataTable';

interface TestItem {
  id: string;
  name: string;
  email: string;
}

const testData: TestItem[] = [
  { id: '1', name: 'Alice Smith', email: 'alice@example.com' },
  { id: '2', name: 'Bob Johnson', email: 'bob-very-long-email-that-overflows@longdomain.example.com' },
];

describe('DataTable column widths', () => {
  it('renders a colgroup with col elements for each column', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name },
      { id: 'email', header: 'Email', accessor: (row) => row.email },
    ];

    const { container } = render(
      <DataTable data={testData} columns={columns} getRowKey={(row) => row.id} />
    );

    const colgroup = container.querySelector('colgroup');
    expect(colgroup).toBeInTheDocument();

    const cols = colgroup!.querySelectorAll('col');
    expect(cols).toHaveLength(2);
  });

  it('applies width style from column definition (number)', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name, width: 200 },
      { id: 'email', header: 'Email', accessor: (row) => row.email },
    ];

    const { container } = render(
      <DataTable data={testData} columns={columns} getRowKey={(row) => row.id} />
    );

    const cols = container.querySelectorAll('colgroup col');
    expect(cols[0]).toHaveStyle({ width: '200px' });
  });

  it('applies width style from column definition (string percentage)', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name, width: '30%' },
      { id: 'email', header: 'Email', accessor: (row) => row.email, width: '70%' },
    ];

    const { container } = render(
      <DataTable data={testData} columns={columns} getRowKey={(row) => row.id} />
    );

    const cols = container.querySelectorAll('colgroup col');
    expect(cols[0]).toHaveStyle({ width: '30%' });
    expect(cols[1]).toHaveStyle({ width: '70%' });
  });

  it('uses minWidth as width fallback when no explicit width is set', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name, minWidth: 100 },
      { id: 'email', header: 'Email', accessor: (row) => row.email },
    ];

    const { container } = render(
      <DataTable data={testData} columns={columns} getRowKey={(row) => row.id} />
    );

    const cols = container.querySelectorAll('colgroup col');
    expect(cols[0]).toHaveStyle({ width: '100px' });
  });

  it('explicit width takes precedence over minWidth', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name, width: '25%', minWidth: 100 },
      { id: 'email', header: 'Email', accessor: (row) => row.email },
    ];

    const { container } = render(
      <DataTable data={testData} columns={columns} getRowKey={(row) => row.id} />
    );

    const cols = container.querySelectorAll('colgroup col');
    expect(cols[0]).toHaveStyle({ width: '25%' });
  });

  it('uses table-fixed class on the table element', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name },
    ];

    const { container } = render(
      <DataTable data={testData} columns={columns} getRowKey={(row) => row.id} />
    );

    const table = container.querySelector('table');
    expect(table).toHaveClass('table-fixed');
  });

  it('applies truncation classes to table cells', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name },
      { id: 'email', header: 'Email', accessor: (row) => row.email },
    ];

    const { container } = render(
      <DataTable data={testData} columns={columns} getRowKey={(row) => row.id} />
    );

    const cells = container.querySelectorAll('tbody td');
    for (const cell of cells) {
      expect(cell).toHaveClass('overflow-hidden');
      expect(cell).toHaveClass('text-ellipsis');
      expect(cell).toHaveClass('whitespace-nowrap');
    }
  });

  it('adds title attribute for string cell values', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name },
      { id: 'email', header: 'Email', accessor: (row) => row.email },
    ];

    const { container } = render(
      <DataTable data={testData} columns={columns} getRowKey={(row) => row.id} />
    );

    const firstRow = container.querySelectorAll('tbody tr')[0];
    const cells = firstRow.querySelectorAll('td');
    expect(cells[0]).toHaveAttribute('title', 'Alice Smith');
    expect(cells[1]).toHaveAttribute('title', 'alice@example.com');
  });

  it('renders extra col for groupable table with groupByField', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name },
    ];

    const { container } = render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        groupable={true}
        groupByField={(row) => row.name.charAt(0)}
      />
    );

    const cols = container.querySelectorAll('colgroup col');
    // 1 col for grouping spacer + 1 for the column
    expect(cols).toHaveLength(2);
  });

  it('offsets aria-colindex by 1 when grouping spacer column is present', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name },
      { id: 'email', header: 'Email', accessor: (row) => row.email },
    ];

    const { container } = render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
        groupable={true}
        groupByField={(row) => row.name.charAt(0)}
      />
    );

    // Header th elements should start at aria-colindex 2
    const headers = container.querySelectorAll('thead th[aria-colindex]');
    expect(headers[0]).toHaveAttribute('aria-colindex', '2');
    expect(headers[1]).toHaveAttribute('aria-colindex', '3');

    // Expand a group to reveal data rows
    const groupRow = container.querySelector('tbody tr[aria-expanded]') as HTMLElement;
    fireEvent.click(groupRow);

    // Body td elements should also start at aria-colindex 2
    const dataCells = container.querySelectorAll('tbody td[aria-colindex]');
    expect(dataCells[0]).toHaveAttribute('aria-colindex', '2');
    expect(dataCells[1]).toHaveAttribute('aria-colindex', '3');
  });

  it('does not offset aria-colindex when grouping is not active', () => {
    const columns: DataTableColumn<TestItem>[] = [
      { id: 'name', header: 'Name', accessor: (row) => row.name },
      { id: 'email', header: 'Email', accessor: (row) => row.email },
    ];

    const { container } = render(
      <DataTable
        data={testData}
        columns={columns}
        getRowKey={(row) => row.id}
      />
    );

    // Header th elements should start at aria-colindex 1
    const headers = container.querySelectorAll('thead th[aria-colindex]');
    expect(headers[0]).toHaveAttribute('aria-colindex', '1');
    expect(headers[1]).toHaveAttribute('aria-colindex', '2');

    // Body td elements should also start at aria-colindex 1
    const dataCells = container.querySelectorAll('tbody td[aria-colindex]');
    expect(dataCells[0]).toHaveAttribute('aria-colindex', '1');
    expect(dataCells[1]).toHaveAttribute('aria-colindex', '2');
  });
});
