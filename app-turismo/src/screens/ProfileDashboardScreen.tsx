import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';

type EntityType = 'citizen' | 'business' | 'creator' | 'media';

export default function ProfileDashboardScreen() {
  const [entityType, setEntityType] = useState<EntityType>('citizen');

  return (
    <ScrollView className="flex-1 bg-gray-900">
      {/* Header and Toggle for prototyping */}
      <View className="pt-12 pb-6 px-6 bg-gray-800 rounded-b-3xl shadow-lg border-b border-gray-700">
        <View className="flex-row justify-between items-center mb-6">
          <Text className="text-white text-2xl font-extrabold tracking-tight">Mi Perfil</Text>
          {(entityType === 'media' || entityType === 'creator') && (
            <View className="bg-blue-600 px-3 py-1 rounded-full flex-row items-center shadow-sm">
              <Text className="text-white text-xs font-bold tracking-wider">✓ OFICIAL</Text>
            </View>
          )}
        </View>

        {/* Profile Info */}
        <View className="flex-row items-center">
          <View className="w-20 h-20 bg-gray-700 rounded-full overflow-hidden border-2 border-indigo-500 shadow-md">
            <Image source={{ uri: 'https://i.pravatar.cc/150?img=11' }} className="w-full h-full" />
          </View>
          <View className="ml-5 flex-1">
            <Text className="text-white text-2xl font-bold">
              {entityType === 'citizen'
                ? 'Lucía Moreno'
                : entityType === 'business'
                  ? 'Cafetería Central'
                  : 'Juan Pérez Travel'}
            </Text>
            <Text className="text-indigo-300 mt-1 font-medium">
              {entityType === 'citizen'
                ? 'Explorador Novato'
                : entityType === 'business'
                  ? 'Cuenta Empresa • Pendiente'
                  : 'Periodista Independiente'}
            </Text>
          </View>
        </View>

        {/* Prototype Switcher */}
        <Text className="text-gray-400 text-xs mt-6 mb-2 uppercase tracking-widest font-bold">
          Simular Vista
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row">
          {(['citizen', 'business', 'creator', 'media'] as EntityType[]).map((type) => (
            <TouchableOpacity
              key={type}
              onPress={() => setEntityType(type)}
              className={`mr-3 px-5 py-2.5 rounded-full border ${entityType === type ? 'bg-indigo-600 border-indigo-500 shadow-lg' : 'bg-gray-800 border-gray-600'}`}
            >
              <Text
                className={`capitalize font-bold ${entityType === type ? 'text-white' : 'text-gray-300'}`}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Content based on entity type */}
      <View className="p-6">
        {entityType === 'citizen' && (
          <View>
            <Text className="text-white text-lg font-bold mb-4">Lugares Guardados</Text>
            <View className="bg-gray-800 p-5 rounded-2xl mb-5 border border-gray-700 shadow-sm">
              <Text className="text-indigo-400 font-bold text-lg">Parque Nacional Villarrica</Text>
              <Text className="text-gray-400 text-sm mt-1">Naturaleza • Guardado hace 2 días</Text>
            </View>
            <Text className="text-white text-lg font-bold mb-4 mt-2">Mis Intereses</Text>
            <View className="flex-row flex-wrap">
              {['Gastronomía', 'Tours', 'Historia', 'Arte Local'].map((interest) => (
                <View
                  key={interest}
                  className="bg-gray-800 border border-gray-600 px-5 py-2.5 rounded-full mr-3 mb-3 shadow-sm"
                >
                  <Text className="text-gray-200 font-medium">{interest}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {entityType === 'business' && (
          <View>
            <View className="bg-amber-900/40 border border-amber-700/50 p-5 rounded-2xl mb-6 shadow-sm">
              <Text className="text-amber-500 font-bold text-lg mb-1">En Revisión</Text>
              <Text className="text-amber-200/80 leading-5">
                Tu empresa está siendo verificada. Una vez aprobada, tus sucursales y promociones
                aparecerán en el mapa.
              </Text>
            </View>

            <View className="flex-row justify-between items-center mb-4 mt-2">
              <Text className="text-white text-lg font-bold">Mi Equipo (Sucursales)</Text>
              <Text className="text-indigo-400 font-bold">Ver Todas</Text>
            </View>

            <TouchableOpacity className="bg-indigo-600 p-4 rounded-2xl items-center mb-5 shadow-lg shadow-indigo-900/50">
              <Text className="text-white font-bold text-base">+ Generar Enlace de Invitación</Text>
            </TouchableOpacity>

            <View className="bg-gray-800 p-5 rounded-2xl border border-gray-700 shadow-sm flex-row justify-between items-center">
              <View>
                <Text className="text-white font-bold text-lg">Pedro Gómez</Text>
                <Text className="text-gray-400 text-sm mt-1">Manager • Sede Centro</Text>
              </View>
              <View className="w-10 h-10 bg-gray-700 rounded-full items-center justify-center">
                <Text className="text-gray-400">👤</Text>
              </View>
            </View>
          </View>
        )}

        {(entityType === 'creator' || entityType === 'media') && (
          <View>
            <View className="flex-row justify-between items-center mb-5 mt-2">
              <Text className="text-white text-lg font-bold">Mis Emisiones en el Mapa</Text>
              <Text className="text-indigo-400 font-bold">Historial</Text>
            </View>

            <View className="flex-row mb-6">
              <View className="bg-gray-800 flex-1 p-5 rounded-2xl border border-gray-700 mr-2 items-center shadow-sm">
                <Text className="text-indigo-400 text-3xl font-black">12</Text>
                <Text className="text-gray-400 text-xs mt-2 font-bold uppercase tracking-wider">
                  Activas
                </Text>
              </View>
              <View className="bg-gray-800 flex-1 p-5 rounded-2xl border border-gray-700 ml-2 items-center shadow-sm">
                <Text className="text-teal-400 text-3xl font-black">8.4k</Text>
                <Text className="text-gray-400 text-xs mt-2 font-bold uppercase tracking-wider">
                  Impacto
                </Text>
              </View>
            </View>

            <TouchableOpacity className="bg-indigo-600 p-4 rounded-2xl items-center shadow-lg shadow-indigo-900/50 mt-2">
              <Text className="text-white font-bold text-base">📍 Emitir Nuevo Suceso</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
