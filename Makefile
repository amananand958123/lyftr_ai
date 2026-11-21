DOCKER_COMPOSE ?= $(shell which docker-compose 2>/dev/null || echo "docker compose")

.PHONY: up down logs test clean audit

up:
	$(DOCKER_COMPOSE) up --build -d

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f

test:
	./backend/venv/bin/pytest backend/tests -v
	npm test --prefix frontend

audit:
	./backend/venv/bin/python scripts/verify_adversarial.py

clean:
	$(DOCKER_COMPOSE) down -v
	rm -rf backend/__pycache__ backend/app/__pycache__ backend/app/routes/__pycache__ frontend/dist
