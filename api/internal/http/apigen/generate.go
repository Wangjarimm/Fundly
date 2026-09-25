// Package apigen berisi tipe Go yang dibuat dari api-spec/openapi.yaml (D-06).
// Jangan diedit manual; ubah spesifikasi lalu jalankan `go generate ./...`.
package apigen

//go:generate go tool oapi-codegen -config cfg.yaml ../../../../api-spec/openapi.yaml
