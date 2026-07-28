import React from 'react';

export function Card({ children, title, className = '', style }: { children: React.ReactNode, title?: string, className?: string, style?: React.CSSProperties }) {
  return (
    <div className={`tech-card ${className}`} style={style}>
      {title && (
        <h3 className="tech-heading" style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
