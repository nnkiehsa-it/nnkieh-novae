import { describe, expect, it } from 'vitest';
import { findOrphanCssClassSelectors } from '../../scripts/css-orphan-selectors.mjs';

describe('CSS orphan selector analysis', () => {
  it('ignores keyframe percentages and matches whole class tokens', () => {
    expect(findOrphanCssClassSelectors(
      [{
        path: 'fixture.css',
        source: `
          .used.unused { opacity: 1; }
          .used-longer { opacity: 0; }
          @keyframes shake { 28.57% { transform: none; } }
        `,
      }],
      ['<div className="used used-longer" />'],
    )).toEqual([{ className: 'unused', locations: ['fixture.css:2'] }]);
  });
});
