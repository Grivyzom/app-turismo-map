const fs = require('fs');
const file = '/grivyzom/webs/app-turismo-map/app-turismo/app/(home)/index.tsx';
const lines = fs.readFileSync(file, 'utf8').split('\n');

// Find the start index (DIRECCIÓN FÍSICA REAL)
let startIdx = lines.findIndex((l) => l.includes('DIRECCIÓN FÍSICA REAL')) - 9; // go back to <Text
// Find the end index (reset form)
let endIdx =
  lines.findIndex((l, idx) => idx > startIdx && l.includes("setFormTime('12:00 - 18:00');")) + 1;

if (startIdx > 0 && endIdx > startIdx) {
  const newForm = `                <SearchableSelect
                  label="TIPO DE PUNTO"
                  value={formPointType}
                  onChange={setFormPointType}
                  options={[
                    { label: 'Fauna', value: 'Fauna' },
                    { label: 'Comercio', value: 'Comercio' },
                    { label: 'Evento', value: 'Evento' },
                    { label: 'Infraestructura', value: 'Infraestructura' },
                    { label: 'Punto de Interés', value: 'Punto de Interés' }
                  ]}
                  placeholder="Selecciona un tipo"
                />

                <SearchableSelect
                  label="CATEGORÍA"
                  value={formCategory}
                  onChange={setFormCategory}
                  options={[
                    { label: 'Cultura', value: 'Cultura' },
                    { label: 'Naturaleza', value: 'Naturaleza' },
                    { label: 'Gastronomía', value: 'Gastronomía' },
                    { label: 'Deportes', value: 'Deportes' },
                    { label: 'Música', value: 'Música' },
                    { label: 'Choque/Incidente', value: 'Choque' },
                    { label: 'Público', value: 'Público' }
                  ]}
                  placeholder="Selecciona una categoría"
                />

                <Text style={{ color: '#A0AEC0', fontSize: 10, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>PÚBLICO OBJETIVO</Text>
                <TextInput style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderRadius: 12, color: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, marginBottom: 16 }} placeholder="Ej. Todo Público" placeholderTextColor="#4A5568" value={formTargetAudience} onChangeText={setFormTargetAudience} />

                <Text style={{ color: '#A0AEC0', fontSize: 10, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>TÍTULO DEL PUNTO</Text>
                <TextInput style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderRadius: 12, color: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, marginBottom: 16 }} placeholder="Ej. Avistamiento de Lobos Marinos" placeholderTextColor="#4A5568" value={formTitle} onChangeText={setFormTitle} />

                <Text style={{ color: '#A0AEC0', fontSize: 10, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>DESCRIPCIÓN</Text>
                <TextInput style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderRadius: 12, color: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, height: 70, textAlignVertical: 'top', marginBottom: 16 }} placeholder="Escribe detalles del punto..." placeholderTextColor="#4A5568" multiline numberOfLines={3} value={formDescription} onChangeText={setFormDescription} />

                <Text style={{ color: '#A0AEC0', fontSize: 10, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>ICONO SVG | IMAGEN (URL)</Text>
                <TextInput style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderRadius: 12, color: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13, marginBottom: 16 }} placeholder="Ej. https://..." placeholderTextColor="#4A5568" value={formSvgIcon} onChangeText={setFormSvgIcon} />

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 16 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#A0AEC0', fontSize: 10, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>FECHA INICIO</Text>
                    <TextInput style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderRadius: 12, color: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13 }} placeholder="Ej. 10/06 10:00" placeholderTextColor="#4A5568" value={formStartDate} onChangeText={setFormStartDate} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#A0AEC0', fontSize: 10, fontWeight: '700', marginBottom: 6, letterSpacing: 0.5 }}>FECHA FIN</Text>
                    <TextInput style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', borderColor: 'rgba(255, 255, 255, 0.1)', borderWidth: 1, borderRadius: 12, color: '#FFFFFF', paddingHorizontal: 14, paddingVertical: 10, fontSize: 13 }} placeholder="Ej. 10/06 18:00" placeholderTextColor="#4A5568" value={formEndDate} onChangeText={setFormEndDate} />
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    if (!formTitle || (!tacticalLocation && !formAddress)) {
                      showNotification('El título y la dirección son requeridos.');
                      return;
                    }
                    handleCreateNewEvent(
                      formTitle,
                      formDescription || 'Sin descripción adicional.',
                      formCategory as any,
                      formTargetAudience || 'Ciudadano Reporta',
                      formStartDate + (formEndDate ? ' - ' + formEndDate : ''),
                      formAddress,
                    );
                    // Reset form
                    setFormTitle('');
                    setFormDescription('');
                    setFormTargetAudience('Todo Público');
                    setFormStartDate('');
                    setFormEndDate('');
                    setFormSvgIcon('');`;

  lines.splice(startIdx, endIdx - startIdx, newForm);
  fs.writeFileSync(file, lines.join('\n'));
  console.log('Successfully patched index.tsx!');
} else {
  console.log('Could not find boundaries.', startIdx, endIdx);
}
