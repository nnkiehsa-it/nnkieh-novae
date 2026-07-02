/**
 * Calculates caret coordinates (top, left) inside a textarea.
 * Derived from the standard textarea-caret-position algorithm.
 */

const propertiesToCopy = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderWidth',
  'borderStyle',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'fontSizeAdjust',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize'
] as const;

interface CaretCoordinates {
  top: number;
  left: number;
  height: number;
}

export function getCaretCoordinates(element: HTMLTextAreaElement, position: number): CaretCoordinates {
  // Create mirror div
  const div = document.createElement('div');
  div.id = 'input-textarea-caret-position-mirror-div';
  document.body.appendChild(div);

  const style = div.style;
  const computed = window.getComputedStyle(element);

  // Position offscreen
  style.position = 'absolute';
  style.top = '0';
  style.left = '0';
  style.visibility = 'hidden';
  style.whiteSpace = 'pre-wrap';
  style.wordBreak = 'break-word';
  style.overflowWrap = 'break-word';

  // Copy properties
  propertiesToCopy.forEach((prop) => {
    (style as any)[prop] = (computed as any)[prop];
  });

  // Specifically for scrollbars
  if (computed.overflowY === 'scroll') {
    style.overflowY = 'scroll';
  } else {
    style.overflowY = 'hidden';
  }

  // Set text content up to current cursor position
  div.textContent = element.value.substring(0, position);

  // Create caret span
  const span = document.createElement('span');
  span.textContent = element.value.substring(position, position + 1) || '.';
  div.appendChild(span);

  const coordinates = {
    top: span.offsetTop + parseInt(computed.borderTopWidth || '0') - element.scrollTop,
    left: span.offsetLeft + parseInt(computed.borderLeftWidth || '0') - element.scrollLeft,
    height: parseInt(computed.lineHeight || computed.fontSize || '16')
  };

  document.body.removeChild(div);

  return coordinates;
}
