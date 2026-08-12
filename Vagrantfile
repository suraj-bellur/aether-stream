# -*- mode: ruby -*-
# vi: set ft=ruby :

Vagrant.configure("2") do |config|
  # Base Ubuntu 22.04 LTS image
  config.vm.box = "ubuntu/jammy64"

  # Assign static private IP for easy access from host machine
  config.vm.network "private_network", ip: "192.168.56.10"

  # Forward port 80 (HTTP) to host port 8080 (optional backup access method)
  config.vm.network "forwarded_port", guest: 80, host: 8080, auto_correct: true

  # Mount host video directory directly into the VM (Zero-Copy)
  # Host Path: E:/
  # Guest Path: /media/videos
  config.vm.synced_folder "E:/", "/media/videos",
    create: true,
    owner: "vagrant",
    group: "vagrant"

  # VM Resource Allocation
  config.vm.provider "virtualbox" do |vb|
    vb.name = "video-streaming-vm"
    vb.memory = "4096"
    vb.cpus = 4
  end

  # Shell provisioning script to install Docker Engine, Docker Compose, and FFmpeg
  config.vm.provision "shell", path: "bootstrap.sh"
end
