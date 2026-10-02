#!/bin/sh
# Prepara fotos para uma notícia: converte para JPEG (qualidade 82) e reduz
# para no máximo 2000 px de largura, sem aumentar fotos menores.
# Uso:   scripts/preparar-fotos.sh <slug> <foto> [foto…]
# Saída: img/noticias/<slug>/<nome-da-foto>.jpg
# Requer macOS (usa o sips, que já vem com o sistema).
set -eu

if [ $# -lt 2 ]; then
  echo "Uso: $0 <slug> <foto> [foto…]" >&2
  exit 1
fi
if ! command -v sips >/dev/null 2>&1; then
  echo "Este script usa o sips (macOS). Em outros sistemas, use https://squoosh.app" >&2
  exit 1
fi

slug="$1"; shift
dest="img/noticias/$slug"
mkdir -p "$dest"

for src in "$@"; do
  name=$(basename "$src" | sed 's/\.[^.]*$//' | tr '[:upper:] ' '[:lower:]-')
  out="$dest/$name.jpg"
  width=$(sips -g pixelWidth "$src" | awk '/pixelWidth/ {print $2}')

  if [ "$width" -gt 2000 ]; then
    sips -s format jpeg -s formatOptions 82 --resampleWidth 2000 "$src" --out "$out" >/dev/null
  else
    sips -s format jpeg -s formatOptions 82 "$src" --out "$out" >/dev/null
  fi

  final=$(sips -g pixelWidth "$out" | awk '/pixelWidth/ {print $2}')
  size=$(du -k "$out" | cut -f1)
  note=""
  [ "$final" -lt 1600 ] && note="  ← menos de 1600 px: vai aparecer menor para continuar nítida"
  echo "$out  ${final}px  ${size} KB$note"
done
