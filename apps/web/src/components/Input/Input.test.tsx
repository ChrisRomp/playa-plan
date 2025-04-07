import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input Component', () => {
  it('should render correctly with default props', () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
  });

  it('should render with a label', () => {
    render(<Input label="Username" placeholder="Enter username" />);
    const label = screen.getByText('Username');
    expect(label).toBeInTheDocument();
    
    const input = screen.getByPlaceholderText('Enter username');
    expect(input).toBeInTheDocument();
    expect(label.getAttribute('for')).toBe(input.id);
  });

  it('should render helper text when provided', () => {
    render(<Input helperText="Must be at least 8 characters" placeholder="Password" />);
    expect(screen.getByText('Must be at least 8 characters')).toBeInTheDocument();
  });

  it('should render error message when provided', () => {
    render(<Input error="This field is required" placeholder="Required field" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
    
    const input = screen.getByPlaceholderText('Required field');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('should be disabled when disabled prop is provided', () => {
    render(<Input disabled placeholder="Disabled input" />);
    const input = screen.getByPlaceholderText('Disabled input');
    expect(input).toBeDisabled();
  });

  it('should accept user input', async () => {
    const user = userEvent.setup();
    render(<Input placeholder="Type here" />);
    const input = screen.getByPlaceholderText('Type here');
    
    await user.type(input, 'Hello, world!');
    expect(input).toHaveValue('Hello, world!');
  });

  it('should call onChange when typing', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    render(<Input placeholder="With onChange" onChange={handleChange} />);
    const input = screen.getByPlaceholderText('With onChange');
    
    await user.type(input, 'a');
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it('should render with leftIcon', () => {
    render(
      <Input 
        leftIcon={<span data-testid="left-icon">🔍</span>}
        placeholder="Search"
      />
    );
    expect(screen.getByTestId('left-icon')).toBeInTheDocument();
  });

  it('should render with rightIcon', () => {
    render(
      <Input 
        rightIcon={<span data-testid="right-icon">❌</span>}
        placeholder="Clear"
      />
    );
    expect(screen.getByTestId('right-icon')).toBeInTheDocument();
  });
}); 