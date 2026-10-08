import { type ReactNode, useEffect, useId, useRef, useState } from "react";

/** Edit a numeric setting with page-fit validation. */
export function NumberField({
  label,
  value,
  min,
  max,
  step = "any",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number | "any";
  onChange: (value: number) => boolean;
}): ReactNode {
  const [draft, setDraft] = useState(String(value));
  const [fieldError, setFieldError] = useState("");
  const errorId = useId();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setDraft(String(value));
    input.current?.setCustomValidity("");
    setFieldError("");
  }, [value]);
  return (
    <div className="ws-field">
      <label htmlFor={inputId}>{label}</label>
      <input
        id={inputId}
        ref={input}
        type="number"
        min={min}
        max={max}
        step={step}
        required
        value={draft}
        aria-invalid={Boolean(fieldError)}
        aria-describedby={fieldError ? errorId : undefined}
        onChange={(event) => {
          const target = event.currentTarget;
          target.setCustomValidity("");
          setDraft(target.value);
          if (
            target.value !== "" &&
            target.validity.valid &&
            !onChange(Number(target.value))
          )
            target.setCustomValidity(
              "These settings do not fit the page. Adjust this value.",
            );
          setFieldError(target.validity.valid ? "" : target.validationMessage);
        }}
        onBlur={() => {
          if (input.current && !input.current.validity.valid) {
            setDraft(String(value));
            input.current.setCustomValidity("");
            setFieldError("");
          }
        }}
      />
      {fieldError && (
        <span id={errorId} className="ws-field-error" role="alert">
          {fieldError}
        </span>
      )}
    </div>
  );
}
