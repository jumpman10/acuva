import React from 'react';

export type CardProps<T extends React.ElementType = 'div'> = {
  as?: T;
  className?: string;
  children?: React.ReactNode;
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>;

export const Card = <T extends React.ElementType = 'div'>({
  as,
  className = '',
  children,
  ...props
}: CardProps<T>) => {
  const Component = as || 'div';

  return (
    <Component
      className={`bg-surface-100 border border-border-subtle rounded-[20px] p-[18px] ${className}`}
      {...props}
    >
      {children}
    </Component>
  );
};

