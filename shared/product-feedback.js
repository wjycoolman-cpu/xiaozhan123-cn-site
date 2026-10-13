(function () {
  'use strict';
  const product = document.currentScript?.dataset.product;
  const selectors = {
    'mianji': '[data-act="feedback"]',
    'qingci': '[data-action="feedback"]',
    'question-bank': '[data-action="feedback"]',
    'resume-studio': '[data-action="feedback"]',
    'yuji': '#feedback',
    'subtitle-studio': '#feedbackBtn'
  };
  const selector = selectors[product];
  if (!selector) return;
  const target = '/feedback/?product=' + encodeURIComponent(product) + '&source=product';
  function isFeedbackEntry(event) { return event.target instanceof Element ? event.target.closest(selector) : null; }
  document.addEventListener('click', event => {
    if (!isFeedbackEntry(event)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    // Open separately so local project state, typed drafts, and media stay in the product page.
    window.open(target, '_blank', 'noopener,noreferrer');
  }, true);
  document.addEventListener('keydown', event => {
    const entry = isFeedbackEntry(event);
    if (!entry || entry.tagName === 'BUTTON' || entry.tagName === 'A' || !['Enter', ' '].includes(event.key)) return;
    event.preventDefault(); event.stopImmediatePropagation(); window.open(target, '_blank', 'noopener,noreferrer');
  }, true);
})();
