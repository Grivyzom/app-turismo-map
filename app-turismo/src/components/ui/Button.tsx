import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, TouchableOpacityProps } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  label: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  // Styles for the container
  const baseContainerStyles = 'flex-row items-center justify-center rounded-lg active:opacity-80';

  const variantContainerStyles = {
    primary: 'bg-blue-600',
    secondary: 'bg-gray-200',
    outline: 'bg-transparent border border-blue-600',
    ghost: 'bg-transparent',
  };

  const sizeContainerStyles = {
    sm: 'px-3 py-1.5',
    md: 'px-4 py-3',
    lg: 'px-6 py-4',
  };

  const disabledContainerStyles = disabled || isLoading ? 'opacity-50' : '';

  // Styles for the text
  const baseTextStyles = 'font-medium text-center';

  const variantTextStyles = {
    primary: 'text-white',
    secondary: 'text-gray-800',
    outline: 'text-blue-600',
    ghost: 'text-blue-600',
  };

  const sizeTextStyles = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
  };

  return (
    <TouchableOpacity
      className={`${baseContainerStyles} ${variantContainerStyles[variant]} ${sizeContainerStyles[size]} ${disabledContainerStyles} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'primary' ? 'white' : '#2563eb'} className="mr-2" />
      ) : null}
      <Text className={`${baseTextStyles} ${variantTextStyles[variant]} ${sizeTextStyles[size]}`}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}
