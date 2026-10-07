import { Link } from 'react-router-dom';
import { Card } from '../App';

export function Home() {
  return (
    <Card title="codebase-hono" sub="React + Bun + Hono + SQLite.">
      <p className="sub">Frontend dipisah dari backend dan berkomunikasi lewat API Hono.</p>
      <nav className="nav">
        <Link to="/login">Login</Link>
        <Link to="/register">Register</Link>
        <Link to="/dashboard">Dashboard</Link>
        <a href="/docs" target="_blank" rel="noreferrer">Swagger Docs</a>
      </nav>
    </Card>
  );
}
