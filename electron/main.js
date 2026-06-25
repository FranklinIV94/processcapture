const { app, BrowserWindow, ipcMain, desktopCapturer, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

let mainWindow;
let recordingProcess = null;

const RECORDINGS_DIR = path.join(require('os').homedir(), '.processcapture', 'recordings');

function ensureRecordingsDir() {
  if (!fs.existsSync(RECORDINGS_DIR)) {
    fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hidden-inset',
    backgroundColor: '#0a0a0a',
  });

  // In dev, load Vite dev server. In production, load built files.
  const isDev = !app.isPackaged;
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// IPC: Get available screens/windows for capture
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 180 },
  });
  return sources.map(s => ({
    id: s.id,
    name: s.name,
    thumbnail: s.thumbnail.toDataURL(),
  }));
});

// IPC: Start recording
ipcMain.handle('recording:start', async (event, { sourceId, projectName, checklist }) => {
  ensureRecordingsDir();
  const projectDir = path.join(RECORDINGS_DIR, projectName.replace(/[^a-zA-Z0-9_-]/g, '_'));
  if (!fs.existsSync(projectDir)) {
    fs.mkdirSync(projectDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const videoPath = path.join(projectDir, `recording_${timestamp}.mp4`);
  const audioPath = path.join(projectDir, `recording_${timestamp}.wav`);
  const metadataPath = path.join(projectDir, `recording_${timestamp}.json`);

  // Save metadata
  const metadata = {
    project: projectName,
    timestamp: new Date().toISOString(),
    checklist: checklist || [],
    videoFile: `recording_${timestamp}.mp4`,
    audioFile: `recording_${timestamp}.wav`,
    status: 'recording',
  };
  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  // Start ffmpeg recording
  // Note: In production, ffmpeg path would be bundled. For dev, use system ffmpeg.
  const ffmpegPath = 'ffmpeg'; // TODO: bundle with electron-builder

  recordingProcess = spawn(ffmpegPath, [
    '-y',
    '-f', 'x11grab', // Linux. TODO: platform detection for darwin/win
    '-framerate', '30',
    '-video_size', '1920x1080',
    '-i', process.env.DISPLAY || ':0',
    '-f', 'pulse',
    '-i', 'default',
    '-c:v', 'libx264',
    '-preset', 'fast',
    '-crf', '23',
    '-c:a', 'pcm_s16le',
    '-movflags', '+faststart',
    videoPath,
  ]);

  recordingProcess.stderr.on('data', (data) => {
    // Log ffmpeg output for debugging
    console.log(`ffmpeg: ${data}`);
  });

  recordingProcess.on('close', (code) => {
    console.log(`ffmpeg exited with code ${code}`);
    // Update metadata
    metadata.status = 'completed';
    metadata.duration = Date.now() - new Date(metadata.timestamp).getTime();
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
  });

  return { success: true, videoPath, metadataPath, projectDir };
});

// IPC: Stop recording
ipcMain.handle('recording:stop', async () => {
  if (recordingProcess) {
    // Send 'q' to ffmpeg for clean shutdown
    recordingProcess.stdin.write('q');
    recordingProcess = null;
    return { success: true };
  }
  return { success: false, error: 'No active recording' };
});

// IPC: Process recording (run extraction pipeline)
ipcMain.handle('recording:process', async (event, { videoPath, projectDir }) => {
  const pythonScript = path.join(__dirname, '..', 'pipeline', 'extract.py');
  const processPy = spawn('python3', [pythonScript, videoPath, projectDir]);

  return new Promise((resolve, reject) => {
    let output = '';
    processPy.stdout.on('data', (data) => {
      output += data.toString();
      // Forward progress to UI
      mainWindow.webContents.send('processing:progress', data.toString());
    });
    processPy.stderr.on('data', (data) => {
      console.error(`Pipeline error: ${data}`);
    });
    processPy.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        reject(new Error(`Pipeline exited with code ${code}`));
      }
    });
  });
});

// IPC: List recordings
ipcMain.handle('recordings:list', async () => {
  ensureRecordingsDir();
  const projects = [];
  const projectDirs = fs.readdirSync(RECORDINGS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  for (const projDir of projectDirs) {
    const fullPath = path.join(RECORDINGS_DIR, projDir);
    const recordings = fs.readdirSync(fullPath)
      .filter(f => f.endsWith('.json'))
      .map(f => {
        const metadata = JSON.parse(fs.readFileSync(path.join(fullPath, f), 'utf8'));
        return metadata;
      });
    projects.push({ name: projDir, recordings });
  }
  return projects;
});

// IPC: Get recording report
ipcMain.handle('recordings:get-report', async (event, { projectDir, recordingName }) => {
  const reportPath = path.join(projectDir, 'report.md');
  if (fs.existsSync(reportPath)) {
    return fs.readFileSync(reportPath, 'utf8');
  }
  return null;
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (recordingProcess) {
    recordingProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});