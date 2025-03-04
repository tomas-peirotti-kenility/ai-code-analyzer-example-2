document.addEventListener('DOMContentLoaded', function () {
  // Theme Toggle
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;

  // Check for saved theme preference
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    body.classList.add('dark');
    themeToggle.innerHTML = '<i class="bi bi-sun"></i>';
  } else {
    body.classList.remove('dark'); // Ensure light theme is applied if 'light' is saved
    themeToggle.innerHTML = '<i class="bi bi-moon"></i>';
  }

  // Function to toggle theme
  function toggleTheme() {
    body.classList.toggle('dark');
    const isDarkTheme = body.classList.contains('dark');
    localStorage.setItem('theme', isDarkTheme ? 'dark' : 'light');
    themeToggle.innerHTML = isDarkTheme
      ? '<i class="bi bi-sun"></i>'
      : '<i class="bi bi-moon"></i>';
  }

  // Event Listener for Theme Toggle
  themeToggle.addEventListener('click', toggleTheme);
});
