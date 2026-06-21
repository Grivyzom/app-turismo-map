import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { TurismoEvent } from '../Map/types';
import { useGeoCheckIn } from '../../hooks/useGeoCheckIn';
import { useUserLocationContext } from '../../context/UserLocationContext';
import { CHECKIN_EXCLUDED_CATEGORIES, CheckInRecord } from '../../utils/checkInStorage';
import { getCategoryColor } from '../../utils/mapUtils';

interface EventCheckInSectionProps {
  selectedEvent: TurismoEvent;
  setCheckInModalRecord: (record: CheckInRecord | null) => void;
  setShowCheckInModal: (show: boolean) => void;
}

export const EventCheckInSection: React.FC<EventCheckInSectionProps> = ({
  selectedEvent,
  setCheckInModalRecord,
  setShowCheckInModal,
}) => {
  const { userLocation } = useUserLocationContext();
  const {
    isCheckedIn,
    isProcessing,
    checkInError,
    distanceMeters,
    effectiveRadius,
    attemptCheckIn,
  } = useGeoCheckIn(selectedEvent, userLocation);

  const categoryColor = getCategoryColor(selectedEvent.category, selectedEvent.musicStyle);

  return (
    <>
      <View style={styles.actionButtonsContainerPremium}>
        {CHECKIN_EXCLUDED_CATEGORIES.has(selectedEvent.category) ? (
          <TouchableOpacity
            style={[
              styles.actionBtnPremium,
              {
                backgroundColor: categoryColor,
              },
            ]}
            activeOpacity={0.8}
          >
            <Ionicons name="warning-outline" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnTextPremium}>Ver Reporte</Text>
          </TouchableOpacity>
        ) : isCheckedIn ? (
          <View style={[styles.actionBtnPremium, styles.checkInDoneBtn]}>
            <Ionicons name="checkmark-circle" size={18} color="#34D399" />
            <Text style={[styles.actionBtnTextPremium, { color: '#34D399' }]}>
              Check-in Realizado
            </Text>
          </View>
        ) : isProcessing ? (
          <View style={[styles.actionBtnPremium, styles.checkInProcessingBtn]}>
            <Ionicons name="locate" size={18} color="#A0AEC0" />
            <Text style={[styles.actionBtnTextPremium, { color: '#A0AEC0' }]}>Validando GPS…</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              styles.actionBtnPremium,
              {
                backgroundColor:
                  distanceMeters !== null && distanceMeters <= effectiveRadius
                    ? categoryColor
                    : 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                borderColor:
                  distanceMeters !== null && distanceMeters <= effectiveRadius
                    ? 'transparent'
                    : 'rgba(255,255,255,0.1)',
              },
            ]}
            activeOpacity={0.8}
            onPress={async () => {
              const result = await attemptCheckIn(selectedEvent, userLocation);
              if (result === 'success') {
                const { loadCheckIns } = await import('../../utils/checkInStorage');
                const records = await loadCheckIns();
                const newRecord = records.find((r) => r.eventId === selectedEvent.id) ?? null;
                setCheckInModalRecord(newRecord);
                setShowCheckInModal(true);
              }
            }}
          >
            <Ionicons name="location" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnTextPremium}>Check-in</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.iconBtnPremium} activeOpacity={0.7}>
          <Ionicons name="share-social-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtnPremium} activeOpacity={0.7}>
          <Ionicons name="bookmark-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Indicador de distancia en tiempo real */}
      {!CHECKIN_EXCLUDED_CATEGORIES.has(selectedEvent.category) && !isCheckedIn && (
        <View style={styles.distanceIndicatorRow}>
          <View
            style={[
              styles.distanceDot,
              {
                backgroundColor:
                  distanceMeters === null
                    ? '#4B5563'
                    : distanceMeters <= effectiveRadius
                      ? '#34D399'
                      : distanceMeters <= 600
                        ? '#F59E0B'
                        : '#EF4444',
              },
            ]}
          />
          <Text style={styles.distanceText}>
            {distanceMeters === null
              ? 'Obteniendo ubicación…'
              : distanceMeters <= effectiveRadius
                ? `✓ Estás en zona de check-in`
                : `A ${
                    distanceMeters < 1000
                      ? `${distanceMeters}m del lugar`
                      : `${(distanceMeters / 1000).toFixed(1)}km del lugar`
                  }`}
          </Text>
          {checkInError && (
            <Text style={styles.checkInErrorText} numberOfLines={1}>
              {checkInError}
            </Text>
          )}
        </View>
      )}
    </>
  );
};

const styles = StyleSheet.create({
  actionButtonsContainerPremium: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  actionBtnPremium: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnTextPremium: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  checkInDoneBtn: {
    backgroundColor: 'rgba(52, 211, 153, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.25)',
  },
  checkInProcessingBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  iconBtnPremium: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  distanceIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  distanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  distanceText: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '600',
  },
  checkInErrorText: {
    color: '#EF4444',
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 'auto',
  },
});
