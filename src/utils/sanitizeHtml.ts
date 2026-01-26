/**
 * Basic HTML sanitization for rich text editor content
 * Removes potentially dangerous tags and attributes while preserving formatting
 */

export function sanitizeHtml(html: string): string {
  // Create a temporary div to parse and clean the HTML
  const temp = document.createElement('div');
  temp.innerHTML = html;

  // List of allowed tags
  const allowedTags = [
    'p',
    'br',
    'strong',
    'b',
    'em',
    'i',
    'u',
    'ul',
    'ol',
    'li',
    'h1',
    'h2',
    'h3',
    'a',
    'code',
    'pre',
  ];

  // List of allowed attributes
  const allowedAttributes = ['href', 'target', 'rel'];

  // Recursively clean the DOM
  function cleanNode(node: Node): void {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      const tagName = element.tagName.toLowerCase();

      // Remove disallowed tags
      if (!allowedTags.includes(tagName)) {
        // Replace with its children
        while (element.firstChild) {
          element.parentNode?.insertBefore(element.firstChild, element);
        }
        element.parentNode?.removeChild(element);
        return;
      }

      // Remove disallowed attributes
      Array.from(element.attributes).forEach((attr) => {
        if (!allowedAttributes.includes(attr.name)) {
          element.removeAttribute(attr.name);
        }
      });

      // Ensure links have safe attributes
      if (tagName === 'a') {
        const href = element.getAttribute('href');
        if (
          href &&
          !href.startsWith('http://') &&
          !href.startsWith('https://')
        ) {
          element.removeAttribute('href');
        } else {
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }

      // Recursively clean children
      Array.from(element.childNodes).forEach(cleanNode);
    }
  }

  // Clean all nodes
  Array.from(temp.childNodes).forEach(cleanNode);

  return temp.innerHTML;
}
