from pydantic import BaseModel, EmailStr, Field, field_validator


def clean_display_name(v: str | None) -> str | None:
    """Collapse whitespace; an empty name means "no name"."""
    if v is None:
        return None
    v = " ".join(v.split())
    return v or None


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    display_name: str | None = Field(default=None, max_length=80)

    @field_validator("display_name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return clean_display_name(v)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    display_name: str | None = Field(default=None, max_length=80)

    @field_validator("display_name")
    @classmethod
    def _name(cls, v: str | None) -> str | None:
        return clean_display_name(v)


class UserPublic(BaseModel):
    id: str
    email: str
    role: str = "user"
    display_name: str | None = None
    household_id: str | None = None
    # Whether a recovery key is set (for resetting a forgotten password).
    has_recovery_key: bool = False

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    authenticated: bool
    user: UserPublic | None = None
    csrf_token: str | None = None


class RecoveryKeyResponse(BaseModel):
    """Shown once; only a hash is stored."""

    recovery_key: str


class ResetPasswordBody(BaseModel):
    email: EmailStr
    recovery_key: str = Field(min_length=8, max_length=64)
    new_password: str = Field(min_length=8, max_length=128)


class ChangePasswordBody(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)
