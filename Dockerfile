# --- Stage 1: build the frontend -------------------------------------------
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend

ARG VITE_API_TOKEN
ENV VITE_API_TOKEN=$VITE_API_TOKEN

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# --- Stage 2: build the backend ---------------------------------------------
FROM golang:1.22-alpine AS backend-build
WORKDIR /app/backend

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./
RUN CGO_ENABLED=0 go build -o /app/einding .

# --- Stage 3: final runtime image -------------------------------------------
FROM alpine:3.20
RUN apk add --no-cache ca-certificates
WORKDIR /app

COPY --from=backend-build /app/einding ./einding
COPY --from=frontend-build /app/frontend/dist ./frontend/dist

ENV STATIC_DIR=frontend/dist
EXPOSE 8080

ENTRYPOINT ["./einding"]
