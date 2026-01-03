import type { ReactNode } from 'react';

export function PageHeader(props: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <section className={['panel', 'pageHeader', props.className ?? ''].join(' ')}>
      <div className="pageHeaderTitleRow">
        <h1 className="pageTitle">{props.title}</h1>
        {props.actions ? <div className="pageHeaderActions">{props.actions}</div> : null}
      </div>

      {props.description ? <div className="pageDescription">{props.description}</div> : null}

      {props.children ? <div className="pageHeaderBody">{props.children}</div> : null}
    </section>
  );
}

export function SectionHeader(props: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  const Heading: 'h2' | 'h3' = props.as ?? 'h2';

  return (
    <div className={['sectionHeader', props.className ?? ''].join(' ')}>
      <div className="sectionHeaderTitleRow">
        <Heading className="sectionTitle">{props.title}</Heading>
        {props.actions ? <div className="sectionHeaderActions">{props.actions}</div> : null}
      </div>
      {props.description ? <div className="sectionDescription">{props.description}</div> : null}
    </div>
  );
}

