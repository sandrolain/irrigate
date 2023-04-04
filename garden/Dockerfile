FROM golang:1.20 as builder
WORKDIR /build
COPY . .
RUN CGO_ENABLED=0 go build -o ./garden ./src

FROM golang:1.20-alpine3.17
WORKDIR /usr/src/app
COPY --from=builder /build/garden ./garden
CMD ["./garden"]
