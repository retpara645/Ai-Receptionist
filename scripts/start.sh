#!/bin/sh

echo "Waiting for Postgres to be ready..."
sleep 5 # Simple wait, or could use pg_isready if available

echo "Importing workflows to n8n..."
# Import in specific order, ignoring errors if already imported (n8n will overwrite/update existing IDs)
n8n import:workflow --input=/workflows/01-core-ai-engine.json || echo "Failed or already exists"
n8n import:workflow --input=/workflows/02-telegram-channel.json || echo "Failed or already exists"
n8n import:workflow --input=/workflows/03-whatsapp-channel.json || echo "Failed or already exists"

echo "Starting n8n..."
exec n8n
