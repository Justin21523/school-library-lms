/**
 * Form primitives（統一表單容器：段落/欄位/動作列）
 *
 * 目標：
 * - 把「同一種表單結構」用一致的容器樣式呈現（FormSection / Field / Actions）
 * - 讓錯誤提示（error/hint）有固定位置與字級，避免每頁用 inline style 亂漂
 *
 * 取捨：
 * - v1 先不做 schema-driven 表單（那會牽涉到大量欄位字典/validation mapping）
 * - 先把視覺容器與可及性（label ↔ input）做乾淨，後續再把 Zod/後端 schema 的訊息接上
 */

import type { FormHTMLAttributes, ReactNode } from 'react';

function cx(...items: Array<string | undefined | null | false>) {
  return items.filter(Boolean).join(' ');
}

export function Form(props: FormHTMLAttributes<HTMLFormElement>) {
  const { className, ...rest } = props;
  return <form {...rest} className={cx('form', className)} />;
}

export function FormSection(props: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('formSection', props.className)}>
      <div className="formSectionHeader">
        <div className="formSectionTitle">{props.title}</div>
        {props.description ? <div className="formSectionDescription">{props.description}</div> : null}
      </div>
      {props.children}
    </section>
  );
}

export function Field(props: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('field', props.className)}>
      <label className="fieldLabel" htmlFor={props.htmlFor}>
        {props.label}
      </label>
      {props.children}
      {props.hint ? <div className="fieldHint">{props.hint}</div> : null}
      {props.error ? <div className="fieldError">{props.error}</div> : null}
    </div>
  );
}

export function FormActions(props: { children: ReactNode; className?: string }) {
  return <div className={cx('formActions', props.className)}>{props.children}</div>;
}

