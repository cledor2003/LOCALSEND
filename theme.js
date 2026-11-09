document.addEventListener('DOMContentLoaded', () => {
  // Crée ou récupère le bouton de bascule s'il n'est pas déjà présent dans l'en-tête admin
  let themeToggle = document.getElementById('themeToggle');
  
  const savedTheme = localStorage.getItem('ak_theme') || 'dark';
  if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      if (themeToggle) themeToggle.textContent = '🌙';
  } else {
      if (themeToggle) themeToggle.textContent = '☀️';
  }

  if (themeToggle) {
      themeToggle.addEventListener('click', () => {
          document.body.classList.toggle('light-mode');
          const isLight = document.body.classList.contains('light-mode');
          
          themeToggle.textContent = isLight ? '🌙' : '☀️';
          localStorage.setItem('ak_theme', isLight ? 'light' : 'dark');
      });
  }
});document.addEventListener('DOMContentLoaded', () => {
  // Crée ou récupère le bouton de bascule s'il n'est pas déjà présent dans l'en-tête admin
  let themeToggle = document.getElementById('themeToggle');
  
  const savedTheme = localStorage.getItem('ak_theme') || 'dark';
  if (savedTheme === 'light') {
      document.body.classList.add('light-mode');
      if (themeToggle) themeToggle.textContent = '🌙';
  } else {
      if (themeToggle) themeToggle.textContent = '☀️';
  }

  if (themeToggle) {
      themeToggle.addEventListener('click', () => {
          document.body.classList.toggle('light-mode');
          const isLight = document.body.classList.contains('light-mode');
          
          themeToggle.textContent = isLight ? '🌙' : '☀️';
          localStorage.setItem('ak_theme', isLight ? 'light' : 'dark');
      });
  }
});