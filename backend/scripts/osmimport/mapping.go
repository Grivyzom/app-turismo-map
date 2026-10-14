package osmimport

import (
	"fmt"
	"strings"
)

func str(v interface{}) string {
	s, _ := v.(string)
	return s
}

// CategoryForLayer mapea un feature crudo de Overpass a una categoria del
// enum TurismoEvent.category del frontend (app-turismo/src/components/Map/types.ts).
// Devuelve "" cuando el feature debe descartarse (hoy solo pasa en mobiliario
// con un amenity que no nos interesa).
func CategoryForLayer(sourceLayer string, props map[string]interface{}) string {
	switch sourceLayer {
	case "parques":
		return "parque"
	case "agua":
		return "agua"
	case "humedales":
		return "humedal"
	case "universidades":
		return "universidad"
	case "hospitales":
		if str(props["amenity"]) == "clinic" {
			return "clinica"
		}
		return "hospital"
	case "seguridad":
		switch str(props["amenity"]) {
		case "police":
			return "carabinero"
		case "fire_station":
			return "bombero"
		default:
			return "camara"
		}
	case "estructuras":
		tourism := str(props["tourism"])
		if tourism == "artwork" {
			switch str(props["artwork_type"]) {
			case "statue":
				return "estatua"
			case "sculpture":
				return "escultura"
			default:
				return "arte"
			}
		}
		if str(props["man_made"]) == "tower" || str(props["building"]) == "tower" {
			return "torreon"
		}
		return "arte"
	case "mobiliario":
		switch str(props["amenity"]) {
		case "bench":
			return "banca"
		case "waste_basket":
			return "basurero"
		case "drinking_water":
			return "bebedero"
		case "toilets":
			return "bano"
		default:
			return ""
		}
	case "buildings":
		if str(props["type"]) == "university" {
			return "universidad"
		}
		return "edificio"
	default:
		return ""
	}
}

var baseTagKeys = []string{
	"name", "operator", "opening_hours", "phone",
	"addr:street", "object:street",
	"amenity", "tourism", "artwork_type", "man_made", "building",
}

var buildingOnlyTagKeys = []string{"height", "levels", "type"}

// BuildOsmTags copia del feature original solo las propiedades OSM que la UI
// ya usa hoy, para servir de insumo estructurado a una fase futura de embeddings.
func BuildOsmTags(sourceLayer string, props map[string]interface{}) map[string]interface{} {
	tags := make(map[string]interface{})
	keys := baseTagKeys
	if sourceLayer == "buildings" {
		keys = append(append([]string{}, baseTagKeys...), buildingOnlyTagKeys...)
	}
	for _, k := range keys {
		if v, ok := props[k]; ok {
			tags[k] = v
		}
	}
	return tags
}

// PolygonCentroid promedia los vertices de un anillo [lng,lat], igual que
// getPolygonCenter en app-turismo/src/utils/locationUtils.ts:32-77 (omite el
// ultimo punto si el anillo viene cerrado, para no darle doble peso).
func PolygonCentroid(ring [][2]float64) (lat, lng float64) {
	if len(ring) == 0 {
		return 0, 0
	}
	limit := len(ring)
	first, last := ring[0], ring[limit-1]
	if limit > 1 && first[0] == last[0] && first[1] == last[1] {
		limit--
	}
	if limit <= 0 {
		return ring[0][1], ring[0][0]
	}
	var sumLat, sumLng float64
	for i := 0; i < limit; i++ {
		sumLng += ring[i][0]
		sumLat += ring[i][1]
	}
	return sumLat / float64(limit), sumLng / float64(limit)
}

// ExtractOsmID replica el fallback que usa el frontend
// (f.properties['@id'] || f.id || i, ver polygonsData.ts:14) y agrega un
// fallback extra a properties.id prefijado por sourceLayer, necesario porque
// valdivia_buildings.json no trae "@id" ni id de nivel superior, solo
// properties.id (un entero OSM crudo que podria colisionar entre capas).
func ExtractOsmID(sourceLayer string, index int, props map[string]interface{}, topID interface{}) string {
	if v, ok := props["@id"]; ok {
		if s := fmt.Sprintf("%v", v); s != "" {
			return strings.ReplaceAll(s, "/", "-")
		}
	}
	if topID != nil {
		if s := fmt.Sprintf("%v", topID); s != "" && s != "<nil>" {
			return strings.ReplaceAll(s, "/", "-")
		}
	}
	if v, ok := props["id"]; ok {
		if s := fmt.Sprintf("%v", v); s != "" {
			return fmt.Sprintf("%s-%s", sourceLayer, s)
		}
	}
	return fmt.Sprintf("%s-%d", sourceLayer, index)
}
