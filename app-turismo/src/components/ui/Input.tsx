import React, { useState } from 'react';
import {
  View,
  TextInput,
  Text,
  TextInputProps,
  TouchableOpacity,
  StyleProp,
  ViewStyle,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: keyof typeof Ionicons.glyphMap;
  rightIcon?: keyof typeof Ionicons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: StyleProp<ViewStyle>;
}

export function Input({
  label,
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
  className = '',
  containerStyle,
  secureTextEntry,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = useState(false);
  // Optional: keep track of password visibility if it is a password input
  const [isPasswordVisible, setIsPasswordVisible] = useState(!secureTextEntry);

  const isPasswordAndHasEye = secureTextEntry !== undefined;

  const togglePasswordVisibility = () => {
    setIsPasswordVisible(!isPasswordVisible);
  };

  const displayRightIcon = isPasswordAndHasEye
    ? isPasswordVisible
      ? ('eye-off' as const)
      : ('eye' as const)
    : rightIcon;

  const handleRightPress = isPasswordAndHasEye ? togglePasswordVisibility : onRightIconPress;

  return (
    <View style={containerStyle} className={`w-full mb-4 ${className}`}>
      {label && <Text className="text-sm font-medium text-gray-700 mb-1.5 ml-1">{label}</Text>}

      <View
        className={`flex-row items-center border rounded-lg bg-white px-3 h-12
          ${isFocused ? 'border-blue-600' : 'border-gray-300'}
          ${error ? 'border-red-500' : ''}
        `}
      >
        {leftIcon && (
          <Ionicons
            name={leftIcon}
            size={20}
            color={error ? '#ef4444' : isFocused ? '#2563eb' : '#9ca3af'}
            style={{ marginRight: 8 }}
          />
        )}

        <TextInput
          className="flex-1 text-base text-gray-900 h-full"
          placeholderTextColor="#9ca3af"
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          secureTextEntry={isPasswordAndHasEye && !isPasswordVisible}
          {...props}
        />

        {displayRightIcon && (
          <TouchableOpacity
            onPress={handleRightPress}
            activeOpacity={0.7}
            style={{ marginLeft: 8 }}
          >
            <Ionicons name={displayRightIcon} size={20} color={error ? '#ef4444' : '#9ca3af'} />
          </TouchableOpacity>
        )}
      </View>

      {error && <Text className="text-xs text-red-500 mt-1.5 ml-1">{error}</Text>}
    </View>
  );
}
