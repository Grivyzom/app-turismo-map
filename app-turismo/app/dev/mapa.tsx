import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, StyleSheet, TouchableOpacity, Text, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Stack, router } from 'expo-router';

import { useAuth } from '../../src/context/AuthContext';
import { useHomeScreenState } from '../(home)/useHomeScreenState';
import { MapContainer } from '../../src/components/Map/MapContainer';
import {
  RouterHUD,
  TacticalHUD,
  DevSimulatorHUD,
  CreateSectorModal,
  DevToolbar,
  SectorConfigPanel,
  CoordsEditorHUD,
} from '../../src/components/MapUI';
import { CreatePointModal } from '../../src/components/MapUI/CreatePointModal';

const screenWidth = Dimensions.get('window').width;

export default function DevMapaScreen() {
  const { token } = useAuth();
  const state = useHomeScreenState(token);
  const [formAddress, setFormAddress] = useState('');
  const [showSimulatorHUD, setShowSimulatorHUD] = useState(false);
  const [showSectorForm, setShowSectorForm] = useState(false);
  const [isDrawingSector, setIsDrawingSector] = useState(false);
  const [showSectorConfig, setShowSectorConfig] = useState(false);
  const [showCoordsEditor, setShowCoordsEditor] = useState(false);

  // Auto-activar el enrutador al cargar
  useEffect(() => {
    state.setIsRoutingActive(true);
    state.setRoutingType('ciclovia');
    state.setShowCycleways(true);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <StatusBar style="light" />

      <View style={styles.mapWrapper}>
        <TouchableOpacity style={styles.backButtonOverlay} onPress={() => router.push('/dev')}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <MapContainer
          events={state.filteredEvents}
          selectedEvent={state.selectedEvent}
          onSelectEvent={state.handleSelectEvent}
          mapLayer={state.mapLayer}
          centerTrigger={state.centerTrigger}
          tacticalMode={state.isTacticalModeActive}
          onTacticalLocationChange={state.setTacticalLocation}
          onMapPincho={state.handleMapPincho}
          mapPincho={state.mapPincho}
          zoom={state.zoom}
          onZoomChange={state.setZoom}
          onBoundsChange={state.setMapBounds}
          showTraffic={state.showTraffic}
          showCycleways={state.showCycleways}
          cyclewaysData={state.cycleways}
          showSectors={state.showSectors}
          sectorsData={state.sectors}
          visibleSectorIds={state.visibleSectorIds}
          showWeather={state.showWeather}
          weatherType={state.weatherType}
          isFrozen={false}
          onSaveLocation={() => {}}
          isMagicWandActive={state.isMagicWandActive}
          onMagicWandSelect={(geom) => {
            state.setExtractedGeometry(geom);
            state.setIsMagicWandActive(false); // Desactivar después de seleccionar
          }}
          isRoutingActive={state.isRoutingActive}
          routingType={state.routingType}
          draftRoutePoints={state.draftRoutePoints}
          onMapClickForRouting={state.handleMapClickForRouting}
          isRouteFinished={state.isRouteFinished}
          savedRoutes={state.showSavedRoutes ? state.savedRoutes : []}
          onRateRoute={state.rateRoute}
        />
      </View>

      {/* HUD Táctico (Creador de Puntos) */}
      {state.isTacticalModeActive && state.tacticalLocation && (
        <TacticalHUD
          tacticalLocation={state.tacticalLocation}
          isResolvingAddress={state.isResolvingAddress}
          resolvedAddress={state.resolvedAddress}
          setShowCreateEventModal={state.setShowCreateEventModal}
          screenWidth={screenWidth}
        />
      )}

      {/* Router HUD rendered over the map */}
      {state.isRoutingActive && (
        <RouterHUD
          isRoutingActive={state.isRoutingActive}
          routingType={state.routingType}
          setRoutingType={state.setRoutingType}
          routeCategory={state.routeCategory}
          setRouteCategory={state.setRouteCategory}
          draftRoutePoints={state.draftRoutePoints}
          setDraftRoutePoints={state.setDraftRoutePoints}
          draftRouteName={state.draftRouteName}
          setDraftRouteName={state.setDraftRouteName}
          isRouteFinished={state.isRouteFinished}
          onFinishSingleTarget={state.finishSingleTargetRoute}
          onSave={state.saveRoute}
          onCancel={state.cancelRouting}
        />
      )}

      {!state.isTacticalModeActive &&
        !showSimulatorHUD &&
        (!state.isRoutingActive || state.routingType === 'sector') && (
          <DevToolbar
            onSimulatorPress={() => setShowSimulatorHUD(true)}
            onNewPointPress={() => state.setIsTacticalModeActive(true)}
            onNewSectorPress={() => {
              setShowSectorForm(true);
            }}
            onConfigSectorsPress={() => setShowSectorConfig(true)}
            onMagicWandPress={() => {
              state.setIsMagicWandActive(!state.isMagicWandActive);
              if (!state.isMagicWandActive)
                state.showNotification('Varita Mágica activada: Haz clic en un edificio');
            }}
            isMagicWandActive={state.isMagicWandActive}
            onNewRoutePress={() => {
              state.setIsRoutingActive(true);
              state.setRoutingType('ciclovia');
            }}
            onCoordsEditorPress={() => setShowCoordsEditor(true)}
          />
        )}

      {showSimulatorHUD && (
        <DevSimulatorHUD
          activeEvents={state.events}
          onInjectEvent={state.injectSimulationEvent}
          onMoveEvent={state.moveSimulationEvent}
          onClose={() => setShowSimulatorHUD(false)}
        />
      )}

      {showCoordsEditor && (
        <CoordsEditorHUD
          onClose={() => setShowCoordsEditor(false)}
          crosshairLocation={state.tacticalLocation}
          onRefreshMapData={() => {
            // Refetch or trigger re-render of coords if needed
          }}
        />
      )}

      <CreatePointModal
        visible={state.showCreateEventModal}
        onClose={() => state.setShowCreateEventModal(false)}
        tacticalLocation={state.tacticalLocation}
        formAddress={formAddress}
        setFormAddress={setFormAddress}
        handleCreateNewEvent={state.handleCreateNewEvent}
        showNotification={state.showNotification}
      />

      <CreateSectorModal
        visible={
          showSectorForm ||
          !!state.extractedGeometry ||
          (state.isRoutingActive && state.routingType === 'sector' && state.isRouteFinished)
        }
        hidden={isDrawingSector && !state.isRouteFinished}
        onClose={() => {
          setShowSectorForm(false);
          setIsDrawingSector(false);
          if (state.extractedGeometry) {
            state.setExtractedGeometry(null);
          }
          if (state.isRoutingActive && state.routingType === 'sector') {
            state.setIsRoutingActive(false);
            state.setDraftRoutePoints([]);
            state.setIsRouteFinished(false);
          }
        }}
        extractedGeometry={state.extractedGeometry}
        draftRoutePoints={
          state.isRoutingActive && state.routingType === 'sector' && state.isRouteFinished
            ? state.draftRoutePoints
            : undefined
        }
        showNotification={state.showNotification}
        onStartDrawing={() => {
          setIsDrawingSector(true);
          state.setIsRoutingActive(true);
          state.setRoutingType('sector');
        }}
        onSuccess={() => {
          setShowSectorForm(false);
          setIsDrawingSector(false);
          if (state.isRoutingActive && state.routingType === 'sector') {
            state.setIsRoutingActive(false);
            state.setDraftRoutePoints([]);
            state.setIsRouteFinished(false);
          }
        }}
      />

      {showSectorConfig && (
        <SectorConfigPanel
          sectors={state.sectors}
          visibleSectorIds={state.visibleSectorIds}
          onToggleSector={(sectorId) => {
            state.setVisibleSectorIds((prev) =>
              prev.includes(sectorId) ? prev.filter((id) => id !== sectorId) : [...prev, sectorId],
            );
          }}
          showSectors={state.showSectors}
          onToggleAll={state.setShowSectors}
          onClose={() => setShowSectorConfig(false)}
          isDevMode={true}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F19',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(11, 15, 25, 0.9)',
    zIndex: 10,
  },
  backButton: {
    marginRight: 12,
    padding: 4,
  },
  title: {
    color: '#34D399',
    fontSize: 18,
    fontWeight: '700',
  },
  mapWrapper: {
    flex: 1,
  },
  backButtonOverlay: {
    position: 'absolute',
    top: 60,
    left: 20,
    zIndex: 100,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(11, 15, 25, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  floatingButton: {
    position: 'absolute',
    bottom: 40,
    right: 20,
    backgroundColor: '#34D399',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
});
