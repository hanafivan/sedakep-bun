#!/usr/bin/env bun
import { config } from '../api/config';
import { derivePasswordHash } from '../api/shared/password';

const password = Bun.argv[2];

if (!password) {
  console.error('Usage: bun run hash:basic-auth <password>');
  process.exit(1);
}

const { salt, iterations } = config.basicAuth;
const hash = await derivePasswordHash(password, salt, iterations);

console.log(hash);
