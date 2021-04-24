import React from "react";
import { createPortal } from "react-dom";

export function WindowPortal(props: { onClose?: () => void; children: React.ReactNode }) {
  const element = React.useRef<Element | null>(null);
  React.useEffect(() => {
    element.current = document.createElement("div");
    const w = window.open("", "", `width=500,height=500,left=0,top=0`);

    if (w != null) {
      w.document.body.appendChild(element.current);
    } else {
      console.warn("error opening window");
    }

    return () => {
      props.onClose?.();
      w?.close();
    };
  }, []);

  if (element.current == null) {
    return null;
  }

  return createPortal(props.children, element.current);
}
