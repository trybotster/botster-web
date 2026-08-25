#!/bin/sh
# Frozen sibling-flood workload. Byte count is the format constant.
bytes=262144
chunk=4096
written=0
while [ "$written" -lt "$bytes" ]; do
  remain=$((bytes - written))
  if [ "$remain" -gt "$chunk" ]; then
    remain=$chunk
  fi
  dd if=/dev/zero bs="$remain" count=1 2>/dev/null | tr '\0' 'A'
  written=$((written + remain))
done
printf '\n'
