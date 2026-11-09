from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.routes import account, admin, auth, portal, public

app = FastAPI(title="SkyStack API", docs_url=None, redoc_url=None)

app.add_middleware(CORSMiddleware, allow_origins=settings.cors_origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PATCH"],
                   allow_headers=["Content-Type", "X-Requested-With", "Authorization"])

app.include_router(auth.router)
app.include_router(account.router)
app.include_router(admin.router)
app.include_router(portal.router)
app.include_router(public.router)

if settings.enable_ops:                       # only the internal deployment exposes onboarding
    from app.routes import ops
    app.include_router(ops.router)


@app.get("/healthz")
def health():
    return {"status": "ok"}
