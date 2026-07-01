from pydantic import BaseModel, EmailStr, Field


class RegisterBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginBody(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserPublic(BaseModel):
    id: str
    email: str
    role: str = "user"

    model_config = {"from_attributes": True}


class SessionResponse(BaseModel):
    authenticated: bool
    user: UserPublic | None = None
    csrf_token: str | None = None
