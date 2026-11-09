import ChangePasswordForm from "./ChangePasswordForm.jsx";

const ROLE_TEXT = { admin: "Administrator", uploader: "Uploader (dashboards + uploads)", viewer: "Viewer (dashboards only)" };

export default function AccountView({ user }) {
  return (
    <section className="portal-panel">
      <div className="portal-panel-head"><div>
        <span className="portal-panel-kicker">YOUR ACCOUNT</span><h2>{user.display_name}</h2>
        <p>{user.email} · {ROLE_TEXT[user.role]}</p>
      </div></div>
      <h3 className="live-h3">Change password</h3>
      <ChangePasswordForm />
    </section>
  );
}
