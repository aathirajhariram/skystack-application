import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { KeyRound, LayoutDashboard, LogOut, ShieldCheck, Upload, Users } from "lucide-react";
import { useAuth } from "../auth/AuthContext.jsx";
import AccountView from "./AccountView.jsx";
import AdminView from "./AdminView.jsx";
import ChangePasswordForm from "./ChangePasswordForm.jsx";
import DashboardView from "./DashboardView.jsx";
import UploadsView from "./UploadsView.jsx";
import "./live.css";

// The signed-in client workspace. Reuses the existing portal look (portal-* classes from styles.css).
export default function LivePortal({ logo }) {
  const { user, signOut, refresh } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("Dashboard");

  if (user.must_change_password) {                           // first sign-in with the one-time password
    return (
      <div className="live-center">
        <div className="live-center-card">
          {logo}
          <h1>Welcome, {user.display_name.split(" ")[0]}.</h1>
          <p>For your security, please choose your own password before you continue.</p>
          <ChangePasswordForm forced onDone={refresh} />
        </div>
      </div>
    );
  }

  const tabs = [
    ["Dashboard", LayoutDashboard],
    ...(user.permissions.upload ? [["Data uploads", Upload]] : []),
    ["Account", KeyRound],
    ...(user.permissions.admin ? [["Admin", Users]] : []),
  ];
  const subtitle = {
    Dashboard: "Your business at a glance, built from your own data.",
    "Data uploads": "Send new data and follow its processing.",
    Account: "Your sign-in details and password.",
    Admin: "Manage who can access your workspace.",
  }[tab];

  return (
    <div className="portal-shell">
      <aside className="portal-sidebar">
        <div className="portal-brand">{logo}</div>
        <div className="portal-org">
          <div className="org-avatar">{user.client_name.charAt(0).toUpperCase()}</div>
          <div><strong>{user.client_name}</strong><small>Client workspace</small></div>
        </div>
        <div className="portal-nav-label">WORKSPACE</div>
        <nav className="portal-side-nav">
          {tabs.map(([name, Icon]) => (
            <button key={name} className={tab === name ? "portal-nav-item selected" : "portal-nav-item"} onClick={() => setTab(name)}>
              <Icon size={17} /><span>{name}</span>
            </button>
          ))}
        </nav>
        <div className="live-userbox">
          <strong>{user.display_name}</strong><small>{user.email}</small>
          <button className="subtle-action" onClick={async () => { await signOut(); navigate("/login", { replace: true }); }}>
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="portal-main">
        <header className="portal-topbar">
          <div className="portal-breadcrumb"><span>Client workspace</span><span>/</span><strong>{tab}</strong></div>
          <div className="portal-top-actions"><span className="secure-indicator"><ShieldCheck size={15} /> Secure workspace</span></div>
        </header>
        <div className="portal-content">
          <div className="portal-welcome"><div><h1>{tab}</h1><p>{subtitle}</p></div></div>
          {tab === "Dashboard" && <DashboardView canUpload={user.permissions.upload} goUploads={() => setTab("Data uploads")} />}
          {tab === "Data uploads" && user.permissions.upload && <UploadsView />}
          {tab === "Account" && <AccountView user={user} />}
          {tab === "Admin" && user.permissions.admin && <AdminView me={user} />}
        </div>
      </main>
    </div>
  );
}
