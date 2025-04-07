import {
  FormEvent,
  FormHTMLAttributes,
  ReactNode,
  createContext,
  useContext,
  useState,
} from 'react';

// Form context to track form state
interface FormContextType {
  isSubmitting: boolean;
  errors: Record<string, string>;
  setErrors: (errors: Record<string, string>) => void;
}

const FormContext = createContext<FormContextType | undefined>(undefined);

export interface FormProps extends FormHTMLAttributes<HTMLFormElement> {
  children: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void | Promise<void>;
  initialErrors?: Record<string, string>;
}

export const Form = ({
  children,
  onSubmit,
  className = '',
  initialErrors = {},
  ...props
}: FormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>(initialErrors);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    
    try {
      setIsSubmitting(true);
      await onSubmit(e);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormContext.Provider value={{ isSubmitting, errors, setErrors }}>
      <form
        className={`space-y-6 ${className}`}
        onSubmit={handleSubmit}
        noValidate
        {...props}
      >
        {children}
      </form>
    </FormContext.Provider>
  );
};

// Form Field component for label + input combinations
interface FormFieldProps {
  children: ReactNode;
  label: string;
  htmlFor: string;
  error?: string;
  optional?: boolean;
  hint?: string;
}

export const FormField = ({
  children,
  label,
  htmlFor,
  error,
  optional = false,
  hint,
}: FormFieldProps) => {
  const formContext = useContext(FormContext);
  const fieldError = error || (formContext?.errors[htmlFor] || '');

  return (
    <div className="space-y-1">
      <div className="flex justify-between">
        <label 
          htmlFor={htmlFor} 
          className="block text-sm font-medium text-gray-700"
        >
          {label}
        </label>
        {optional && (
          <span className="text-sm text-gray-500">Optional</span>
        )}
      </div>
      
      {children}
      
      {hint && !fieldError && (
        <p className="text-sm text-gray-500">{hint}</p>
      )}
      
      {fieldError && (
        <p className="text-sm text-red-600">{fieldError}</p>
      )}
    </div>
  );
};

// Form Actions component for submit/cancel buttons
interface FormActionsProps {
  children: ReactNode;
  className?: string;
}

export const FormActions = ({ children, className = '' }: FormActionsProps) => {
  return (
    <div className={`flex items-center justify-end space-x-3 ${className}`}>
      {children}
    </div>
  );
}; 