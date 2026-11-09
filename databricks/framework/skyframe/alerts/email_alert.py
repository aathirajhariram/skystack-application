"""Warning e-mails to developers (and client contacts, if configured). Alert failures never fail the pipeline."""
import html
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import List

from skyframe.config.models import SourceConfig
from skyframe.config.settings import settings
from skyframe.utils.logger import get_logger
from skyframe.utils.secrets import get_secret

log = get_logger("skyframe.alerts")


def send_alert(cfg: SourceConfig, run_id: str, level: str, headline: str, findings: List[str]) -> None:
    """level: WARNING | FAILED"""
    if not cfg.recipients:
        log.warning("No alert recipients configured for source %s", cfg.source_id)
        return
    try:
        subject = f"[SkyStack {level}] {cfg.client_code}/{cfg.source_name}: {headline}"
        items = "".join(f"<li>{html.escape(str(f))}</li>" for f in findings)
        body = (f"<h3>{html.escape(headline)}</h3>"
                f"<p><b>Client:</b> {html.escape(cfg.client_name)} ({html.escape(cfg.client_code)})<br>"
                f"<b>Source:</b> {html.escape(cfg.source_name)}<br><b>Run id:</b> {run_id}</p>"
                f"<ul>{items}</ul>"
                "<p>Details: audit.vw_RunSummary, audit.ThresholdResult, audit.ReconciliationResult.</p>")
        msg = MIMEMultipart("alternative")
        msg["Subject"], msg["To"] = subject, ", ".join(cfg.recipients)
        msg["From"] = get_secret(settings.smtp_from_secret)
        msg.attach(MIMEText(body, "html"))

        with smtplib.SMTP(get_secret(settings.smtp_host_secret), int(get_secret(settings.smtp_port_secret)), timeout=30) as smtp:
            smtp.starttls()
            smtp.login(get_secret(settings.smtp_user_secret), get_secret(settings.smtp_password_secret))
            smtp.sendmail(msg["From"], cfg.recipients, msg.as_string())
        log.info("Alert sent to %s", cfg.recipients)
    except Exception as exc:                        # noqa: BLE001 - alerting must never break a run
        log.error("Could not send alert e-mail: %s", exc)
