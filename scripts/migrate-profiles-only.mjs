import fs from 'node:fs';
import path from 'node:path';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) process.exit(2);
const state = JSON.parse(fs.readFileSync(source, 'utf8'));
if (!Array.isArray(state.profiles)) process.exit(1);
const profiles = state.profiles.map(p => ({
  id: p.id, name: p.name, avatar: p.avatar, isKid: Boolean(p.isKid),
  hasPin: Boolean(p.hasPin), pinSalt: p.pinSalt, pinHash: p.pinHash,
  createdAt: p.createdAt,
}));
fs.mkdirSync(path.dirname(destination), {recursive:true});
fs.writeFileSync(destination, JSON.stringify({profiles, history:[],favorites:[]}), {mode:0o600, flag:'wx'});
