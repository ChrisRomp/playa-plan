import { HTMLAttributes, ReactNode } from 'react';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

export interface AlertBoxProps extends HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  children: ReactNode;
  icon?: ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
}

export const AlertBox = ({
  variant = 'info',
  title,
  children,
  icon,
  className = '',
  dismissible = false,
  onDismiss,
  ...props
}: AlertBoxProps) => {
  const variantStyles = {
    info: 'bg-primary-50 text-primary-800 border-primary-200',
    success: 'bg-success-50 text-success-800 border-success-200',
    warning: 'bg-warning-50 text-warning-800 border-warning-200',
    danger: 'bg-danger-50 text-danger-800 border-danger-200',
  };

  const iconColor = {
    info: 'text-primary-400',
    success: 'text-success-400',
    warning: 'text-warning-400',
    danger: 'text-danger-400',
  };

  return (
    <div
      className={`rounded-md border p-4 ${variantStyles[variant]} ${className}`}
      role="alert"
      {...props}
    >
      <div className="flex">
        {icon && <div className={`flex-shrink-0 ${iconColor[variant]}`}>{icon}</div>}
        <div className={`${icon ? 'ml-3' : ''} flex-grow`}>
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          <div className={`${title ? 'mt-2' : ''} text-sm`}>{children}</div>
        </div>
        {dismissible && onDismiss && (
          <div className="ml-auto pl-3">
            <div className="-mx-1.5 -my-1.5">
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2"
              >
                <span className="sr-only">Dismiss</span>
                <svg
                  className="h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
