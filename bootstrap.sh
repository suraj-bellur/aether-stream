#!/usr/bin/env bash
# Non-interactive mode for apt commands
export DEBIAN_FRONTEND=noninteractive

echo "=========================================="
echo " Starting VM Provisioning: Docker & Tools "
echo "=========================================="

# Update package index and install prerequisite tools
sudo apt-get update -y
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    ffmpeg

# Create directory for Docker APT keyring
sudo mkdir -p /etc/apt/keyrings

# Add Docker's official GPG key if not already present
if [ ! -f /etc/apt/keyrings/docker.gpg ]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
fi

# Set up Docker APT repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update index and install Docker Engine + Docker Compose Plugin
sudo apt-get update -y
sudo apt-get install -y \
    docker-ce \
    docker-ce-cli \
    containerd.io \
    docker-buildx-plugin \
    docker-compose-plugin

# Enable and start Docker service
sudo systemctl enable docker
sudo systemctl start docker

# Add the login user to the 'docker' group so docker commands work without sudo.
# Defaults to 'vagrant'; the Hetzner server sets DOCKER_USER=deploy (see infra/server).
DOCKER_USER="${DOCKER_USER:-vagrant}"
sudo usermod -aG docker "$DOCKER_USER"

echo "=========================================="
echo " Provisioning Completed Successfully!     "
echo " Docker Version: $(docker --version)      "
echo " Compose Version: $(docker compose version)"
echo " FFmpeg Version: $(ffmpeg -version | head -n 1)"
echo "=========================================="
