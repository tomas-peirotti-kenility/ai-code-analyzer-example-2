/**
 * GitHub Code Analyzer Module
 * Handles GitHub repository analysis and visualization with Mermaid diagrams
 */

// Check authentication
if (!sessionStorage.getItem('accessKey')) {
  window.location.href = 'index.html';
}

// State variables
let currentDiagramCode = '';
let currentRepository = null;

// Element references
let analysisType;
let repoSection;
let analysisSection;
let mermaidContainer;
let backToRepoBtn;
let connectGithubBtn;
let analyzeRepoBtn;
let repoSelect;
let errorAlert;
let errorMessage;
let downloadDiagramBtn;
let askAboutCodeSection;

// Question elements
let questionForm;
let codeQuestion;
let answerCard;
let answerContent;
let sendQuestionBtn;

document.addEventListener('DOMContentLoaded', () => {
  initializeElements();
  initializeMermaid();
  initializeHighlightjs();
});

/**
 * Initialize syntax highlighting
 */
function initializeHighlightjs() {
  if (typeof hljs !== 'undefined') {
    console.log('Setting up Highlight.js...');
    hljs.configure({
      languages: [
        'javascript',
        'typescript',
        'python',
        'java',
        'html',
        'css',
        'xml',
        'json',
      ],
      ignoreUnescapedHTML: true,
    });
  }
}

function initializeElements() {
  // Get DOM elements after the page is fully loaded
  analysisType = document.getElementById('analysisType');
  repoSection = document.getElementById('repoSection');
  analysisSection = document.getElementById('analysisSection');
  mermaidContainer = document.getElementById('mermaidContainer');
  backToRepoBtn = document.getElementById('backToRepoBtn');
  connectGithubBtn = document.getElementById('connectGithubBtn');
  loadingIndicator = document.getElementById('loadingIndicator');
  analyzeRepoBtn = document.getElementById('analyzeRepoBtn');
  repoSelect = document.getElementById('repoSelect');
  errorAlert = document.getElementById('errorAlert');
  errorMessage = document.getElementById('errorMessage');
  downloadDiagramBtn = document.getElementById('downloadDiagramBtn');

  // Question elements
  questionForm = document.getElementById('questionForm');
  codeQuestion = document.getElementById('codeQuestion');
  answerCard = document.getElementById('answerCard');
  answerContent = document.getElementById('answerContent');
  sendQuestionBtn = document.getElementById('sendQuestionBtn');
  askAboutCodeSection = document.getElementById('askAboutCodeSection');

  // Set event listeners after elements are found
  if (analyzeRepoBtn) {
    analyzeRepoBtn.addEventListener('click', handleAnalyzeRepo);
  }

  if (backToRepoBtn) {
    backToRepoBtn.addEventListener('click', showRepoSection);
  }

  if (connectGithubBtn) {
    connectGithubBtn.addEventListener('click', connectGithub);
  }

  if (downloadDiagramBtn) {
    downloadDiagramBtn.addEventListener('click', downloadDiagram);
  }

  if (questionForm) {
    questionForm.addEventListener('submit', handleQuestionSubmit);
  }

  if (codeQuestion) {
    codeQuestion.addEventListener('input', validateQuestionForm);
  }

  if (repoSelect) {
    repoSelect.addEventListener('change', () => {
      analyzeRepoBtn.disabled = !repoSelect.value;

      const repoUrl = repoSelect.value;
      const codePath = document.getElementById('codePath').value;

      if (repoUrl) {
        currentRepository = {
          url: repoUrl,
          codePath: codePath,
        };
      }

      validateQuestionForm();
    });
  }

  validateQuestionForm();
}

function initializeMermaid() {
  // Check if mermaid is already initialized
  if (typeof mermaid !== 'undefined') {
    setupMermaid();
  } else {
    // Load mermaid script dynamically
    const mermaidScript = document.createElement('script');
    mermaidScript.src =
      'https://cdnjs.cloudflare.com/ajax/libs/mermaid/10.2.3/mermaid.min.js';
    mermaidScript.onload = setupMermaid;
    document.body.appendChild(mermaidScript);
  }
}

/**
 * Shows an error message
 */
