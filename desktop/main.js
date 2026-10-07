const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');

const API_PORT = process.env.F1_API_PORT || '3001';
const UI_PORT = process.env.F1_UI_PORT || '3000';

let mainWindow = null;
let backendProc = null;
let frontendProc = null;
let shuttingDown = false;

function resourcesRoot() {
  if (app.isPackaged) return process.resourcesPath;
  return path.join(__dirname, '..');
}

function backendDir() {
  return path.join(resourcesRoot(), 'backend');
}

function frontendDir() {
  if (app.isPackaged) return path.join(resourcesRoot(), 'frontend');
  return path.join(resourcesRoot(), 'frontend', '.next', 'standalone');
}

function userDataPaths() {
  const base = app.getPath('userData');
  const dbPath = path.join(base, 'f1timing.db');
  const uploadsDir = path.join(base, 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  return { dbPath, uploadsDir };
}

function spawnNodeScript(scriptPath, cwd, env) {
  const childEnv = {
    ...process.env,
    ...env,
    ELECTRON_RUN_AS_NODE: '1',
  };
  const child = spawn(process.execPath, [scriptPath], {
    cwd,
    env: childEnv,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const label = path.basename(cwd);
  child.stdout.on('data', (buf) => {
    console.log(`[${label}] ${buf.toString().trimEnd()}`);
  });
  child.stderr.on('data', (buf) => {
    console.error(`[${label}] ${buf.toString().trimEnd()}`);
  });
  child.on('exit', (code, signal) => {
    if (!shuttingDown) {
      console.error(`[${label}] exited code=${code} signal=${signal}`);
    }
  });
  return child;
}

function waitForHealth(url, timeoutMs = 45000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
        } else {
          setTimeout(attempt, 250);
        }
      });
      req.on('error', () => setTimeout(attempt, 250));
      req.setTimeout(2000, () => {
        req.destroy();
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function stopChild(child) {
  if (!child || child.killed) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/f', '/t'], {
        windowsHide: true,
        stdio: 'ignore',
      });
    } else {
      child.kill('SIGTERM');
    }
  } catch (err) {
    console.error('Failed to stop child:', err);
  }
}

function stopServers() {
  shuttingDown = true;
  stopChild(frontendProc);
  stopChild(backendProc);
  frontendProc = null;
  backendProc = null;
}

async function startServers() {
  const { dbPath, uploadsDir } = userDataPaths();
  const beDir = backendDir();
  const feDir = frontendDir();
  const backendEntry = path.join(beDir, 'server.js');
  const frontendEntry = path.join(feDir, 'server.js');

  if (!fs.existsSync(backendEntry)) {
    throw new Error(`Backend not found at ${backendEntry}`);
  }
  if (!fs.existsSync(frontendEntry)) {
    throw new Error(
      `Frontend standalone server not found at ${frontendEntry}. Run "npm run desktop:prepare" first.`
    );
  }

  backendProc = spawnNodeScript(backendEntry, beDir, {
    PORT: API_PORT,
    DB_PATH: dbPath,
    UPLOADS_DIR: uploadsDir,
  });

  await waitForHealth(`http://127.0.0.1:${API_PORT}/api/health`);

  frontendProc = spawnNodeScript(frontendEntry, feDir, {
    PORT: UI_PORT,
    HOSTNAME: '0.0.0.0',
    NEXT_TELEMETRY_DISABLED: '1',
  });

  await waitForHealth(`http://127.0.0.1:${UI_PORT}`);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Formel1Dash',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadURL(`http://127.0.0.1:${UI_PORT}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function boot() {
  try {
    await startServers();
    createWindow();
  } catch (err) {
    console.error(err);
    dialog.showErrorBox(
      'Formel1Dash failed to start',
      `${err.message}\n\nMake sure ports ${UI_PORT} and ${API_PORT} are free, then try again.`
    );
    stopServers();
    app.quit();
  }
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(boot);

  app.on('before-quit', () => {
    stopServers();
  });

  app.on('window-all-closed', () => {
    stopServers();
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && !shuttingDown) {
      boot();
    }
  });
}
