import fs from 'fs';
import path from 'path';

const SOURCE_DATA_DIR = path.resolve(process.cwd(), 'data');

export function isVercelRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION);
}

const RUNTIME_DATA_DIR = isVercelRuntime()
  ? path.join('/tmp', 'mun-computer-data')
  : SOURCE_DATA_DIR;

let _bootstrapped = false;

export function getSourceDataDir(): string {
  return SOURCE_DATA_DIR;
}

export function getDataDir(): string {
  if (!_bootstrapped) {
    _bootstrapped = true;
    try {
      if (!fs.existsSync(RUNTIME_DATA_DIR)) {
        fs.mkdirSync(RUNTIME_DATA_DIR, { recursive: true });
      }
    } catch {
      // ignore if directory already exists or is concurrently created
    }

    if (isVercelRuntime() && RUNTIME_DATA_DIR !== SOURCE_DATA_DIR && fs.existsSync(SOURCE_DATA_DIR)) {
      try {
        const entries = fs.readdirSync(SOURCE_DATA_DIR);
        for (const entry of entries) {
          const src = path.join(SOURCE_DATA_DIR, entry);
          const dest = path.join(RUNTIME_DATA_DIR, entry);
          try {
            const stat = fs.statSync(src);
            if (stat.isFile() && !fs.existsSync(dest)) {
              fs.copyFileSync(src, dest);
            }
          } catch {
            // skip lock/unreadable files
          }
        }
      } catch {
        // non-fatal seed copy error
      }
    }
  }
  return RUNTIME_DATA_DIR;
}
