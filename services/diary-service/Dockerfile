FROM python:3.11-alpine

WORKDIR /app

RUN addgroup -g 10001 -S appgroup && adduser -S appuser -u 10001 -G appgroup

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY --chown=appuser:appgroup . .

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:5002/health || exit 1

USER appuser

EXPOSE 5002

CMD ["gunicorn", "--workers", "4", "--bind", "0.0.0.0:5002", "app:app"]
