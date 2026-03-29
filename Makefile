.PHONY: help install dev dev-frontend dev-backend build build-frontend build-backend test lint clean deploy docker-build docker-run doctor

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# ---------------------------------------------------------------------------
# Setup
# ---------------------------------------------------------------------------

install: ## Install all workspace dependencies
	npm install

# ---------------------------------------------------------------------------
# Development
# ---------------------------------------------------------------------------

dev: ## Run frontend and backend dev servers in parallel
	@echo "Starting frontend (port 4200) and backend (port 8080)..."
	@trap 'kill 0' INT TERM; \
		cd frontend && npx ng serve & \
		cd backend && npm run dev & \
		wait

dev-frontend: ## Run frontend dev server only
	cd frontend && npx ng serve

dev-backend: ## Run backend dev server only (hot reload)
	cd backend && npm run dev

# ---------------------------------------------------------------------------
# Build
# ---------------------------------------------------------------------------

build: build-frontend build-backend ## Build everything for production

build-frontend: ## Build Angular frontend
	cd frontend && npx ng build

build-backend: ## Compile backend TypeScript
	cd backend && npm run build

# ---------------------------------------------------------------------------
# Test
# ---------------------------------------------------------------------------

test: ## Run frontend tests
	cd frontend && npm test

test-watch: ## Run frontend tests in watch mode
	cd frontend && npx ng test --watch

# ---------------------------------------------------------------------------
# Docker
# ---------------------------------------------------------------------------

docker-build: ## Build the Docker image
	docker build -t clanmanager .

docker-run: docker-build ## Build and run the Docker image locally
	docker run --rm -p 8080:8080 clanmanager

# ---------------------------------------------------------------------------
# Deploy
# ---------------------------------------------------------------------------

deploy: ## Deploy to Cloud Run
	gcloud run deploy clanmanager-service --source . --region us-east1 --allow-unauthenticated

# ---------------------------------------------------------------------------
# Clean
# ---------------------------------------------------------------------------

clean: ## Remove build artifacts
	rm -rf frontend/dist backend/dist

clean-all: clean ## Remove build artifacts and node_modules
	rm -rf node_modules frontend/node_modules backend/node_modules shared/node_modules

# ---------------------------------------------------------------------------
# Doctor
# ---------------------------------------------------------------------------

define check
	@printf "  %-30s" "$(1)"; \
	if $(2) > /dev/null 2>&1; then \
		printf "\033[32m✔\033[0m"; \
		if [ -n "$(3)" ]; then printf "  (%s)" "$$($(3) 2>/dev/null)"; fi; \
		echo; \
	else \
		printf "\033[31m✘  %s\033[0m\n" "$(4)"; \
	fi
endef

doctor: ## Check that all tools and config are in place
	@echo ""
	@echo "\033[1mClan Manager — Doctor\033[0m"
	@echo ""
	@echo "\033[1mTools\033[0m"
	$(call check,node,command -v node,node --version,install Node 20+ → https://nodejs.org)
	$(call check,npm,command -v npm,npm --version,comes with Node)
	$(call check,npx,command -v npx,,comes with Node)
	$(call check,gcloud (optional),command -v gcloud,gcloud --version | head -1,install → https://cloud.google.com/sdk/docs/install)
	$(call check,docker (optional),command -v docker,docker --version,install → https://docs.docker.com/get-docker)
	@echo ""
	@echo "\033[1mDependencies\033[0m"
	$(call check,node_modules installed,test -d node_modules,,run: make install)
	@echo ""
	@echo "\033[1mEnvironment Files\033[0m"
	$(call check,frontend/.env,test -f frontend/.env,,create frontend/.env with NG_APP_CLASH_API_KEY)
	$(call check,backend/.env,test -f backend/.env,,create backend/.env with GOOGLE_CLOUD_SERVICE_ACCOUNT_KEY)
	@echo ""
	@echo "\033[1mBuilds\033[0m"
	$(call check,frontend built,test -d backend/dist/public,,run: make build-frontend)
	$(call check,backend built,test -d backend/dist,,run: make build-backend)
	@echo ""
	@printf "  \033[1mNode version check:       \033[0m"
	@NODE_MAJOR=$$(node --version 2>/dev/null | sed 's/v//' | cut -d. -f1); \
	if [ -z "$$NODE_MAJOR" ]; then \
		printf "\033[31m✘  node not found\033[0m\n"; \
	elif [ "$$NODE_MAJOR" -ge 20 ]; then \
		printf "\033[32m✔  v%s\033[0m\n" "$$(node --version)"; \
	else \
		printf "\033[33m⚠  v%s (need 20+)\033[0m\n" "$$(node --version)"; \
	fi
	@echo ""
