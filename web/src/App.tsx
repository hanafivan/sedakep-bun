import type { ReactNode } from 'react';
import { Outlet } from 'react-router-dom';

export function Card({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="shell">
      <div className="card">
        <h1>{title}</h1>
        {sub ? <p className="sub">{sub}</p> : null}
        {children}
      </div>
    </div>
  );
}

export function App() {
  return <Outlet />;
}