function showError(message, title = 'Error') {
  console.error(`Error: ${message}`);
  if (errorMessage) {
    // Format message for HTML display
    if (typeof message === 'object') {
      if (message.error && message.message) {
        errorMessage.innerHTML = `<strong>${message.error}</strong>: ${message.message}`;
      } else {
        errorMessage.innerHTML = JSON.stringify(message, null, 2);
      }
    } else {
      errorMessage.innerHTML = message;
    }
  }
  if (errorAlert) {
    errorAlert.querySelector('h5').textContent = title;
    errorAlert.classList.remove('d-none');
  }
}

/**
 * Hides the error message
 */
function hideError() {
  if (errorMessage) errorMessage.textContent = '';
  if (errorAlert) errorAlert.classList.add('d-none');
}

function setupMermaid() {
  console.log('Setting up Mermaid...');
  mermaid.initialize({
    startOnLoad: true,
    theme: document.body.classList.contains('dark-theme') ? 'dark' : 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'cardinal',
    },
  });
}

// Theme change handling
window.addEventListener('themeChanged', function () {
  if (typeof mermaid !== 'undefined') {
    // Update mermaid theme when page theme changes
    mermaid.initialize({
      theme: document.body.classList.contains('dark-theme')
        ? 'dark'
        : 'default',
    });

    // Re-render diagram if one exists
    if (currentDiagramCode) {
      renderMermaidDiagram(currentDiagramCode);
    }
  }
});

/**
 * Handles analyze repo button click
 */
async function handleAnalyzeRepo() {
  const repoUrl = repoSelect.value;
  const githubToken = sessionStorage.getItem('githubToken');
  const analysisTypeValue = analysisType.value;
  const codePath = document.getElementById('codePath').value;

  if (!repoUrl) {
    showError('Please select a repository to analyze.');
    return;
  }

  if (!githubToken) {
    showError('Please connect to GitHub to analyze the repository.');
    return;
  }

  try {
    // Show loading indicator
    showLoading();

    const queryParams = new URLSearchParams({
      analysisType: analysisTypeValue,
      repoUrl,
      githubToken,
      codePath,
    });

    // Send request to backend
    sendAnalysisRequest(queryParams);
  } catch (error) {
    console.error('Error during analysis:', error);
    showError(error.message);
  }
}

/**
 * Shows the analysis section and hides the repository section
 */
function showAnalysisSection() {
  console.log('Showing analysis section');
  repoSection.classList.add('hidden');
  analysisSection.classList.remove('hidden');
  backToRepoBtn.classList.remove('hidden');
  validateQuestionForm();
}

/**
 * Shows the repository section and hides the analysis section
 */
function showRepoSection() {
  console.log('Showing repository section');
  repoSection.classList.remove('hidden');
  analysisSection.classList.add('hidden');
  backToRepoBtn.classList.add('hidden');
  validateQuestionForm();
}

/**
 * Downloads the diagram as SVG
 */
function downloadDiagram() {
  console.log('Download diagram requested');
  if (!mermaidContainer || !mermaidContainer.querySelector('svg')) {
    showError('No diagram to download');
    return;
  }

  const svgData = mermaidContainer.querySelector('svg').outerHTML;
  const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
  const svgUrl = URL.createObjectURL(svgBlob);

  const timestamp = new Date()
    .toISOString()
    .replace(/:/g, '-')
    .replace(/\..+/, '');
  const downloadLink = document.createElement('a');
  downloadLink.href = svgUrl;
  downloadLink.download = `code_analysis_${timestamp}.svg`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
  console.log('Diagram download initiated');
}

/**
 * Handles question submission
 */
function handleQuestionSubmit(event) {
  event.preventDefault();

  if (!validateQuestionForm()) {
    return;
  }

  if (!codeQuestion || !codeQuestion.value.trim()) {
    showError('Please enter a question about your code.');
    return;
  }

  // Show loading indicator
  showLoading();

  // Hide previous results
  hideResults();

  // Get repository information
  const repoUrl = currentRepository.url;
  const githubToken = sessionStorage.getItem('githubToken');
  const codePath = currentRepository.codePath;

  const params = new URLSearchParams({
    repoUrl,
    githubToken,
    codePath,
    question: codeQuestion.value.trim(),
  });

  fetch(
    `${window.APP_CONFIG.API_URL}/ai-code-analyzer/questions?${params.toString()}`,
    {
      method: 'POST',
      headers: {
        API_KEY: sessionStorage.getItem('accessKey'),
      },
    },
  )
    .then(handleApiResponse)
    .then((data) => {
      // Display the answer
      displayAnswer(data.answer);
    })
    .catch((error) => {
      console.error('Error:', error);
      showError(
        error.message || 'An error occurred while processing your question.',
      );
    })
    .finally(() => {
      hideLoading();
    });
}

