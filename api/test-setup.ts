#!/usr/bin/env bun
// Preload test (lihat bunfig.toml).
// Test wajib pakai DB in-memory, bukan file .env, supaya tidak mengotori data lokal.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET ??= 'test-secret';
process.env.BASIC_AUTH_USERNAME ??= 'admin';
process.env.BASIC_AUTH_PASSWORD ??= 'admin';
process.env.BASIC_AUTH_SALT ??= 'dev-salt-test';
process.env.BASIC_AUTH_ITERATIONS ??= '100000';