# Use Python 3.12 slim image to keep size down
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Declare HF_TOKEN as a build argument
ARG HF_TOKEN

# Set HF_TOKEN as an environment variable if provided during build
ENV HF_TOKEN=${HF_TOKEN}

# Install system dependencies for OpenCV
RUN apt-get update && apt-get install -y libgl1-mesa-glx libglib2.0-0 libxcb1

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    python -m venv /app/.venv
ENV VIRTUAL_ENV=/app/.venv
ENV PATH="/app/.venv/bin:$PATH"
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Pre-download ML models during build to speed up container startup
RUN python -c "from nlp_engine import extract_keywords; print('Models downloaded successfully')"

# Expose the port Flask runs on
EXPOSE 5000

# Run the application
CMD ["/app/.venv/bin/python", "-u", "main.py"]