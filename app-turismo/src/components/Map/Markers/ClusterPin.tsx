import React from 'react';
import { View, Text } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { TurismoEvent } from '../types';
import { getCategoryIcon } from '../../../utils/mapUtils';

interface ClusterPinProps {
  count: number;
  dominantCategory: TurismoEvent['category'];
  color: string;
}

export const ClusterPin = React.memo(({ count, dominantCategory, color }: ClusterPinProps) => {
  const iconName = getCategoryIcon(dominantCategory, undefined);
  const shadowColor = color;

  return (
    <View
      style={{
        backgroundColor: color,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        shadowColor: shadowColor,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.42,
        shadowRadius: 7,
        elevation: 6,
      }}
    >
      <MaterialIcons name={iconName} size={13} color="#0F172A" strokeWidth={2.5} />
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#0F172A', lineHeight: 14 }}>
        {count > 99 ? '99+' : count}
      </Text>
    </View>
  );
});

ClusterPin.displayName = 'ClusterPin';
