.PHONY: up down logs test clean

up:
	docker compose up --build -d

down:
	docker compose down

logs:
	docker compose logs -f

test:
	./backend/venv/bin/pytest backend/tests -v

clean:
	docker compose down -v
	rm -rf backend/__pycache__ backend/app/__pycache__ backend/app/routes/__pycache__ frontend/dist
