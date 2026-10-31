#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")"
echo 'MoroShow — movie/series catalog setup'
echo 'Get your own TMDB API key or Read Access Token from https://www.themoviedb.org/settings/api'
echo 'This key supplies metadata. It does not supply or license videos.'
read -r -s -p 'Paste your key (hidden), then press Enter: ' tmdb_value
printf '\n'
if [ -z "$tmdb_value" ]; then echo 'No changes made.'; exit 1; fi
printf '%s' "$tmdb_value" | node --input-type=module -e '
import fs from "node:fs";
let key="";for await(const c of process.stdin)key+=c;
key=key.trim();if(!/^[A-Za-z0-9._-]+$/.test(key))throw new Error("Invalid key format");
let env=fs.existsSync(".env")?fs.readFileSync(".env","utf8"):"";
env=env.replace(/^TMDB_API_KEY=.*(?:\r?\n|$)/gm,"");
fs.writeFileSync(".env",env.trimEnd()+"\nTMDB_API_KEY="+key+"\n",{mode:0o600});
console.log("Saved. Restart START_MOROSHOW.command.");'
unset tmdb_value
