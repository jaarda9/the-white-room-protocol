// Loads .env.local into process.env for the local Express server. Must be the first import in
// server.ts: the API handlers read process.env at module load, and ES imports evaluate in order.
// Vercel injects its own env vars and never runs this file.
try {
  process.loadEnvFile('.env.local');
} catch {
  // No .env.local — fine in production or when vars come from the shell.
}
