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

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    authenticated: bool
    user: UserPublic | None = None
    csrf_token: str | None = None
