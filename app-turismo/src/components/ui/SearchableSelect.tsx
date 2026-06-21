import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';

interface SearchableSelectProps {
  options: { label: string; value: string; color?: string }[];
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  label?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  label
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchQuery.toLowerCase()) || opt.value === 'nuevo +'
  );

  const selectedOption = options.find(opt => opt.value === value);

  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <TouchableOpacity
        style={styles.selector}
        activeOpacity={0.7}
        onPress={() => setIsOpen(!isOpen)}
      >
        <Text style={[styles.selectorText, !selectedOption && styles.placeholderText]}>
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <MaterialIcons name={isOpen ? "arrow-drop-up" : "arrow-drop-down"} size={24} color="#A0AEC0" />
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.dropdown}>
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={18} color="#A0AEC0" />
            <TextInput
              style={styles.searchInput}
              placeholder="Buscar..."
              placeholderTextColor="#718096"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <MaterialIcons name="close" size={16} color="#A0AEC0" />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView style={styles.optionsList} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
            {filteredOptions.length === 0 ? (
              <Text style={styles.noResultsText}>No se encontraron resultados</Text>
            ) : (
              filteredOptions.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.optionItem, value === opt.value && styles.optionItemSelected]}
                  onPress={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchQuery('');
                  }}
                >
                  <Text style={[
                    styles.optionText, 
                    value === opt.value && styles.optionTextSelected,
                    opt.color ? { color: opt.color } : null
                  ]}>
                    {opt.label}
                  </Text>
                  {value === opt.value && <MaterialIcons name="check" size={18} color="#34D399" />}
                </TouchableOpacity>
              ))
            )}
          </ScrollView>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    position: 'relative',
    zIndex: 100, // Important for dropdown overlapping
  },
  label: {
    color: '#A0AEC0',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    letterSpacing: 0.5,
    textTransform: 'uppercase'
  },
  selector: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectorText: {
    color: '#FFFFFF',
    fontSize: 13,
  },
  placeholderText: {
    color: '#4A5568',
  },
  dropdown: {
    marginTop: 4,
    backgroundColor: '#1A202C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    maxHeight: 220,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  optionsList: {
    maxHeight: 170,
  },
  optionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.03)',
  },
  optionItemSelected: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  optionText: {
    color: '#CBD5E0',
    fontSize: 13,
  },
  optionTextSelected: {
    color: '#34D399',
    fontWeight: '700',
  },
  noResultsText: {
    color: '#718096',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  }
});
