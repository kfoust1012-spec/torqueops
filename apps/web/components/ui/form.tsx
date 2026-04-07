import type { FormHTMLAttributes, HTMLAttributes, LabelHTMLAttributes, ReactNode } from "react";

import { cx } from "./utils";

type FormProps = FormHTMLAttributes<HTMLFormElement>;

export function Form({ children, className, ...props }: FormProps) {
  return (
    <form className={cx("ui-form", className)} {...props}>
      {children}
    </form>
  );
}

type FormSectionProps = HTMLAttributes<HTMLDivElement> & {
  description?: ReactNode;
  title?: ReactNode;
};

export function FormSection({
  children,
  className,
  description,
  title,
  ...props
}: FormSectionProps) {
  return (
    <section className={cx("ui-form-section", className)} {...props}>
      {title || description ? (
        <div className="ui-form-section__header">
          {title ? <h2 className="ui-form-section__title">{title}</h2> : null}
          {description ? <p className="ui-form-section__description">{description}</p> : null}
        </div>
      ) : null}
      {children}
    </section>
  );
}

type FormRowProps = HTMLAttributes<HTMLDivElement> & {
  columns?: 1 | 2;
};

export function FormRow({ children, className, columns = 2, ...props }: FormRowProps) {
  return (
    <div
      className={cx("ui-form-row", columns === 1 && "ui-form-row--single", className)}
      {...props}
    >
      {children}
    </div>
  );
}

type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  error?: ReactNode;
  htmlFor?: LabelHTMLAttributes<HTMLLabelElement>["htmlFor"];
  hint?: ReactNode;
  label: ReactNode;
  required?: boolean | undefined;
  secondaryLabel?: ReactNode;
};

export function FormField({
  children,
  className,
  error,
  htmlFor,
  hint,
  label,
  required,
  secondaryLabel,
  ...props
}: FormFieldProps) {
  return (
    <div className={cx("ui-field", className)} {...props}>
      <div className="ui-field__label-row">
        <label className="ui-field__label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="ui-field__required"> *</span> : null}
        </label>
        {secondaryLabel ? <span className="ui-field__hint">{secondaryLabel}</span> : null}
      </div>
      {children}
      {hint ? <p className="ui-field__hint">{hint}</p> : null}
      {error ? <p className="ui-field__error">{error}</p> : null}
    </div>
  );
}
