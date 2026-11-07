FROM python:3.12-slim
RUN useradd -r -u 10001 crows && mkdir /data && chown crows /data
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY server ./server
COPY static ./static
ENV CROWS_EYE_DATA=/data CROWS_EYE_HOST=0.0.0.0
USER crows
VOLUME /data
EXPOSE 8000
HEALTHCHECK --interval=30s CMD python -c "import urllib.request;urllib.request.urlopen('http://127.0.0.1:8000/healthz')"
# Single process on purpose: rule state and the live stream are in-memory.
CMD ["python", "-m", "server.main"]
