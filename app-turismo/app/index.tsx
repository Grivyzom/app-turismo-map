import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function RootIndex() {
  // Reenvía la query (`?s=`, `?auth=`, `?action=`…) para no perderla en la redirección
  const params = useLocalSearchParams();
  return <Redirect href={{ pathname: '/(home)', params }} />;
}
