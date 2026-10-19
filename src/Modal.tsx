import { useEffect, useId, useRef, type ReactNode } from "react";
export default function Modal({
  title,
  children,
  onCancel,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null),
    id = useId();
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "wide-dialog" : undefined}
      aria-labelledby={id}
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <h2 id={id}>{title}</h2>
      {children}
    </dialog>
  );
}
