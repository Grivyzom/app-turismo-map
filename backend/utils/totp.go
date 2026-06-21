package utils

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"math"
	"strings"
	"time"
)

// ValidateTOTP valida un código TOTP de 6 dígitos contra un secreto base32.
// Permite una ventana de ±1 período (30 segundos) para compensar desincronización
// de reloj entre el servidor y la app del usuario.
func ValidateTOTP(secret, code string) bool {
	if len(code) != 6 {
		return false
	}

	// Decodificar el secreto base32
	secretBytes, err := base32.StdEncoding.WithPadding(base32.NoPadding).DecodeString(
		strings.ToUpper(strings.TrimSpace(secret)),
	)
	if err != nil {
		return false
	}

	// Ventana de tiempo: verificar período actual, anterior y siguiente
	now := time.Now().Unix()
	for _, offset := range []int64{-1, 0, 1} {
		counter := (now / 30) + offset
		expected := generateTOTPCode(secretBytes, counter)
		if hmac.Equal([]byte(code), []byte(expected)) {
			return true
		}
	}

	return false
}

// generateTOTPCode genera un código TOTP de 6 dígitos para un counter dado.
// Implementación RFC 6238 (TOTP) basada en RFC 4226 (HOTP).
func generateTOTPCode(secret []byte, counter int64) string {
	// Convertir counter a bytes (big-endian, 8 bytes)
	buf := make([]byte, 8)
	binary.BigEndian.PutUint64(buf, uint64(counter))

	// HMAC-SHA1
	mac := hmac.New(sha1.New, secret)
	mac.Write(buf)
	hash := mac.Sum(nil)

	// Dynamic Truncation (RFC 4226 §5.4)
	offset := hash[len(hash)-1] & 0x0F
	code := binary.BigEndian.Uint32(hash[offset:offset+4]) & 0x7FFFFFFF

	// Módulo 10^6 para obtener 6 dígitos
	otp := code % uint32(math.Pow10(6))
	return fmt.Sprintf("%06d", otp)
}
