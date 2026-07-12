import React from 'react';

export function Card({ children, title, className = '' }: { children: React.ReactNode, title?: string, className?: string }) {
  return (
    <div className={`tech-card ${className}`}>
      {title && (
        <h3 className="tech-heading" style={{ marginBottom: '1.5rem', borderBottom: '2px solid var(--border-color)', paddingBottom: '0.5rem' }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
