import React from 'react';

type TextVariant = 
  | 'h1' 
  | 'h2' 
  | 'h3' 
  | 'h4' 
  | 'h5' 
  | 'h6' 
  | 'body' 
  | 'body-lg'
  | 'body-sm' 
  | 'caption';

export interface TextProps {
  variant?: TextVariant;
  color?: string;
  children: React.ReactNode;
  className?: string;
}

export const Text: React.FC<TextProps> = ({
  variant = 'body',
  color = 'text-secondary-900',
  children,
  className = '',
  ...props
}) => {
  const variantClassMap: Record<TextVariant, string> = {
    'h1': 'text-4xl font-bold',
    'h2': 'text-3xl font-bold',
    'h3': 'text-2xl font-bold',
    'h4': 'text-xl font-semibold',
    'h5': 'text-lg font-semibold',
    'h6': 'text-base font-semibold',
    'body': 'text-base',
    'body-lg': 'text-lg',
    'body-sm': 'text-sm',
    'caption': 'text-xs',
  };

  const variantElementMap: Record<TextVariant, keyof JSX.IntrinsicElements> = {
    'h1': 'h1',
    'h2': 'h2',
    'h3': 'h3',
    'h4': 'h4',
    'h5': 'h5',
    'h6': 'h6',
    'body': 'p',
    'body-lg': 'p',
    'body-sm': 'p',
    'caption': 'span',
  };

  const Element = variantElementMap[variant];
  const variantClass = variantClassMap[variant];

  return (
    <Element className={`${variantClass} ${color} ${className}`} {...props}>
      {children}
    </Element>
  );
};
