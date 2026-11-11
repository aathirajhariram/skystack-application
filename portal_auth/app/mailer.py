import html
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app import vaults
from app.config import settings


def send_mail(to: str, subject: str, text: str, body_html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"], msg["To"], msg["From"] = subject, to, vaults.developer_secret("smtp-from")
    msg.attach(MIMEText(text, "plain"))
    msg.attach(MIMEText(body_html, "html"))
    with smtplib.SMTP(vaults.developer_secret("smtp-host"), int(vaults.developer_secret("smtp-port")), timeout=30) as smtp:
        smtp.starttls()
        smtp.login(vaults.developer_secret("smtp-user"), vaults.developer_secret("smtp-password"))
        smtp.sendmail(msg["From"], [to], msg.as_string())


def send_one_time_password(email: str, name: str, client_name: str, otp: str) -> None:
    url = f"{settings.portal_base_url}/login"
    hours = settings.otp_valid_hours
    text = (f"Hello {name},\n\nYour SkyStack workspace for {client_name} is ready.\n\n"
            f"Sign in: {url}\nEmail: {email}\nOne-time password: {otp}\n\n"
            f"The one-time password works once and expires in {hours} hours. "
            "You will be asked to choose your own password when you sign in.\n\nSkyStack")
    body = (f"<p>Hello {html.escape(name)},</p><p>Your SkyStack workspace for <b>{html.escape(client_name)}</b> is ready.</p>"
            f"<p><a href=\"{url}\">Sign in</a><br>Email: <b>{html.escape(email)}</b><br>"
            f"One-time password: <b style=\"font-family:monospace;font-size:16px\">{html.escape(otp)}</b></p>"
            f"<p>The one-time password expires in {hours} hours. You will be asked to choose your own password at first sign-in.</p>"
            "<p>SkyStack</p>")
    send_mail(email, "Your SkyStack workspace is ready", text, body)


def _money(amount, currency: str) -> str:
    return f"{currency.upper()} {float(amount):,.2f}"


def send_payment_link(email: str, name: str, plan_name: str, amount, currency: str, url: str, months: int = 1) -> None:
    """amount = the price of one billing period, which lasts `months` months."""
    price = f"{_money(amount, currency)} every {months} months" if months > 1 else f"{_money(amount, currency)} per month"
    text = (f"Hello {name},\n\nThank you for choosing the SkyStack {plan_name} plan ({price}).\n\n"
            f"Pay securely here: {url}\n\nThe link is valid for 24 hours; if it expires, simply submit the subscription form again. "
            "As soon as your payment is confirmed we will email you a one-time password for your workspace.\n\nSkyStack")
    body = (f"<p>Hello {html.escape(name)},</p><p>Thank you for choosing the SkyStack <b>{html.escape(plan_name)}</b> plan "
            f"({price}).</p><p><a href=\"{html.escape(url)}\" style=\"background:#246b98;color:#fff;"
            "padding:10px 18px;border-radius:6px;text-decoration:none\">Pay securely</a></p>"
            "<p>The link is valid for 24 hours; if it expires, simply submit the subscription form again. "
            "As soon as your payment is confirmed we will email you a one-time password for your workspace.</p><p>SkyStack</p>")
    send_mail(email, f"Complete your SkyStack {plan_name} subscription", text, body)


def notify_business(subject: str, lines: list[str]) -> None:
    """Internal notification to the SkyStack business inbox. Never raises - it must not break the customer flow."""
    if not settings.business_email:
        return
    try:
        text = "\n".join(lines)
        body = "<br>".join(html.escape(l) for l in lines)
        send_mail(settings.business_email, subject, text, f"<p>{body}</p>")
    except Exception:                                    # noqa: BLE001
        import logging
        logging.getLogger("skystack.mail").exception("business notification failed: %s", subject)
