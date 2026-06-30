package handlers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
)

// likelihood ordena los valores de SafeSearch de menor a mayor.
var likelihood = map[string]int{
	"UNKNOWN":       0,
	"VERY_UNLIKELY": 1,
	"UNLIKELY":      2,
	"POSSIBLE":      3,
	"LIKELY":        4,
	"VERY_LIKELY":   5,
}

type visionRequest struct {
	Requests []visionImageRequest `json:"requests"`
}

type visionImageRequest struct {
	Image    visionImage    `json:"image"`
	Features []visionFeature `json:"features"`
}

type visionImage struct {
	Content string `json:"content"`
}

type visionFeature struct {
	Type       string `json:"type"`
	MaxResults int    `json:"maxResults"`
}

type visionResponse struct {
	Responses []struct {
		SafeSearchAnnotation struct {
			Adult    string `json:"adult"`
			Violence string `json:"violence"`
			Racy     string `json:"racy"`
		} `json:"safeSearchAnnotation"`
		Error *struct {
			Message string `json:"message"`
		} `json:"error"`
	} `json:"responses"`
}

// checkAvatarSafety retorna (true, nil) si la imagen es segura.
// Si GOOGLE_VISION_API_KEY no está configurada, permite la imagen (soft fail).
func checkAvatarSafety(imageBytes []byte, mimeType string) (safe bool, err error) {
	apiKey := os.Getenv("GOOGLE_VISION_API_KEY")
	if apiKey == "" {
		log.Println("[avatar_safety] GOOGLE_VISION_API_KEY no configurada — moderación omitida")
		return true, nil
	}

	encoded := base64.StdEncoding.EncodeToString(imageBytes)

	reqBody := visionRequest{
		Requests: []visionImageRequest{
			{
				Image: visionImage{Content: encoded},
				Features: []visionFeature{
					{Type: "SAFE_SEARCH_DETECTION", MaxResults: 1},
				},
			},
		},
	}

	body, err := json.Marshal(reqBody)
	if err != nil {
		return true, nil // no bloquear por error de serialización
	}

	url := fmt.Sprintf("https://vision.googleapis.com/v1/images:annotate?key=%s", apiKey)
	resp, err := http.Post(url, "application/json", bytes.NewReader(body))
	if err != nil {
		log.Printf("[avatar_safety] Error llamando Vision API: %v", err)
		return true, nil // soft fail: no bloquear si la API no responde
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return true, nil
	}

	var vr visionResponse
	if err := json.Unmarshal(respBytes, &vr); err != nil || len(vr.Responses) == 0 {
		return true, nil
	}

	r := vr.Responses[0]
	if r.Error != nil {
		log.Printf("[avatar_safety] Vision API error: %s", r.Error.Message)
		return true, nil
	}

	ss := r.SafeSearchAnnotation
	adult := likelihood[ss.Adult]
	violence := likelihood[ss.Violence]
	racy := likelihood[ss.Racy]

	// Rechazar si contenido explícito adulto o violento es LIKELY/VERY_LIKELY,
	// o si contenido sugestivo es VERY_LIKELY.
	if adult >= likelihood["LIKELY"] {
		return false, fmt.Errorf("contenido adulto detectado (%s)", ss.Adult)
	}
	if violence >= likelihood["LIKELY"] {
		return false, fmt.Errorf("contenido violento detectado (%s)", ss.Violence)
	}
	if racy >= likelihood["VERY_LIKELY"] {
		return false, fmt.Errorf("contenido inapropiado detectado (%s)", ss.Racy)
	}

	return true, nil
}