/**
 * Displays the answer to a code question
 */
/**
 * Displays the answer to a code question with Markdown formatting
 */
function displayAnswer(answer) {
  if (!answerCard || !answerContent) return;

  // Configure marked options
  marked.setOptions({
    highlight: function (code, lang) {
      // Use highlight.js for syntax highlighting if available
      if (typeof hljs !== 'undefined' && lang && hljs.getLanguage(lang)) {
        try {
          return hljs.highlight(code, { language: lang }).value;
        } catch (e) {
          console.error('Highlight.js error:', e);
        }
      }
      return code; // Default to regular code without highlighting
    },
    breaks: true, // Add line breaks on single line breaks
    gfm: true, // Enable GitHub Flavored Markdown
    headerIds: true, // Enable header IDs for linking
    mangle: false, // Disable mangling of header IDs
    sanitize: false, // Don't sanitize output (we trust our input)
    smartLists: true, // Use smarter list behavior
    smartypants: true, // Use smart punctuation
  });

  try {
    // Convert markdown to HTML
    const htmlContent = marked.parse(answer);

    // Set the HTML content
    answerContent.innerHTML = htmlContent;

    // Initialize syntax highlighting on all code blocks
    if (typeof hljs !== 'undefined') {
      document.querySelectorAll('#answerContent pre code').forEach((block) => {
        hljs.highlightElement(block);
      });
    }

    // Show the answer card
    answerCard.classList.remove('d-none');
  } catch (error) {
    console.error('Error rendering markdown:', error);
    // Fallback to basic formatting if markdown parsing fails
    answerContent.innerHTML = `<p>${answer.replace(/\n/g, '<br>')}</p>`;
    answerCard.classList.remove('d-none');
  }
}

/**
 * Renders the Mermaid diagram
 */
function renderMermaidDiagram(mermaidCode) {
  // Show analysis section and hide repo section
  showAnalysisSection();
  console.log('Rendering Mermaid diagram');
  currentDiagramCode = mermaidCode;

  // Display the diagram code
  const diagramCode = document.getElementById('diagramCode');
  if (diagramCode) diagramCode.textContent = mermaidCode;

  // Clear previous diagram
  if (mermaidContainer) mermaidContainer.innerHTML = '';

  // Render the diagram
  if (typeof mermaid !== 'undefined') {
    console.log('Calling mermaid render');

    try {
      mermaid
        .render('mermaid-diagram-svg', mermaidCode)
        .then(({ svg }) => {
          console.log('Mermaid rendering successful');
          if (mermaidContainer) {
            mermaidContainer.innerHTML = svg;
          }

          const resultsCard = document.getElementById('resultsCard');
          if (resultsCard) resultsCard.classList.remove('d-none');
        })
        .catch((error) => {
          console.error('Mermaid rendering error:', error);
          showError(
            'Failed to render diagram: ' + error.message ||
              'Mermaid syntax error',
          );
        });
    } catch (error) {
      console.error('Mermaid rendering error:', error);
      showError(
        'Failed to render diagram: ' + error.message ||
          'Mermaid rendering error',
      );
    }
  } else {
    console.error('Mermaid library not available');
    showError('Mermaid library not loaded. Cannot render diagram.');
  }
}

/**
 * Connect to Github
 */
