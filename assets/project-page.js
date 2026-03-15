document.addEventListener('DOMContentLoaded', () => {
    const yearNode = document.getElementById('year');
    if (yearNode) {
        yearNode.textContent = String(new Date().getFullYear());
    }

    const links = document.querySelectorAll('a[target="_blank"]');
    links.forEach((link) => {
        if (!link.rel.includes('noopener')) {
            link.rel = `${link.rel} noopener noreferrer`.trim();
        }
    });
});
