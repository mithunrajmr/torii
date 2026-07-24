// tests/setup.js
import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Environment defaults for tests
process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.DOMAIN = 'localhost:3000';
process.env.REDIS_URL = 'https://mock-redis.upstash.io';
process.env.REDIS_TOKEN = 'mock-token';
process.env.SUPABASE_DB_URL = 'postgres://postgres:postgres@localhost:5432/postgres';