function connectGithub() {
  console.log('Initiating GitHub OAuth flow...');
  const clientId = window.APP_CONFIG.GITHUB_CLIENT_ID;
  const redirectUri = window.location.origin + window.location.pathname;
  const githubAuthUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=repo&org_select=true`;
  window.location.href = githubAuthUrl;
}

// Function to extract the code from the URL
function getCodeFromURL() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('code');
}

// Check if the URL contains a code (GitHub OAuth redirect)
const code = getCodeFromURL();
const githubToken = sessionStorage.getItem('githubToken');
if (code && !githubToken) {
  // If code exists and no token in sessionStorage, send it to the backend
  sendCodeToBackend(code);
}

// Function to send the code to the backend
async function sendCodeToBackend(code) {
  try {
    showLoading();
    const response = await fetch(
      `${window.APP_CONFIG.API_URL}/github/connect`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      },
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('Authentication successful:', data);
    // Store the token in sessionStorage
    sessionStorage.setItem('githubToken', data.user.token);
    updateUI();
  } catch (error) {
    console.error('Authentication failed:', error);
    showError('GitHub authentication failed: ' + error.message);
  } finally {
    hideLoading();
  }
}

/**
 * Process API response and handle errors
 */
async function handleApiResponse(response) {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (e) {
      // If not JSON, get text
      const text = await response.text();
      throw new Error(text || `Server returned ${response.status}`);
    }

    // If we have structured error data
    if (errorData.error && errorData.message) {
      throw {
        status: response.status,
        error: errorData.error,
        message: errorData.message,
      };
    }

    // Default error
    throw new Error(
      errorData.error ||
        errorData.message ||
        `Server returned ${response.status}`,
    );
  }

  try {
    return await response.json();
  } catch (e) {
    // Some endpoints return just text
    const text = await response.text();
    return { answer: text }; // Wrap in object for consistency
  }
}

async function loadRepositories() {
  const token = sessionStorage.getItem('githubToken');
  let url = `${window.APP_CONFIG.API_URL}/github/repos`;

  try {
    showLoading();
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    repoSelect.innerHTML = '<option value="">Select a repository</option>'; // Clear existing options

    data.forEach((repo) => {
      const option = document.createElement('option');
      option.value = repo.clone_url; // Use clone_url as the value
      option.textContent = repo.name;
      repoSelect.appendChild(option);
    });
  } catch (error) {
    showError('Failed to load repositories: ' + error.message);
  } finally {
    hideLoading();
  }
}

function updateUI() {
  const githubToken = sessionStorage.getItem('githubToken');
  const githubConnectSection = document.getElementById('githubConnectSection');
  const githubRepoSection = document.getElementById('githubRepoSection');

  if (githubToken) {
    // User is connected to GitHub
    githubConnectSection.classList.add('d-none');
    githubRepoSection.classList.remove('d-none');
    askAboutCodeSection.classList.remove('d-none');
    loadRepositories();
  } else {
    // User is not connected to GitHub
    githubConnectSection.classList.remove('d-none');
    githubRepoSection.classList.add('d-none');
    askAboutCodeSection.classList.add('d-none');
  }

  analyzeRepoBtn.disabled = !repoSelect.value;

  validateQuestionForm();
}

// Call updateUI on page load
document.addEventListener('DOMContentLoaded', updateUI);

document.getElementById('logout-btn').addEventListener('click', function () {
  console.log('Logging out...');
  sessionStorage.removeItem('githubToken');
  updateUI();
});

/**
 * Shows the loading indicator
 */
function showLoading() {
  if (loadingIndicator) loadingIndicator.classList.remove('d-none');
  if (analyzeRepoBtn) analyzeRepoBtn.disabled = true;
  if (sendQuestionBtn) sendQuestionBtn.disabled = true;

  hideResults();
}

/**
 * Hides result sections
 */
function hideResults() {
  if (answerCard) answerCard.classList.add('d-none');
  if (errorAlert) errorAlert.classList.add('d-none');
}

/**
 * Hides the loading indicator
 */
function hideLoading() {
  if (loadingIndicator) loadingIndicator.classList.add('d-none');
  if (analyzeRepoBtn) analyzeRepoBtn.disabled = !repoSelect.value;

  validateQuestionForm();
}

/**
 * Sends analysis request to the backend
 */
function sendAnalysisRequest(queryParams) {
  hideError();

  fetch(
    `${window.APP_CONFIG.API_URL}/ai-code-analyzer/diagrams?${queryParams.toString()}`,
    {
      method: 'POST',
      headers: {
        API_KEY: sessionStorage.getItem('accessKey'),
      },
    },
  )
    .then(handleApiResponse)
    .then((data) => {
      // Display the diagrams
      renderMermaidDiagram(data.mermaidCode);
    })
    .catch((error) => {
      console.error('Error:', error);

      // Handle structured error
      if (error.error && error.message) {
        showError({
          error: error.error,
          message: error.message,
        });
      } else {
        showError(
          error.message || 'An error occurred while analyzing the code.',
        );
      }
    })
    .finally(() => {
      hideLoading();
    });
}

/**
 * Validates the question form
 */
function validateQuestionForm() {
  const isValid =
    codeQuestion &&
    codeQuestion.value.trim() !== '' &&
    repoSelect &&
    repoSelect.value !== '';
  sendQuestionBtn.disabled = !isValid;
  return isValid;
}
