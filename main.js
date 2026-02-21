document.querySelectorAll('[data-scroll-target]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.getAttribute('data-scroll-target');
    const target = document.getElementById(targetId);

    if (!target) {
      return;
    }

    event.preventDefault();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});
