document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem('ak_theme') || 'dark';
  if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      themeToggle.textContent = '🌙';
  }

  themeToggle.addEventListener('click', () => {
      document.body.classList.toggle('light-mode');
      const isLight = document.body.classList.contains('light-mode');
      
      themeToggle.textContent = isLight ? '🌙' : '☀️';
      localStorage.setItem('ak_theme', isLight ? 'light' : 'dark');
  });
});