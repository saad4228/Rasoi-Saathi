import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const modules = [
  ['Menu', 'Keep the menu sharp and service-ready.', '/menu'],
  ['Orders', 'See the pulse of every branch.', '/orders'],
  ['Inventory', 'Stay ahead of what the kitchen needs.', '/inventory'],
]

export default function DashboardPage() {
  const { applicationUser, signOut } = useAuth()

  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link className="brand brand-dark" to="/dashboard"><span className="brand-mark">RS</span> Rasoi Sathi</Link>
        <div className="workspace-switcher"><span className="switcher-dot" /> Saffron Junction <span>⌄</span></div>
        <nav className="workspace-nav" aria-label="Workspace navigation">
          <Link className="nav-active" to="/dashboard">Overview</Link>
          <Link to="/menu">Menu</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/inventory">Inventory</Link>
          <Link to="/forecasts">Forecasts</Link>
          <Link to="/purchase-orders">Purchase orders</Link>
          {applicationUser.role === 'owner' && <Link to="/settings">Settings</Link>}
        </nav>
        <button className="signout-button" type="button" onClick={signOut}>Sign out</button>
      </aside>
      <section className="workspace-main">
        <header className="workspace-header"><div><span className="eyebrow">GOOD MORNING</span><h1>Here is the shape of today.</h1></div><div className="profile-chip"><span>{applicationUser.name.slice(0, 1)}</span><div><strong>{applicationUser.name}</strong><small>{applicationUser.role}</small></div></div></header>
        <div className="workspace-banner"><div><span className="eyebrow">SAFFRON JUNCTION / ALL BRANCHES</span><h2>A steadier service starts with visibility.</h2><p>Welcome back. Your workspace is connected to Supabase Auth and scoped to your restaurant.</p></div><div className="banner-number">{applicationUser.restaurant_id.slice(0, 4)}<small>restaurant scope</small></div></div>
        <section className="workspace-grid">{modules.map(([title, copy, path]) => <Link className="workspace-card" to={path} key={title}><span className="card-kicker">0{modules.findIndex((item) => item[0] === title) + 1}</span><h3>{title}</h3><p>{copy}</p><span className="card-arrow">↗</span></Link>)}</section>
      </section>
    </main>
  )
}
