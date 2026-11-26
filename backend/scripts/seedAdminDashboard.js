import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { ensureAdminDashboardSeed } from '../services/adminSeedService.js';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

if (!process.env.MONGODB_URI) throw new Error('Set MONGODB_URI before seeding the admin dashboard.');

try {
  await mongoose.connect(process.env.MONGODB_URI);
  const result = await ensureAdminDashboardSeed();
  console.log(`Admin dashboard data ready (${result.coursesSeeded} legacy courses migrated).`);
} finally {
  await mongoose.disconnect();
}
