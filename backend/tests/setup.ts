import 'dotenv/config';
import os from 'os';
import path from 'path';

// Tests must never touch dev data: prefer TEST_DATABASE_URL.
if (process.env.TEST_DATABASE_URL) process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.UPLOAD_DIR = path.join(os.tmpdir(), 'miniledger-test-uploads');
process.env.JWT_SECRET = 'test-secret';
