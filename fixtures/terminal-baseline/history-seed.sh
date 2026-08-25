#!/bin/sh
# Frozen large-history workload. Line count and byte count are the format constants.
line_count=400
line_bytes=80
i=1
while [ "$i" -le "$line_count" ]; do
  printf '%s\n' "$(printf '%0*d' "$line_bytes" "$i")"
  i=$((i + 1))
done
