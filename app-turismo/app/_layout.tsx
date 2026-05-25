import React from 'react';
import { Stack } from 'expo-router';
import '../global.css';

export default function RootLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="index" options={{}} />
      <Stack.Screen name="login" options={{}} />
      <Stack.Screen name="registro" options={{}} />
      <Stack.Screen name="(home)" options={{}} />
    </Stack>
  );
}
