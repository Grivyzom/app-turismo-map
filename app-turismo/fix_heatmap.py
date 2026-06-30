import os

file_path = "/grivyzom/webs/app-turismo-map/app-turismo/src/components/Map/MapLibreContainer.web.tsx"

with open(file_path, "r") as f:
    content = f.read()

# Insertion 1: Add syncCameraHeatmap definition
heatmap_func = """
  const syncCameraHeatmap = () => {
    const map = mapRef.current;
    if (!map || typeof map.isStyleLoaded !== 'function' || !map.isStyleLoaded()) return;

    const cameraEvents = events.filter((e) => e.category && e.category.toLowerCase() === 'camara');
    
    const featureCollection = {
      type: 'FeatureCollection',
      features: cameraEvents.map((e) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [e.longitude, e.latitude]
        },
        properties: {
          weight: 1
        }
      }))
    };

    if (map.getSource('camera-heatmap-source')) {
      (map.getSource('camera-heatmap-source') as maplibregl.GeoJSONSource).setData(featureCollection as any);
    } else {
      map.addSource('camera-heatmap-source', {
        type: 'geojson',
        data: featureCollection as any
      });
      
      const beforeId = getBeforeRoadsOrLabelsLayerId(map);
      
      map.addLayer({
        id: 'camera-heatmap-layer',
        type: 'heatmap',
        source: 'camera-heatmap-source',
        maxzoom: 18,
        paint: {
          'heatmap-weight': 1,
          'heatmap-intensity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 1,
            18, 3
          ],
          'heatmap-color': [
            'interpolate',
            ['linear'],
            ['heatmap-density'],
            0, 'rgba(59, 130, 246, 0)',
            0.2, 'rgba(96, 165, 250, 0.4)',
            0.4, 'rgba(147, 197, 253, 0.6)',
            0.6, 'rgba(167, 139, 250, 0.7)',
            0.8, 'rgba(139, 92, 246, 0.8)',
            1, 'rgba(124, 58, 237, 0.85)' // Purple/Blue neon for surveillance
          ],
          'heatmap-radius': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 20,
            18, 60
          ],
          'heatmap-opacity': [
            'interpolate',
            ['linear'],
            ['zoom'],
            11, 0.7,
            16, 0.7,
            18, 0
          ]
        }
      }, beforeId);
    }
  };

"""

# Replace insertion point 1
target_1 = "  syncEventPolygonsRef.current = syncEventPolygons;\n"
if target_1 in content:
    content = content.replace(target_1, target_1 + heatmap_func)
else:
    print("Could not find target_1")

# Replace insertion point 2
target_2 = """  const sync = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    syncEventPolygons();"""
    
replacement_2 = """  const sync = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    syncEventPolygons();
    syncCameraHeatmap();"""

if target_2 in content:
    content = content.replace(target_2, replacement_2)
else:
    print("Could not find target_2")

with open(file_path, "w") as f:
    f.write(content)

print("Done")
