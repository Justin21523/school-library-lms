# syntax=docker/dockerfile:1
#
# seed-scale container（Python + psql）
#
# 為什麼需要這個 image？
# - 這個 repo 的大量 seed 是用 Python 產生 CSV，再用 Postgres COPY 匯入
# - COPY 的執行我們用 psql（postgresql-client），因此需要「python + psql」同時存在
#
# 注意：
# - 這個 Dockerfile 會 apt-get 安裝 postgresql-client（需要網路）
# - 若你在離線環境，可改成：
#   - 使用自帶 psql 的 postgres image，再另外安裝 python（同樣需要 apt）
#   - 或改成純 SQL 的 generate_series（不走 Python）

FROM python:3.12-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-client ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

# 只把腳本帶進 image（實際的 schema.sql 會由 compose 把 repo 掛載進來）
COPY scripts/seed-scale.py /workspace/scripts/seed-scale.py

CMD ["python", "scripts/seed-scale.py"]

