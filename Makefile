.PHONY: help build run docker docker-up docker-down test clean

# Colors
RED=\033[0;31m
GREEN=\033[0;32m
YELLOW=\033[1;33m
NC=\033[0m

help:
	@echo "$(GREEN)Lansia Friendly Extension$(NC)"
	@echo ""
	@echo "$(YELLOW)Available commands:$(NC)"
	@echo "  make build          Build Go backend"
	@echo "  make run            Run Go backend locally"
	@echo "  make docker-build   Build Docker image"
	@echo "  make docker-up      Start with Docker Compose"
	@echo "  make docker-down    Stop Docker Compose"
	@echo "  make test           Test backend API"
	@echo "  make clean          Clean build files"
	@echo "  make load-ext       Load extension in Chrome"
	@echo ""

build:
	@echo "$(YELLOW)Building Go backend...$(NC)"
	cd backend && go build -o lansia-backend

run:
	@echo "$(YELLOW)Starting Go backend...$(NC)"
	cd backend && go run main.go

docker-build:
	@echo "$(YELLOW)Building Docker image...$(NC)"
	docker build -t lansia-backend:latest ./backend

docker-up:
	@echo "$(YELLOW)Starting with Docker Compose...$(NC)"
	docker-compose up -d

docker-down:
	@echo "$(YELLOW)Stopping Docker Compose...$(NC)"
	docker-compose down

test:
	@echo "$(YELLOW)Testing backend API...$(NC)"
	curl http://localhost:8080/api/health || echo "$(RED)Backend not running$(NC)"

clean:
	@echo "$(YELLOW)Cleaning build files...$(NC)"
	rm -f backend/lansia-backend
	rm -rf backend/vendor

load-ext:
	@echo "$(YELLOW)Load extension instructions:$(NC)"
	@echo "1. Open Chrome/Edge"
	@echo "2. Go to chrome://extensions/"
	@echo "3. Enable 'Developer mode'"
	@echo "4. Click 'Load unpacked'"
	@echo "5. Select the 'frontend' folder"
	@echo "6. Extension should appear in toolbar"

status:
	@curl -s http://localhost:8080/api/health | python3 -m json.tool || echo "$(RED)Backend not running$(NC)"