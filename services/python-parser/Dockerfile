FROM python:3.11-slim

WORKDIR /app

COPY services/python-parser/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY services/python-parser/app.py ./
COPY csv_parser_fixed_v2.py ./

EXPOSE 8080
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8080"]
