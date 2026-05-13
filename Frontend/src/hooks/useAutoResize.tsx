import React, { useCallback, useLayoutEffect, useRef } from 'react';

type AutoResizeProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  value?: string | number;
};

export default function useAutoResize(value?: string | number) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  const adjust = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  useLayoutEffect(() => {
    adjust();
  }, [value, adjust]);

  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    target.style.height = 'auto';
    target.style.height = `${target.scrollHeight}px`;
  };

  return { ref, onInput, adjust };
}

export const AutoResizeTextarea: React.FC<AutoResizeProps> = ({ value, style, ...rest }) => {
  const { ref, onInput } = useAutoResize(value);

  const mergedStyle: React.CSSProperties = {
    whiteSpace: 'normal',
    wordBreak: 'break-word',
    resize: 'none',
    overflow: 'hidden',
    width: '100%',
    padding: '8px 12px',
    lineHeight: '1.2',
    ...(style as object || {}),
  };

  return (
    <textarea
      {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      ref={ref}
      value={value as any}
      onInput={(e) => { onInput(e); if ((rest as any).onInput) (rest as any).onInput(e); }}
      style={mergedStyle}
      rows={1}
    />
  );
};
