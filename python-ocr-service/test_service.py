"""
Quick test script to verify the OCR service is working
"""

import requests
import json

# Test health check
print("🔍 Testing OCR Service Health Check...")
try:
    response = requests.get("http://localhost:8000/")
    print(f"✅ Service Status: {response.json()}")
except Exception as e:
    print(f"❌ Service not running: {e}")
    print("\nPlease start the service first:")
    print("  python main.py")
    exit(1)

print("\n" + "="*50)
print("✅ OCR Service is running and ready!")
print("="*50)
print("\nService URL: http://localhost:8000")
print("API Docs: http://localhost:8000/docs")
print("\nReady to process BGMI tournament videos!")
