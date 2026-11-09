"""Stripe Checkout (hosted payment page). Keys live ONLY in the DEVELOPERS Key Vault."""
import stripe

from app import vaults
from app.config import settings


def create_checkout(request_id: str, email: str, plan: dict) -> dict:
    """Returns {"url": ..., "session_id": ...}. The plan price comes from cfg.Plan (editable by SkyStack in SQL)."""
    session = stripe.checkout.Session.create(
        api_key=vaults.developer_secret(settings.stripe_secret_name),
        mode="subscription",
        customer_email=email,
        line_items=[{"quantity": 1, "price_data": {
            "currency": str(plan["Currency"]).lower(),
            "unit_amount": int(round(float(plan["PriceMonthly"]) * 100)),
            "recurring": {"interval": "month"},
            "product_data": {"name": f"SkyStack {plan['Name']}"}}}],
        metadata={"request_id": request_id},
        success_url=f"{settings.portal_base_url}/login?subscribed=1",
        cancel_url=f"{settings.portal_base_url}/?subscription=cancelled",
    )
    return {"url": session.url, "session_id": session.id}


def parse_webhook(payload: bytes, signature: str):
    """Raises ValueError / stripe.SignatureVerificationError when the call did not come from Stripe."""
    return stripe.Webhook.construct_event(payload, signature,
                                          vaults.developer_secret(settings.stripe_webhook_secret_name))
