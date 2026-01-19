# Build Stage
FROM golang:1.25.6-bookworm AS build

WORKDIR /app

# Step 1: Copy dependency files first (changes less frequently)
COPY go.mod go.sum ./

# Step 2: Download dependencies (cached if go.mod/go.sum unchanged)
RUN go mod download

# Step 3: Copy source code (changes more frequently)
COPY . .

# Step 4: Build with CGO_ENABLED=1 for SQLite support
RUN CGO_ENABLED=1 go build -o server cmd/server/main.go

# Production Stage
FROM debian:bookworm-slim

# Install CA certificates for HTTPS requests if needed
RUN apt-get update && apt-get install -y ca-certificates && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=build /app/server /app/server

EXPOSE 8080

CMD ["./server"]
