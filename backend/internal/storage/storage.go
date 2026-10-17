// Package storage envuelve un object storage S3-compatible (Cloudflare R2 en
// producción, RustFS en desarrollo). El backend nunca recibe los bytes de los
// archivos: firma URLs para que el cliente suba directo al bucket y luego
// verifica el objeto con un HEAD.
package storage

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
)

// ImmutableCache se firma en la subida: cada archivo tiene key única, así que
// el CDN y el cliente pueden cachearlo para siempre sin invalidaciones.
const ImmutableCache = "public, max-age=31536000, immutable"

var ErrNotConfigured = errors.New("object storage no configurado")

type Client struct {
	mc        *minio.Client
	bucket    string
	publicURL string
}

type ObjectInfo struct {
	Size        int64
	ContentType string
}

var defaultClient *Client

// Init lee S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET, S3_PUBLIC_URL,
// S3_REGION (opcional, "auto" para R2) y S3_USE_SSL (opcional, default true).
// Si falta configuración deja el cliente en nil: los endpoints de subida
// responden 503 pero el resto del backend funciona.
func Init() error {
	endpoint := os.Getenv("S3_ENDPOINT")
	bucket := os.Getenv("S3_BUCKET")
	publicURL := strings.TrimRight(os.Getenv("S3_PUBLIC_URL"), "/")
	if endpoint == "" || bucket == "" || publicURL == "" {
		return ErrNotConfigured
	}

	region := os.Getenv("S3_REGION")
	if region == "" {
		region = "auto"
	}

	mc, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(os.Getenv("S3_ACCESS_KEY"), os.Getenv("S3_SECRET_KEY"), ""),
		Secure: os.Getenv("S3_USE_SSL") != "false",
		Region: region,
	})
	if err != nil {
		return err
	}

	defaultClient = &Client{mc: mc, bucket: bucket, publicURL: publicURL}
	return nil
}

// Default devuelve el cliente inicializado o nil si no hay storage configurado.
func Default() *Client {
	return defaultClient
}

// PresignPut firma una subida PUT. El cliente debe enviar exactamente los
// headers Content-Type y Cache-Control indicados, porque forman parte de la firma.
func (c *Client) PresignPut(ctx context.Context, key, contentType string, expires time.Duration) (string, http.Header, error) {
	headers := http.Header{}
	headers.Set("Content-Type", contentType)
	headers.Set("Cache-Control", ImmutableCache)

	u, err := c.mc.PresignHeader(ctx, http.MethodPut, c.bucket, key, expires, url.Values{}, headers)
	if err != nil {
		return "", nil, err
	}
	return u.String(), headers, nil
}

func (c *Client) Stat(ctx context.Context, key string) (ObjectInfo, error) {
	info, err := c.mc.StatObject(ctx, c.bucket, key, minio.StatObjectOptions{})
	if err != nil {
		return ObjectInfo{}, err
	}
	return ObjectInfo{Size: info.Size, ContentType: info.ContentType}, nil
}

func (c *Client) Delete(ctx context.Context, key string) error {
	return c.mc.RemoveObject(ctx, c.bucket, key, minio.RemoveObjectOptions{})
}

// PublicURL es la URL servida por el CDN para una key.
func (c *Client) PublicURL(key string) string {
	return c.publicURL + "/" + key
}

// KeyFromPublicURL hace el camino inverso; devuelve "" si la URL no es de este bucket.
func (c *Client) KeyFromPublicURL(u string) string {
	prefix := c.publicURL + "/"
	if !strings.HasPrefix(u, prefix) {
		return ""
	}
	return strings.TrimPrefix(u, prefix)
}
