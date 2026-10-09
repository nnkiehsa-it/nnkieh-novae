"use client";

import type {ReactNode} from "react";
import {Block} from "framework7-react";

/** Framework7's Timeline is supplied as upstream markup/CSS rather than a React component. */
export function Timeline({items}: {items: readonly {key: string; title: ReactNode; content: ReactNode}[]}) {
  return <Block strong className="m-0 p-0">
    <div className="timeline" role="list">
      {items.map(item => <div className="timeline-item" key={item.key} role="listitem">
        <div className="timeline-item-divider" aria-hidden />
        <div className="timeline-item-content">
          <div className="timeline-item-inner">
            <div className="timeline-item-title">{item.title}</div>
            <div className="timeline-item-subtitle">{item.content}</div>
          </div>
        </div>
      </div>)}
    </div>
  </Block>;
}
