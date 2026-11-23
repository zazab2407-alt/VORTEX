import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface Common { label: string; error?: string; hint?: string }
type InputProps = Common & InputHTMLAttributes<HTMLInputElement> & { multiline?: false };
type AreaProps = Common & TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true };

/** Label + input + inline error, wired up for screen readers. */
export default function Field(props: InputProps | AreaProps) {
  const id = useId();
  const { label, error, hint, multiline, className = '', ...rest } = props;
  const described = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  const cls = `input ${error ? '!border-red-500' : ''} ${className}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {multiline
        ? <textarea id={id} aria-invalid={!!error} aria-describedby={described} className={cls} {...(rest as TextareaHTMLAttributes<HTMLTextAreaElement>)} />
        : <input id={id} aria-invalid={!!error} aria-describedby={described} className={cls} {...(rest as InputHTMLAttributes<HTMLInputElement>)} />}
      {error ? <p id={`${id}-err`} role="alert" className="mt-1 text-sm text-red-600">{error}</p>
        : hint ? <p id={`${id}-hint`} className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}
