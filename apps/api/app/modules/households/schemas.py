from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class HouseholdMember(BaseModel):
    id: UUID
    email: str
    display_name: str | None

    model_config = {"from_attributes": True}


class HouseholdRead(BaseModel):
    id: UUID
    name: str
    currency: str
    timezone: str
    invite_code: str
    members: list[HouseholdMember]


class HouseholdUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def strip(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("name must not be blank")
        return v


class HouseholdJoin(BaseModel):
    invite_code: str = Field(min_length=4, max_length=32)
