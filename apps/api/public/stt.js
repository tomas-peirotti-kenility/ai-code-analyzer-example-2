/**
 * Speech-to-Text Module
 * Handles audio file processing and transcription
 */

// Check authentication
if (!sessionStorage.getItem('accessKey')) {
  window.location.href = 'index.html';
}

// State variables
let startTime = undefined;
let lastChunkTime = undefined;
let currentFile = null;

// DOM Elements
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileInfo = document.getElementById('fileInfo');
const fileName = document.getElementById('fileName');
const clearFileBtn = document.getElementById('clearFile');
const connectionStatus = document.getElementById('connectionStatus');
const transcriptionContent = document.getElementById('transcriptionContent');
const audioPlayer = document.getElementById('audioPlayer');
const transcribeBtn = document.getElementById('transcribeBtn');
const startTimeDisplay = document.getElementById('startTime');

// Form Elements
const provider = document.getElementById('provider');
const model = document.getElementById('model');
const encoding = document.getElementById('encoding');
const sampleRate = document.getElementById('sampleRate');
const language = document.getElementById('language');
const detectLanguage = document.getElementById('detectLanguage');
const cleanNoise = document.getElementById('cleanNoise');

// Initialize toast
const errorToast = new bootstrap.Toast(document.getElementById('errorToast'), {
  autohide: true,
  delay: 5000,
});
const errorToastBody = document.getElementById('errorToastBody');

/**
 * WebSocket Connection
 */
const socket = io(window.APP_CONFIG.WS_URL, {
  withCredentials: true,
  transports: ['websocket'],
  path: '/socket.io',
  auth: {
    token: sessionStorage.getItem('accessKey'),
  },
});

// WebSocket Event Handlers
socket.on('connect', () => {
  connectionStatus.textContent = 'Connected';
  connectionStatus.className = 'badge bg-success';
});

socket.on('disconnect', () => {
  connectionStatus.textContent = 'Disconnected';
  connectionStatus.className = 'badge bg-secondary';
});

socket.on('error', (err) => {
  console.error(err);
  errorToastBody.textContent = err.message || 'An error occurred';
  errorToast.show();
});

socket.on('transcriptionChunk', (chunk) => {
  let now = new Date();
  const diff = now - (lastChunkTime ? lastChunkTime : startTime);
  lastChunkTime = now;
  const timestamp = getTimestamp(now);
  const chunkDiv = document.createElement('div');
  chunkDiv.className = `chunk d-flex justify-content-between align-items-start`;
  chunkDiv.innerHTML = `
        <p class="mb-0">${chunk}</p>
        <span id="timestamp" class="text-muted ms-2" style="font-size: 0.8em;">${timestamp} | +${diff}ms</span>
    `;
  transcriptionContent.appendChild(chunkDiv);
  transcriptionBox.scrollTop = transcriptionBox.scrollHeight;
  enableTranscribeButton();
});

/**
 * Utility Functions
 */
function getTimestamp(date) {
  return `${date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}.${date.getMilliseconds().toString().padStart(4, '0')}`;
}

function enableTranscribeButton() {
  transcribeBtn.disabled = false;
}

function disableTranscribeButton() {
  transcribeBtn.disabled = true;
}

function handleFile(file) {
  if (!file || !file.type.startsWith('audio/')) {
    alert('Please select an audio file');
    return;
  }

  currentFile = file;

  // Show file info
  fileName.textContent = file.name;
  fileInfo.classList.remove('d-none');

  // Update audio player
  audioPlayer.src = URL.createObjectURL(file);

  enableTranscribeButton();
}

function clearFile() {
  currentFile = null;
  fileInput.value = '';
  fileName.textContent = 'None';
  fileInfo.classList.add('d-none');
  transcriptionContent.innerHTML = '';
  audioPlayer.src = '';
  disableTranscribeButton();
  transcribeBtn.innerHTML = 'Transcribe Audio';
  startTimeDisplay.textContent = '';
  startTime = undefined;
  lastChunkTime = undefined;
}

/**
 * Event Listeners
 */
// File Drop Handlers
dropZone.addEventListener('dragover', (e) => {
  try {
    e.preventDefault();
    dropZone.classList.add('dragover');
    console.log('dragover', e);
  } catch (e) {
    console.error('dragover error', e);
  }
});

dropZone.addEventListener('dragleave', () => {
  try {
    dropZone.classList.remove('dragover');
    console.log('dragleave');
  } catch (e) {
    console.error('dragleave', e);
  }
});

dropZone.addEventListener('drop', (e) => {
  try {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFile(e.dataTransfer.files[0]);
    console.log('drop');
  } catch (e) {
    console.error('drop', e);
  }
});

dropZone.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', (e) => {
  handleFile(e.target.files[0]);
});

clearFileBtn.addEventListener('click', () => {
  clearFile();
});

// Transcribe Button Handler
transcribeBtn.addEventListener('click', () => {
  if (!currentFile) return;

  let now = new Date();
  startTime = now;
  lastChunkTime = undefined;
  startTimeDisplay.textContent = 'Start time: ' + getTimestamp(now);

  // Show loading state
  const originalBtnText = transcribeBtn.innerHTML;
  disableTranscribeButton();
  transcribeBtn.innerHTML = `
        <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
        Processing...
    `;

  // Generate query parameters
  let inputs = {
    provider: provider.value,
    model: model.value,
    encoding: encoding.value,
    sampleRate: sampleRate.value,
    language: language.value,
    detectLanguage: detectLanguage.checked,
    cleanNoise: cleanNoise.checked,
    websocketClientId: socket.id,
  };
  const params = new URLSearchParams(inputs);

  console.table(inputs);

  // Clear previous transcription
  transcriptionContent.innerHTML = '';

  // Send file to server
  const formData = new FormData();
  formData.append('audio', currentFile);

  fetch(
    `${window.APP_CONFIG.VOICEBOT_API_URL}/playground/stt?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        API_KEY: sessionStorage.getItem('accessKey'),
      },
      body: formData,
    },
  )
    .then(async (response) => {
      if (!response.ok) {
        let s = await response.json();
        throw new Error(s.message);
      }
    })
    .catch((error) => {
      console.error('Error:', error);
      errorToastBody.textContent = error.message || 'STT Request error';
      errorToast.show();
      enableTranscribeButton();
    })
    .finally(() => {
      transcribeBtn.innerHTML = originalBtnText;
    });
});
