# -*- mode: ruby -*-
# vi: set ft=ruby :

# Settings come from .env (see .env.example). Only three are read here:
#   PUBLIC_MEDIA_DIR   Windows folder served by the public site   (default E:/)
#   PRIVATE_MEDIA_DIR  Windows folder served by the private site
#   COMPOSE_PROFILES   "private" turns the private site on (the same switch Docker Compose uses)
# Changes need `vagrant reload`.
ENV_FILE = File.join(__dir__, ".env")

def env_setting(name, default = "")
  line = File.exist?(ENV_FILE) ? File.readlines(ENV_FILE).reverse.find { |l| l =~ /\A\s*#{name}\s*=/ } : nil
  return default if line.nil?
  value = line.split("=", 2)[1].strip
  value = value[1..-2] if value.length >= 2 && %w[" '].include?(value[0]) && value[-1] == value[0]
  value.empty? ? default : value
end

PUBLIC_DIR  = env_setting("PUBLIC_MEDIA_DIR", "E:/")
PRIVATE_DIR = env_setting("PRIVATE_MEDIA_DIR")
PRIVATE_ON  = env_setting("COMPOSE_PROFILES").split(",").map(&:strip).include?("private")

# Each site scans its folder recursively, so the two folders must not be the same or nested:
# files of one would show up on the other site.
def folder(path)
  File.expand_path(path.tr("\\", "/")).downcase.chomp("/")
end

def private_problem
  return "PRIVATE_MEDIA_DIR is empty. Set it in .env (for example PRIVATE_MEDIA_DIR=D:/PrivateMedia)." if PRIVATE_DIR.empty?
  pub, priv = folder(PUBLIC_DIR), folder(PRIVATE_DIR)
  return nil unless pub == priv || pub.start_with?(priv + "/") || priv.start_with?(pub + "/")
  "PUBLIC_MEDIA_DIR (#{PUBLIC_DIR}) and PRIVATE_MEDIA_DIR (#{PRIVATE_DIR}) are the same or one is inside the other."
end

MOUNT_PRIVATE = PRIVATE_ON && begin
  problem = private_problem
  if problem && (ARGV & %w[up reload resume provision]).any?
    abort "\nPrivate site misconfigured: #{problem}\nFix .env (or empty COMPOSE_PROFILES to turn the private site off) and run the command again.\n"
  end
  warn "WARNING: private site skipped. #{problem}" if problem # keeps `vagrant ssh` / `halt` usable so you can fix it
  problem.nil?
end

Vagrant.configure("2") do |config|
  # Base Ubuntu 22.04 LTS image
  config.vm.box = "ubuntu/jammy64"

  # Assign static private IP for easy access from host machine
  config.vm.network "private_network", ip: "192.168.56.10"

  # Public site: VM port 80 -> http://localhost:8080
  config.vm.network "forwarded_port", guest: 80, host: 8080, auto_correct: true

  # Public media folder (videos and photos, any depth) mounted into the VM (Zero-Copy)
  config.vm.synced_folder PUBLIC_DIR, "/media/videos",
    create: true,
    owner: "vagrant",
    group: "vagrant"

  # Private site (only with COMPOSE_PROFILES=private): VM port 81 -> http://localhost:8081
  if MOUNT_PRIVATE
    config.vm.network "forwarded_port", guest: 81, host: 8081, auto_correct: true
    config.vm.synced_folder PRIVATE_DIR, "/media/private",
      create: true,
      owner: "vagrant",
      group: "vagrant"
  end

  # VM Resource Allocation
  config.vm.provider "virtualbox" do |vb|
    vb.name = "aether-stream-vm"
    vb.memory = "4096"
    vb.cpus = 4
  end

  # Shell provisioning script to install Docker Engine, Docker Compose, and FFmpeg
  config.vm.provision "shell", path: "bootstrap.sh"
end
