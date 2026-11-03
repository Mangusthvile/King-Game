// Turns a part of the screen (a panel, a Task Card, the whole screen) into a
// canvas, with no extra library: the element is copied with every style
// written onto the copy, wrapped in an SVG <foreignObject>, and the SVG is
// drawn onto a canvas. Works in Chrome and Edge (the browsers the app
// targets). Canvases (the map) are copied as images.
//
// Not copied: ::before / ::after content, and images from other websites.

// The copy is drawn at the element's full size, scrolled-away parts included.
export async function captureElement(el) {
  const width = Math.ceil(el.getBoundingClientRect().width);
  const height = Math.ceil(Math.max(el.scrollHeight, el.getBoundingClientRect().height));
  const copy = await copyWithStyles(el);
  // The root shows everything: no scrolling, no fixed height.
  Object.assign(copy.style, { margin: '0', height: `${height}px`, maxHeight: 'none', overflow: 'visible', position: 'static', transform: 'none', left: '0', top: '0' });

  const xhtml = new XMLSerializer().serializeToString(copy);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`;
  const image = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = getComputedStyle(document.body).backgroundColor || '#121212';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(image, 0, 0);
  return canvas;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('The browser could not draw this part of the screen.'));
    img.src = src;
  });
}

// A deep copy of el where every element carries its computed style inline,
// form fields show their current values, and canvases and images become
// data-URL images (an SVG image can't load anything from outside).
async function copyWithStyles(el) {
  const copy = el.cloneNode(true);
  const originals = [el, ...el.querySelectorAll('*')];
  const copies = [copy, ...copy.querySelectorAll('*')];
  for (let i = 0; i < originals.length; i++) {
    const from = originals[i];
    let to = copies[i];
    if (from instanceof HTMLCanvasElement) {
      const img = document.createElement('img');
      img.src = safeDataUrl(from);
      to.replaceWith(img);
      to = img;
    } else if (from instanceof HTMLImageElement) {
      to.src = imageDataUrl(from) ?? '';
    }
    copyStyle(from, to);
    copyValue(from, to);
  }
  return copy;
}

function copyStyle(from, to) {
  const style = getComputedStyle(from);
  for (const name of style) to.style.setProperty(name, style.getPropertyValue(name));
}

// What a field shows on screen lives in properties, not attributes, so it
// is written into the copy's attributes.
function copyValue(from, to) {
  if (from instanceof HTMLTextAreaElement) to.textContent = from.value;
  else if (from instanceof HTMLInputElement) {
    if (from.type === 'checkbox' || from.type === 'radio') {
      if (from.checked) to.setAttribute('checked', '');
      else to.removeAttribute('checked');
    } else to.setAttribute('value', from.value);
  } else if (from instanceof HTMLSelectElement) {
    [...to.options].forEach((o, i) => (i === from.selectedIndex ? o.setAttribute('selected', '') : o.removeAttribute('selected')));
  }
}

function safeDataUrl(canvas) {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function imageDataUrl(img) {
  if (!img.complete || !img.naturalWidth) return null;
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  canvas.getContext('2d').drawImage(img, 0, 0);
  return safeDataUrl(canvas) || null;
}
