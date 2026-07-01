.DEFAULT_GOAL := help
.PHONY: help dev down logs migrate api web mobile test test-api test-web lint openapi

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

dev: ## Bring up the full stack (Postgres + API + web)
	docker compose up --build

down: ## Stop the stack
	docker compose down

logs: ## Tail stack logs
	docker compose logs -f

migrate: ## Apply database migrations
	docker compose run --rm api poetry run alembic upgrade head

api: ## Run the API locally with reload
	cd apps/api && poetry run uvicorn app.main:app --reload

web: ## Run the web dev server
	npm run web

mobile: ## Run the Expo dev server
	npm run mobile

test: test-api test-web ## Run all tests

test-api: ## Run API tests (pytest)
	cd apps/api && poetry run pytest

test-web: ## Run web tests (Vitest)
	npm run test -w finance-tracking-app

lint: ## Lint API and web
	cd apps/api && poetry run ruff check app tests
	npm run lint -w finance-tracking-app

openapi: ## Regenerate the OpenAPI schema and client types
	cd apps/api && poetry run python scripts/export_openapi.py
	cd apps/web && npm run gen:api-types
