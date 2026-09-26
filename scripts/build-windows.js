import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'build-windows.ps1');

try {
  console.log('[HuskyNote] Executing Windows build script...');
  execSync(`powershell -ExecutionPolicy Bypass -File "${scriptPath}"`, {
    stdio: 'inherit',
    cwd: path.join(__dirname, '..')
  });
} catch (err) {
  console.error('[HuskyNote] Build failed:', err.message);
  process.exit(1);
}
