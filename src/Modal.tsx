import { useEffect, useId, useRef, type ReactNode } from "react";
export default function Modal({
  title,
  children,
  onCancel,
  wide = false,
  className,
}: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  wide?: boolean;
  className?: string;
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
      className={[wide ? "wide-dialog" : "", className ?? ""].filter(Boolean).join(" ") || undefined}
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
