# Stage 1: Build the Go binary
FROM golang:alpine AS builder

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

WORKDIR /app

# Copy dependency files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the application
# We compile statically and disable CGO to ensure it runs inside a minimal container
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o backend main.go checkin_handler.go places_handler.go

# Stage 2: Run the compiled binary in a lean Alpine image
FROM alpine:latest

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the compiled binary from the builder stage
COPY --from=builder /app/backend .

# Expose the API port
EXPOSE 8080

# Run the backend
CMD ["./backend"]
