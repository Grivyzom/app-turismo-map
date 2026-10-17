package storage

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"os"
	"testing"
	"time"

	"github.com/minio/minio-go/v7"
)

// ensurePublicBucket crea el bucket con lectura anónima, como s3-init en docker-compose.
func ensurePublicBucket(t *testing.T, c *Client) {
	ctx := context.Background()
	exists, err := c.mc.BucketExists(ctx, c.bucket)
	if err != nil {
		t.Fatal(err)
	}
	if !exists {
		if err := c.mc.MakeBucket(ctx, c.bucket, minio.MakeBucketOptions{}); err != nil {
			t.Fatal(err)
		}
	}
	policy := fmt.Sprintf(`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"AWS":["*"]},"Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}`, c.bucket)
	if err := c.mc.SetBucketPolicy(ctx, c.bucket, policy); err != nil {
		t.Fatal(err)
	}
}

// Corre solo con un bucket real, p. ej. el RustFS de docker-compose (--profile storage):
//
//	S3_TEST=1 S3_ENDPOINT=localhost:9000 S3_USE_SSL=false S3_REGION=us-east-1 \
//	S3_ACCESS_KEY=devaccess S3_SECRET_KEY=devsecret123 S3_BUCKET=turismo-media \
//	S3_PUBLIC_URL=http://localhost:9000/turismo-media go test ./internal/storage
func TestPresignedUploadRoundTrip(t *testing.T) {
	if os.Getenv("S3_TEST") == "" {
		t.Skip("S3_TEST no definido")
	}
	if err := Init(); err != nil {
		t.Fatal(err)
	}
	c := Default()
	ctx := context.Background()
	if os.Getenv("S3_TEST_SETUP") != "" {
		ensurePublicBucket(t, c)
	}
	key := "menus/test/" + time.Now().Format("150405.000000") + ".pdf"
	body := []byte("%PDF-1.4 prueba")

	uploadURL, headers, err := c.PresignPut(ctx, key, "application/pdf", time.Minute)
	if err != nil {
		t.Fatal(err)
	}

	// Sin los headers firmados la subida debe rechazarse
	req, _ := http.NewRequest(http.MethodPut, uploadURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "text/html")
	if res, err := http.DefaultClient.Do(req); err != nil || res.StatusCode < 400 {
		t.Fatalf("subida con Content-Type distinto no fue rechazada: %v %v", res.StatusCode, err)
	}

	req, _ = http.NewRequest(http.MethodPut, uploadURL, bytes.NewReader(body))
	for k := range headers {
		req.Header.Set(k, headers.Get(k))
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil || res.StatusCode != http.StatusOK {
		t.Fatalf("subida firmada falló: %v %v", res.StatusCode, err)
	}

	info, err := c.Stat(ctx, key)
	if err != nil || info.Size != int64(len(body)) || info.ContentType != "application/pdf" {
		t.Fatalf("stat inesperado: %+v %v", info, err)
	}

	pub, err := http.Get(c.PublicURL(key))
	if err != nil || pub.StatusCode != http.StatusOK || pub.Header.Get("Cache-Control") != ImmutableCache {
		t.Fatalf("lectura pública: %v cache=%q %v", pub.StatusCode, pub.Header.Get("Cache-Control"), err)
	}
	if got := c.KeyFromPublicURL(c.PublicURL(key)); got != key {
		t.Fatalf("KeyFromPublicURL = %q", got)
	}

	if err := c.Delete(ctx, key); err != nil {
		t.Fatal(err)
	}
	if _, err := c.Stat(ctx, key); err == nil {
		t.Fatal("el objeto sigue existiendo tras Delete")
	}
}
