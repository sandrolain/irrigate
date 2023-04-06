FROM golang:1.20.3 as builder
WORKDIR /build
COPY . .
RUN CGO_ENABLED=0 go build -o ./monitor ./src

FROM golang:1.20.3-alpine3.17
WORKDIR /usr/src/app
COPY --from=builder /build/monitor ./monitor
CMD ["./monitor"]
