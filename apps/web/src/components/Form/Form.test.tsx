import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Form, FormField, FormActions } from './Form';
import { Button } from '../Button';
import { Input } from '../Input';

describe('Form Components', () => {
  describe('Form Component', () => {
    it('should render children correctly', () => {
      render(
        <Form onSubmit={() => {}}>
          <div>Form Content</div>
        </Form>
      );
      expect(screen.getByText('Form Content')).toBeInTheDocument();
    });

    it('should call onSubmit when form is submitted', async () => {
      const user = userEvent.setup();
      const handleSubmit = vi.fn();
      
      render(
        <Form onSubmit={handleSubmit}>
          <Button type="submit">Submit</Button>
        </Form>
      );
      
      await user.click(screen.getByRole('button', { name: /submit/i }));
      expect(handleSubmit).toHaveBeenCalledTimes(1);
    });

    it('should handle async submit functions', async () => {
      const user = userEvent.setup();
      const handleAsyncSubmit = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          setTimeout(resolve, 100);
        });
      });
      
      render(
        <Form onSubmit={handleAsyncSubmit}>
          <Button type="submit">Submit</Button>
        </Form>
      );
      
      await user.click(screen.getByRole('button', { name: /submit/i }));
      await waitFor(() => expect(handleAsyncSubmit).toHaveBeenCalledTimes(1));
    });
  });

  describe('FormField Component', () => {
    it('should render with label', () => {
      render(
        <Form onSubmit={() => {}}>
          <FormField label="Email" htmlFor="email">
            <Input id="email" />
          </FormField>
        </Form>
      );
      
      expect(screen.getByLabelText('Email')).toBeInTheDocument();
    });

    it('should show optional text when optional is true', () => {
      render(
        <Form onSubmit={() => {}}>
          <FormField label="Bio" htmlFor="bio" optional>
            <Input id="bio" />
          </FormField>
        </Form>
      );
      
      expect(screen.getByText('Optional')).toBeInTheDocument();
    });

    it('should show error message when error is provided', () => {
      render(
        <Form onSubmit={() => {}}>
          <FormField 
            label="Password" 
            htmlFor="password" 
            error="Password must be at least 8 characters"
          >
            <Input id="password" type="password" />
          </FormField>
        </Form>
      );
      
      expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    });

    it('should show hint when provided and no error', () => {
      render(
        <Form onSubmit={() => {}}>
          <FormField 
            label="Password" 
            htmlFor="password" 
            hint="Use a strong password with at least 8 characters"
          >
            <Input id="password" type="password" />
          </FormField>
        </Form>
      );
      
      expect(screen.getByText('Use a strong password with at least 8 characters')).toBeInTheDocument();
    });
  });

  describe('FormActions Component', () => {
    it('should render children correctly', () => {
      render(
        <Form onSubmit={() => {}}>
          <FormActions>
            <Button>Cancel</Button>
            <Button type="submit">Submit</Button>
          </FormActions>
        </Form>
      );
      
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });
  });
}); 