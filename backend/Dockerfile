# Use Python 3.12 slim image to keep size down
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Pre-download ML models during build to speed up container startup
RUN python -c "from nlp_engine import extract_keywords; print('Models downloaded successfully')"

# Expose the port Flask runs on
EXPOSE 5000

# Run the application
CMD ["python", "-u", "main.py"]