#!/usr/bin/env node

import { copyFileSync, existsSync } from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(import.meta.dirname, "..");
const examplePath = path.join(repoRoot, ".env.example");
const envLocalPath = path.join(repoRoot, ".env.local");

if (!existsSync(examplePath)) {
  throw new Error(`Missing env template: ${path.relative(repoRoot, examplePath)}`);
}

if (existsSync(envLocalPath)) {
  process.stdout.write("Using existing .env.local\n");
  process.exit(0);
}

copyFileSync(examplePath, envLocalPath);
process.stdout.write("Created .env.local from .env.example\n");
