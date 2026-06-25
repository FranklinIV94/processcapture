import React, { useState, useEffect } from 'react';

interface Source {
  id: string;
  name: string;
  thumbnail: string;
}

interface ChecklistItem {
  label: string;
  checked: boolean;
}

type AppState = 'idle' | 'selecting' | 'ready' | 'recording' | 'processing' | 'report';

export default function App() {
  const [state, setState] = useState<AppState>('idle');
  const [sources, setSources] = useState<Source[]>([]);
  const [selectedSource, setSelectedSource] = useState<Source | null>(null);
  const [projectName, setProjectName] = useState('');
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [checklistInput, setChecklistInput] = useState('');
  const [recordingInfo, setRecordingInfo] = useState<any>(null);
  const [progress, setProgress] = useState('');
  const [report, setReport] = useState<string | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);

  // Load available screen sources
  async function loadSources() {
    const srcs = await window.processcapture.getSources();
    setSources(srcs);
    setState('selecting');
  }

  // Start recording
  async function startRecording() {
    if (!selectedSource || !projectName) return;
    const result = await window.processcapture.startRecording({
      sourceId: selectedSource.id,
      projectName,
      checklist: checklist.filter(c => c.checked).map(c => c.label),
    });
    setRecordingInfo(result);
    setState('recording');
    setRecordingTime(0);
  }

  // Stop recording
  async function stopRecording() {
    await window.processcapture.stopRecording();
    setState('processing');
    setProgress('Extracting frames and transcribing audio...');

    // Run the extraction pipeline
    try {
      await window.processcapture.processRecording({
        videoPath: recordingInfo.videoPath,
        projectDir: recordingInfo.projectDir,
      });
      setProgress('Generating workflow report...');

      // Get the report
      const reportContent = await window.processcapture.getReport({
        projectDir: recordingInfo.projectDir,
        recordingName: projectName,
      });
      setReport(reportContent);
      setState('report');
    } catch (err) {
      setProgress(`Error: ${err.message}`);
      setState('idle');
    }
  }

  // Add checklist item
  function addChecklistItem() {
    if (checklistInput.trim()) {
      setChecklist([...checklist, { label: checklistInput.trim(), checked: true }]);
      setChecklistInput('');
    }
  }

  // Toggle checklist item
  function toggleChecklist(idx: number) {
    setChecklist(checklist.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c));
  }

  // Recording timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (state === 'recording') {
      interval = setInterval(() => setRecordingTime(t => t + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [state]);

  // Progress listener
  useEffect(() => {
    window.processcapture.onProgress((data: string) => {
      setProgress(data);
    });
  }, []);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 p-6">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-white">
          ProcessCapture
        </h1>
        <p className="text-neutral-400 text-sm mt-1">
          Record your work. AI documents your processes.
        </p>
      </header>

      {/* IDLE STATE — Project setup */}
      {state === 'idle' && (
        <div className="max-w-md space-y-6">
          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              What workflow are you recording?
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="e.g. Processing a client invoice"
              className="w-full px-4 py-3 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-neutral-300 mb-2">
              Goals for this recording (what should you accomplish?)
            </label>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={checklistInput}
                onChange={(e) => setChecklistInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addChecklistItem()}
                placeholder="Add a goal..."
                className="flex-1 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-lg text-white placeholder-neutral-600 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={addChecklistItem}
                className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded-lg text-sm font-medium transition-colors"
              >
                Add
              </button>
            </div>
            {checklist.length > 0 && (
              <ul className="space-y-2">
                {checklist.map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={() => toggleChecklist(idx)}
                      className="w-4 h-4 accent-blue-500"
                    />
                    <span className="text-sm text-neutral-300">{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <button
            onClick={loadSources}
            disabled={!projectName.trim()}
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-600 rounded-lg font-medium transition-colors"
          >
            Select Screen Source →
          </button>
        </div>
      )}

      {/* SELECTING — Choose screen/window */}
      {state === 'selecting' && (
        <div>
          <h2 className="text-lg font-semibold mb-4">Select what to capture</h2>
          <div className="grid grid-cols-2 gap-4 max-w-2xl">
            {sources.map((source) => (
              <button
                key={source.id}
                onClick={() => {
                  setSelectedSource(source);
                  setState('ready');
                }}
                className="border border-neutral-800 hover:border-blue-500 rounded-lg p-3 transition-colors text-left"
              >
                <img src={source.thumbnail} alt={source.name} className="w-full rounded mb-2" />
                <span className="text-sm text-neutral-300">{source.name}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setState('idle')}
            className="mt-6 text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← Back
          </button>
        </div>
      )}

      {/* READY — Pre-recording review */}
      {state === 'ready' && selectedSource && (
        <div className="max-w-md space-y-4">
          <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
            <p className="text-sm text-neutral-400 mb-1">Capturing</p>
            <p className="font-medium">{selectedSource.name}</p>
          </div>
          <div className="bg-neutral-900 rounded-lg p-4 border border-neutral-800">
            <p className="text-sm text-neutral-400 mb-1">Workflow</p>
            <p className="font-medium">{projectName}</p>
            {checklist.filter(c => c.checked).length > 0 && (
              <ul className="mt-2 text-sm text-neutral-400">
                {checklist.filter(c => c.checked).map((c, i) => (
                  <li key={i}>✓ {c.label}</li>
                ))}
              </ul>
            )}
          </div>
          <button
            onClick={startRecording}
            className="w-full px-6 py-3 bg-red-600 hover:bg-red-500 rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
          >
            <span className="w-3 h-3 bg-white rounded-full" />
            Start Recording
          </button>
          <button
            onClick={() => setState('selecting')}
            className="w-full text-sm text-neutral-500 hover:text-neutral-300"
          >
            ← Change source
          </button>
        </div>
      )}

      {/* RECORDING — Live recording state */}
      {state === 'recording' && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-6">
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
            <span className="text-lg font-mono">{formatTime(recordingTime)}</span>
          </div>
          <p className="text-neutral-400">Recording: {projectName}</p>
          <button
            onClick={stopRecording}
            className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 rounded-lg font-medium transition-colors"
          >
            ■ Stop & Analyze
          </button>
        </div>
      )}

      {/* PROCESSING — Extraction + AI analysis */}
      {state === 'processing' && (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
          <div className="w-12 h-12 border-4 border-neutral-800 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-neutral-300">{progress}</p>
        </div>
      )}

      {/* REPORT — Show the AI-generated workflow report */}
      {state === 'report' && report && (
        <div className="max-w-3xl">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold">Workflow Report</h2>
            <button
              onClick={() => setState('idle')}
              className="text-sm text-neutral-400 hover:text-neutral-200"
            >
              New Recording →
            </button>
          </div>
          <div className="bg-neutral-900 rounded-lg p-6 border border-neutral-800 prose prose-invert max-w-none">
            <pre className="whitespace-pre-wrap text-sm text-neutral-200">{report}</pre>
          </div>
        </div>
      )}
    </div>
  );
}