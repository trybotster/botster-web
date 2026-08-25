stty -echo 2>/dev/null || true
printf 'botster-baseline-ready\n'
while IFS= read -r line; do
  case "$line" in
    botster-baseline-probe:*)
      m=${line#botster-baseline-probe:}
      m=${m%$'\r'}
      printf '%s %s\n' "$EPOCHREALTIME" "$m" >> __BOTSTER_BASELINE_LOG_PATH__
      printf '%s %s post\n' "$EPOCHREALTIME" "$m" >> __BOTSTER_BASELINE_LOG_PATH__
      printf 'botster-baseline-paint:%s\n' "$m"
      ;;
    botster-baseline-exit) exit 0 ;;
  esac
done
