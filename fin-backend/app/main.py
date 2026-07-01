"""Full API with cookie sessions and `/v1/auth/*`."""

from app.factory import create_app

app = create_app(enable_auth=True)
